-- ============================================================================
-- OptiSource PK — back-office schema
--
-- Money       : numeric(12,2). Exact in Postgres, and it keeps the arithmetic
--               in SQL rather than pushing a x100 conversion into every read.
-- Times       : timestamptz (UTC). Business dates: date, in Asia/Karachi.
-- Philosophy  : the database holds constraints and the operations that must be
--               atomic. Everything else lives in src/services/shop/.
-- ============================================================================

create type order_status      as enum ('created','dispatched','delivered','cancelled');
create type ledger_entry_type as enum ('invoice','payment','adjustment');
create type payment_method    as enum ('cash','bank_transfer','cheque','easypaisa','jazzcash','other');
create type stock_reason      as enum ('purchase','sale','return','adjustment','void');
create type order_priority    as enum ('normal','urgent');

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;


-- ---------------------------------------------------------------- customers
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  customer_name text not null check (btrim(customer_name) <> ''),
  shop_name     text not null check (btrim(shop_name) <> ''),
  area          text not null check (btrim(area) <> ''),
  address       text not null check (btrim(address) <> ''),
  phone         text not null check (btrim(phone) <> ''),
  phone_alt     text,
  ntn           text,   -- printed on the invoice when present; no logic hangs off it
  strn          text,
  default_discount_pct numeric(5,2) not null default 0
                 check (default_discount_pct between 0 and 100),
  opening_balance      numeric(12,2) not null default 0,
  opening_balance_date date not null default (now() at time zone 'Asia/Karachi')::date,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Soft delete: the ledger and issued invoices outlive the customer record.
  deleted_at timestamptz
);

-- A duplicate customer means a split ledger, which is the failure that actually
-- hurts. Drop this index if two genuinely different shops ever share a name.
create unique index customers_shop_area_uq
  on public.customers (lower(shop_name), lower(area)) where deleted_at is null;
create index customers_active_idx
  on public.customers (area, shop_name) where deleted_at is null;
create trigger customers_touch before update on public.customers
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------- products
create table public.products (
  id         uuid primary key default gen_random_uuid(),
  sku        text not null unique check (btrim(sku) <> ''),
  name       text not null check (btrim(name) <> ''),
  -- Mirrors CategorySlug in src/types/catalogue.ts, plus 'services' for
  -- coatings and tints, which are billed per job and never held.
  category   text not null check (category in
               ('lenses','frames','accessories','lab-supplies',
                'frame-parts-tools','optometric','services')),
  unit       text not null default 'pcs',
  list_price numeric(12,2) not null default 0 check (list_price >= 0),
  tracks_power boolean not null default false,  -- lens: stock is keyed by SPH
  tracks_stock boolean not null default true,   -- false for services: no bin at all
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint products_power_needs_stock check (not tracks_power or tracks_stock),
  -- Target for the composite FK from stock_bins; see the note there.
  constraint products_id_power_uq unique (id, tracks_power)
);
create index products_active_idx
  on public.products (category, name) where deleted_at is null;
create trigger products_touch before update on public.products
  for each row execute function public.set_updated_at();


-- --------------------------------------------------------------- stock bins
-- One mechanism for both cases: the bin key is (product_id, sph), and sph is
-- NULL for anything not power-tracked. UNIQUE NULLS NOT DISTINCT makes that
-- NULL row a real singleton bin rather than an unconstrained pile.
--
-- tracks_power is mirrored from products and tied back with a composite FK so
-- a lens can never acquire a NULL-sph "all powers" bin. A constraint, not a
-- trigger, and not a thing the application has to remember.
create table public.stock_bins (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid    not null,
  tracks_power boolean not null,
  sph          numeric(5,2),
  qty_on_hand   integer not null default 0 check (qty_on_hand >= 0),  -- the oversell guard
  reorder_level integer not null default 0 check (reorder_level >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_bins_product_fk foreign key (product_id, tracks_power)
    references public.products (id, tracks_power) on update cascade on delete restrict,
  constraint stock_bins_sph_matches_product check (tracks_power = (sph is not null)),
  constraint stock_bins_sph_step
    check (sph is null or (sph between -30 and 30 and mod(sph, 0.25) = 0)),
  constraint stock_bins_product_sph_uq unique nulls not distinct (product_id, sph)
);
create index stock_bins_low_idx on public.stock_bins (product_id)
  where qty_on_hand <= reorder_level;
create trigger stock_bins_touch before update on public.stock_bins
  for each row execute function public.set_updated_at();


-- ------------------------------------------------------------------- orders
-- An invoice is an order that has been issued: same row, same lines, same
-- order number the delivery worker reports. Two tables would need a copy step
-- between them, and a copy step drifts. Immutability replaces it (see the
-- freeze triggers below).
create sequence public.order_no_seq start 1001;

create table public.orders (
  id       uuid   primary key default gen_random_uuid(),
  order_no bigint not null unique default nextval('public.order_no_seq'),
  external_order_ref text,                               -- the "Order" column
  priority order_priority not null default 'normal',     -- prints as URGENT

  bill_to_customer_id uuid not null references public.customers(id) on delete restrict,

  -- "Order By" and "Deliver To" boxes: all three parties can differ.
  order_by_name      text,
  deliver_to_name    text,
  deliver_to_address text,
  deliver_to_area    text,
  deliver_to_phone   text,

  -- "Invoice To" box, snapshotted at issue so a later customer edit cannot
  -- rewrite an invoice that has already gone out.
  bill_to_name text, bill_to_shop text, bill_to_address text, bill_to_phone text,
  bill_to_ntn  text, bill_to_strn text,

  courier_name text,
  tracking_no  text,

  status        order_status not null default 'created',
  dispatched_at timestamptz,
  delivered_at  timestamptz,
  delivered_by  text,           -- worker's name; text until staff get logins
  delivery_note text,

  issued_at  timestamptz,
  invoice_no bigint unique,
  order_qty  integer,           -- distinct jobs on the invoice
  lens_qty   integer,           -- lenses, i.e. power-tracked quantity
  invoice_amount        numeric(12,2),
  discount_amount       numeric(12,2),
  freight_charge        numeric(12,2) not null default 0 check (freight_charge >= 0),
  net_amount            numeric(12,2),
  -- Defaults to 0: the reference invoice shows GST 0.00 and Additional Tax
  -- 0.00. Raise per invoice when a customer is billed with sales tax.
  gst_rate              numeric(5,2) not null default 0 check (gst_rate between 0 and 100),
  gst_amount            numeric(12,2),
  additional_tax_rate   numeric(5,2) not null default 0 check (additional_tax_rate between 0 and 100),
  additional_tax_amount numeric(12,2),
  amount_incl_tax       numeric(12,2),

  voided_at   timestamptz,
  void_reason text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint orders_issue_pair check ((issued_at is null) = (invoice_no is null)),
  constraint orders_issued_totals check (issued_at is null or
    (order_qty is not null and lens_qty is not null and invoice_amount is not null
     and discount_amount is not null and net_amount is not null and gst_amount is not null
     and additional_tax_amount is not null and amount_incl_tax is not null)),
  constraint orders_net_identity check (issued_at is null or
    net_amount = invoice_amount - discount_amount + freight_charge),
  constraint orders_gross_identity check (issued_at is null or
    amount_incl_tax = net_amount + gst_amount + additional_tax_amount),
  constraint orders_delivered_pair check ((delivered_at is not null) = (status = 'delivered')),
  constraint orders_dispatched_pair check (dispatched_at is not null or status not in ('dispatched','delivered')),
  constraint orders_invoice_before_dispatch check (status in ('created','cancelled') or issued_at is not null),
  constraint orders_void_needs_issue check (voided_at is null or issued_at is not null)
);
create index orders_customer_idx on public.orders (bill_to_customer_id, issued_at desc nulls first);
create index orders_open_idx     on public.orders (status, created_at) where status in ('created','dispatched');
create index orders_issued_idx   on public.orders (issued_at desc) where issued_at is not null;
create trigger orders_touch before update on public.orders
  for each row execute function public.set_updated_at();


-- -------------------------------------------------------------- order lines
-- One row per printed line. Each eye is its own line (eye = the "Reference"
-- column); coatings and tints are ordinary lines carrying no power values.
create table public.order_lines (
  id       uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_no  integer not null check (line_no > 0),
  order_ref text,                          -- the "Order" column, per line
  product_id   uuid not null references public.products(id) on delete restrict,
  product_name text not null check (btrim(product_name) <> ''),  -- snapshot
  unit         text not null default 'pcs',                      -- snapshot
  eye  text check (eye in ('R','L')),
  sph  numeric(5,2),
  cyl  numeric(5,2),
  ax   integer,
  add_power numeric(4,2),
  unit_price   numeric(12,2) not null check (unit_price >= 0),    -- snapshot
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  quantity     integer not null check (quantity > 0),
  line_gross    numeric(12,2) generated always as (round(unit_price * quantity, 2)) stored,
  line_discount numeric(12,2) generated always as
                 (round(unit_price * quantity * discount_pct / 100, 2)) stored,
  line_total    numeric(12,2) generated always as
                 (round(unit_price * quantity, 2)
                  - round(unit_price * quantity * discount_pct / 100, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_lines_no_uq unique (order_id, line_no),
  -- Quarter-dioptre steps. Relax to 0.125 if they ever stock eighth steps.
  constraint order_lines_sph_step check (sph is null or (sph between -30 and 30 and mod(sph, 0.25) = 0)),
  constraint order_lines_cyl_step check (cyl is null or (cyl between -12 and 12 and mod(cyl, 0.25) = 0)),
  constraint order_lines_add_step check (add_power is null or (add_power between 0.25 and 6 and mod(add_power, 0.25) = 0)),
  constraint order_lines_ax_range    check (ax is null or ax between 0 and 180),
  constraint order_lines_ax_needs_cyl check (ax is null or cyl is not null)
);
create index order_lines_order_idx   on public.order_lines (order_id, line_no);
create index order_lines_product_idx on public.order_lines (product_id);
create trigger order_lines_touch before update on public.order_lines
  for each row execute function public.set_updated_at();


-- --------------------------------------------------------- stock movements
-- Append-only audit trail. The authoritative quantity is stock_bins.qty_on_hand;
-- this is the history of how it got there.
create table public.stock_movements (
  id     uuid primary key default gen_random_uuid(),
  bin_id uuid not null references public.stock_bins(id) on delete restrict,
  delta  integer not null check (delta <> 0),
  reason stock_reason not null,
  order_id uuid references public.orders(id) on delete restrict,
  note   text,
  created_at timestamptz not null default now()
);
create index stock_movements_bin_idx   on public.stock_movements (bin_id, created_at desc);
create index stock_movements_order_idx on public.stock_movements (order_id) where order_id is not null;


-- ------------------------------------------------------------------ ledger
-- Append-only. amount is SIGNED: positive = the customer owes more (invoice),
-- negative = a payment. One column to sum means one thing to get wrong.
--
-- The running balance is NEVER stored. Backdated payments are routine here,
-- and a stored balance would need a cascading recompute on every one of them —
-- which is exactly where a wrong balance comes from.
create table public.ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  -- Business date, backdatable: a payment received Tuesday and entered
  -- Thursday belongs on Tuesday's line. created_at is the tiebreak.
  entry_date  date not null default (now() at time zone 'Asia/Karachi')::date,
  entry_type  ledger_entry_type not null,
  amount      numeric(12,2) not null check (amount <> 0),
  order_id    uuid references public.orders(id) on delete restrict,
  payment_method payment_method,
  reference   text,        -- cheque number, bank reference
  memo        text,
  created_at  timestamptz not null default now(),   -- no updated_at: nothing here is updated
  constraint ledger_sign check (
    (entry_type = 'invoice'    and amount > 0) or
    (entry_type = 'payment'    and amount < 0) or
    (entry_type = 'adjustment')),
  constraint ledger_invoice_has_order check (entry_type <> 'invoice' or order_id is not null),
  constraint ledger_method_only_on_payment check (payment_method is null or entry_type = 'payment')
);
create unique index ledger_one_per_invoice
  on public.ledger_entries (order_id) where entry_type = 'invoice';
create index ledger_statement_idx
  on public.ledger_entries (customer_id, entry_date, created_at, id);


-- ---------------------------------------------------------------- counters
-- Gapless invoice numbering. A sequence gaps on rollback, and a tax-invoice
-- series with holes invites questions. This counter rolls back with the
-- transaction. Order numbers keep the sequence: gaps there are harmless.
create table public.counters (
  name       text   primary key,
  next_value bigint not null check (next_value > 0)
);
insert into public.counters (name, next_value) values ('invoice_no', 1);


-- ------------------------------------------------------- invoice immutability
-- A trigger rather than an RLS predicate: RLS would turn a forbidden edit into
-- a silent zero-row no-op, and the user needs to be told why the save did
-- nothing.
create function public.freeze_issued_order() returns trigger
language plpgsql as $$
declare mutable text[] := array['status','dispatched_at','delivered_at','delivered_by',
                                'delivery_note','courier_name','tracking_no',
                                'voided_at','void_reason','notes','updated_at'];
begin
  if old.issued_at is null then return new; end if;
  if (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable) then
    raise exception 'Invoice % has been issued. Void it and raise a new one instead of editing.', old.invoice_no
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;
create trigger orders_freeze before update on public.orders
  for each row execute function public.freeze_issued_order();

create function public.freeze_issued_lines() returns trigger
language plpgsql as $$
declare v_order uuid;
begin
  v_order := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
  if exists (select 1 from public.orders o where o.id = v_order and o.issued_at is not null) then
    raise exception 'Cannot change the lines of an issued invoice.'
      using errcode = 'restrict_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger order_lines_freeze before insert or update or delete on public.order_lines
  for each row execute function public.freeze_issued_lines();


-- ============================================================================
-- The operations that must be atomic.
--
-- PostgREST has no client-side transactions, so anything needing more than one
-- statement has to be an RPC. That is exactly these three; every other write
-- is a single statement and belongs in the service layer.
-- All are `security invoker`, so RLS still applies inside them.
-- ============================================================================

-- Receive or adjust stock. Creates the bin on first receipt, including the
-- single NULL-sph bin for non-power goods.
create function public.adjust_stock(
  p_product_id uuid,
  p_sph        numeric,
  p_delta      integer,
  p_reason     stock_reason default 'adjustment',
  p_note       text default null)
returns integer
language plpgsql security invoker set search_path = public as $$
declare v_bin uuid; v_qty integer;
begin
  if p_delta = 0 then raise exception 'Stock adjustment cannot be zero.'; end if;

  insert into stock_bins (product_id, tracks_power, sph, qty_on_hand)
  select p.id, p.tracks_power, p_sph, p_delta
    from products p
   where p.id = p_product_id and p.tracks_stock and p.deleted_at is null
  on conflict on constraint stock_bins_product_sph_uq
    do update set qty_on_hand = stock_bins.qty_on_hand + p_delta, updated_at = now()
  returning id, qty_on_hand into v_bin, v_qty;

  if v_bin is null then
    raise exception 'Product % is unknown, deleted, or not stock-tracked.', p_product_id;
  end if;

  insert into stock_movements (bin_id, delta, reason, note)
  values (v_bin, p_delta, p_reason, p_note);
  return v_qty;
end $$;


-- Issue the invoice for an order: deduct stock, number it, compute the totals
-- block from the lines the database holds, post the ledger entry. All or
-- nothing — any failure aborts the whole function.
create function public.issue_invoice(
  p_order_id uuid,
  p_freight  numeric default 0,
  p_gst_rate numeric default 0,
  p_additional_tax_rate numeric default 0)
returns public.orders
language plpgsql security invoker set search_path = public as $$
declare
  o public.orders; c public.customers; r record;
  v_have integer; v_bin uuid; v_no bigint;
  v_gross numeric(12,2); v_disc numeric(12,2); v_net numeric(12,2);
  v_gst numeric(12,2); v_add numeric(12,2); v_incl numeric(12,2);
  v_oqty integer; v_lqty integer;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Order % was not found.', p_order_id; end if;
  if o.issued_at is not null then
    raise exception 'Order % is already invoice %.', o.order_no, o.invoice_no; end if;
  if o.status = 'cancelled' then
    raise exception 'Order % is cancelled.', o.order_no; end if;
  if not exists (select 1 from order_lines where order_id = p_order_id) then
    raise exception 'Order % has no lines.', o.order_no; end if;

  select * into c from customers where id = o.bill_to_customer_id;

  -- Deduct stock. Aggregated per bin and locked in a deterministic order, so
  -- two concurrent invoices can never take the same locks in opposite order.
  for r in
    select l.product_id, l.sph, sum(l.quantity)::int as qty
      from order_lines l join products p on p.id = l.product_id
     where l.order_id = p_order_id and p.tracks_stock
     group by l.product_id, l.sph
     order by l.product_id, l.sph
  loop
    select b.id, b.qty_on_hand into v_bin, v_have
      from stock_bins b
     where b.product_id = r.product_id and b.sph is not distinct from r.sph
     for update;                                  -- row lock held until commit

    if v_bin is null then
      raise exception 'No stock bin for product % at SPH %.', r.product_id, r.sph
        using errcode = 'restrict_violation'; end if;
    if v_have < r.qty then
      raise exception 'Insufficient stock: product % SPH % has %, needs %.',
        r.product_id, r.sph, v_have, r.qty using errcode = 'restrict_violation'; end if;

    update stock_bins set qty_on_hand = qty_on_hand - r.qty, updated_at = now()
     where id = v_bin;
    insert into stock_movements (bin_id, delta, reason, order_id)
    values (v_bin, -r.qty, 'sale', p_order_id);
  end loop;

  -- Totals from the lines the database holds, never from numbers a client sent.
  select coalesce(sum(l.line_gross), 0),
         coalesce(sum(l.line_discount), 0),
         greatest(count(distinct l.order_ref), 1),
         coalesce(sum(l.quantity) filter (where p.tracks_power), 0)
    into v_gross, v_disc, v_oqty, v_lqty
    from order_lines l join products p on p.id = l.product_id
   where l.order_id = p_order_id;

  v_net  := v_gross - v_disc + coalesce(p_freight, 0);
  v_gst  := round(v_net * p_gst_rate / 100, 2);
  v_add  := round(v_net * p_additional_tax_rate / 100, 2);
  v_incl := v_net + v_gst + v_add;

  update counters set next_value = next_value + 1
   where name = 'invoice_no' returning next_value - 1 into v_no;

  update orders set
     issued_at = now(), invoice_no = v_no,
     bill_to_name = c.customer_name, bill_to_shop = c.shop_name,
     bill_to_address = c.address,   bill_to_phone = c.phone,
     bill_to_ntn = c.ntn,           bill_to_strn = c.strn,
     order_qty = v_oqty, lens_qty = v_lqty,
     invoice_amount = v_gross, discount_amount = v_disc,
     freight_charge = coalesce(p_freight, 0), net_amount = v_net,
     gst_rate = p_gst_rate, gst_amount = v_gst,
     additional_tax_rate = p_additional_tax_rate, additional_tax_amount = v_add,
     amount_incl_tax = v_incl
   where id = p_order_id returning * into o;

  insert into ledger_entries (customer_id, entry_date, entry_type, amount, order_id, memo)
  values (o.bill_to_customer_id, (o.issued_at at time zone 'Asia/Karachi')::date,
          'invoice', v_incl, o.id, 'Invoice ' || v_no);

  return o;
end $$;


-- The escape hatch, because issued invoices are frozen: return the stock,
-- post a reversing ledger adjustment.
create function public.void_invoice(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql security invoker set search_path = public as $$
declare o public.orders; r record;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Order % was not found.', p_order_id; end if;
  if o.issued_at is null then
    raise exception 'Order % was never invoiced.', o.order_no; end if;
  if o.voided_at is not null then
    raise exception 'Invoice % is already void.', o.invoice_no; end if;

  for r in select m.bin_id, -sum(m.delta)::int as qty
             from stock_movements m
            where m.order_id = p_order_id and m.reason = 'sale'
            group by m.bin_id order by m.bin_id
  loop
    update stock_bins set qty_on_hand = qty_on_hand + r.qty, updated_at = now()
     where id = r.bin_id;
    insert into stock_movements (bin_id, delta, reason, order_id, note)
    values (r.bin_id, r.qty, 'void', p_order_id, p_reason);
  end loop;

  -- An 'adjustment', so the partial unique index on invoice entries allows it
  -- to carry the same order_id and stay joinable.
  insert into ledger_entries (customer_id, entry_type, amount, order_id, memo)
  values (o.bill_to_customer_id, 'adjustment', -o.amount_incl_tax, o.id,
          'Void of invoice ' || o.invoice_no || ' — ' || p_reason);

  update orders set voided_at = now(), void_reason = p_reason, status = 'cancelled'
   where id = p_order_id returning * into o;
  return o;
end $$;


-- ============================================================================
-- Views
--
-- security_invoker is not optional: a view without it runs as its owner and
-- silently bypasses RLS, and PostgREST exposes every view in `public`.
-- ============================================================================

-- Dated statement with a running balance. The opening row is synthesised from
-- customers.opening_balance, so editing that field just flows through — no
-- duplicate ledger row to keep in step.
create view public.customer_statement with (security_invoker = true) as
with rows as (
  select c.id as customer_id, 0 as ord, c.opening_balance_date as entry_date,
         'opening' as kind, null::uuid as entry_id, null::bigint as invoice_no,
         'Opening balance' as description, c.opening_balance as amount,
         c.created_at as seq_at, '00000000-0000-0000-0000-000000000000'::uuid as seq_id
    from public.customers c where c.deleted_at is null
  union all
  select l.customer_id, 1, l.entry_date, l.entry_type::text, l.id, o.invoice_no,
         coalesce(l.memo, initcap(l.entry_type::text)), l.amount, l.created_at, l.id
    from public.ledger_entries l
    left join public.orders o on o.id = l.order_id
)
select customer_id, entry_date, kind, entry_id, invoice_no, description,
       case when amount > 0 then  amount end as debit,
       case when amount < 0 then -amount end as credit,
       amount,
       sum(amount) over (partition by customer_id
                         order by ord, entry_date, seq_at, seq_id
                         rows between unbounded preceding and current row) as running_balance
  from rows;

create view public.customer_balances with (security_invoker = true) as
select c.id as customer_id, c.customer_name, c.shop_name, c.area, c.phone,
       c.opening_balance,
       coalesce( sum(l.amount) filter (where l.entry_type = 'invoice'),    0) as invoiced,
       coalesce(-sum(l.amount) filter (where l.entry_type = 'payment'),    0) as paid,
       coalesce( sum(l.amount) filter (where l.entry_type = 'adjustment'), 0) as adjustments,
       c.opening_balance + coalesce(sum(l.amount), 0)                         as balance
  from public.customers c
  left join public.ledger_entries l on l.customer_id = c.id
 where c.deleted_at is null
 group by c.id;

create view public.low_stock with (security_invoker = true) as
select b.id as bin_id, p.id as product_id, p.sku, p.name, p.category, b.sph,
       b.qty_on_hand, b.reorder_level, b.reorder_level - b.qty_on_hand as shortfall
  from public.stock_bins b join public.products p on p.id = b.product_id
 where p.deleted_at is null and b.qty_on_hand <= b.reorder_level;


-- ============================================================================
-- Row Level Security
--
-- Single owner login: one predicate, and it is `true`. Row ownership means
-- nothing until there is a second user. When staff roles arrive, only these
-- policy bodies change — which is why they are written per table now.
-- ============================================================================

alter table public.customers       enable row level security;
alter table public.products        enable row level security;
alter table public.stock_bins      enable row level security;
alter table public.stock_movements enable row level security;
alter table public.orders          enable row level security;
alter table public.order_lines     enable row level security;
alter table public.ledger_entries  enable row level security;
alter table public.counters        enable row level security;

create policy owner_all on public.customers   for all to authenticated using (true) with check (true);
create policy owner_all on public.products    for all to authenticated using (true) with check (true);
create policy owner_all on public.stock_bins  for all to authenticated using (true) with check (true);
create policy owner_all on public.orders      for all to authenticated using (true) with check (true);
create policy owner_all on public.order_lines for all to authenticated using (true) with check (true);

-- Append-only by omission: no UPDATE or DELETE policy exists, so no UPDATE or
-- DELETE is possible on the ledger or the stock history at all.
create policy read   on public.ledger_entries  for select to authenticated using (true);
create policy append on public.ledger_entries  for insert to authenticated with check (true);
create policy read   on public.stock_movements for select to authenticated using (true);
create policy append on public.stock_movements for insert to authenticated with check (true);

-- Only ever touched inside issue_invoice.
create policy read on public.counters for select to authenticated using (true);
create policy bump on public.counters for update to authenticated using (true) with check (true);

-- Belt and braces over Supabase's default grants.
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon;

grant execute on function public.adjust_stock(uuid, numeric, integer, stock_reason, text) to authenticated;
grant execute on function public.issue_invoice(uuid, numeric, numeric, numeric)           to authenticated;
grant execute on function public.void_invoice(uuid, text)                                 to authenticated;
