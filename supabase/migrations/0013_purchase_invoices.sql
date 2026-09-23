-- ============================================================================
-- Purchase invoices: where stock came from.
--
-- A supplier sends a delivery with their own invoice (see
-- docs/reference/supplier-invoice-reference.pdf). Recording it here keeps
-- what was bought, from whom and at what cost, and every stock movement it
-- causes points back at it.
--
-- One supplier invoice is often entered product by product — the power grid
-- receives one product at a time — so `record_purchase` appends to an
-- invoice that already exists for that supplier and invoice number instead
-- of refusing it.
--
-- Purchases are append-only, like the ledger and the stock history. A
-- mistake is corrected with a stock adjustment, not by rewriting the record.
-- ============================================================================

-- ---------------------------------------------------------------- suppliers
create table public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (btrim(name) <> ''),
  phone      text,
  city       text,
  address    text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index suppliers_name_uq
  on public.suppliers (lower(btrim(name))) where deleted_at is null;
create trigger suppliers_touch before update on public.suppliers
  for each row execute function public.set_updated_at();


-- -------------------------------------------------------- purchase invoices
create table public.purchase_invoices (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.suppliers(id) on delete restrict,
  -- The supplier's number, as printed on their invoice.
  invoice_no   text not null check (btrim(invoice_no) <> ''),
  invoice_date date not null default (now() at time zone 'Asia/Karachi')::date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- The same paper invoice entered twice would double the stock.
create unique index purchase_invoices_supplier_no_uq
  on public.purchase_invoices (supplier_id, lower(btrim(invoice_no)));
create index purchase_invoices_date_idx
  on public.purchase_invoices (invoice_date desc, created_at desc);
create trigger purchase_invoices_touch before update on public.purchase_invoices
  for each row execute function public.set_updated_at();

create table public.purchase_invoice_lines (
  id                  uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references public.purchase_invoices(id) on delete restrict,
  product_id          uuid not null references public.products(id) on delete restrict,
  -- Snapshot, so renaming a product later does not rewrite an old purchase.
  product_name        text not null,
  sph        numeric(5,2),
  cyl        numeric(5,2),
  add_power  numeric(4,2),
  eye        text check (eye is null or eye in ('R', 'L')),
  quantity   integer not null check (quantity > 0),
  unit_cost  numeric(12,2) not null default 0 check (unit_cost >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now()
);

create index purchase_invoice_lines_invoice_idx
  on public.purchase_invoice_lines (purchase_invoice_id);
create index purchase_invoice_lines_product_idx
  on public.purchase_invoice_lines (product_id);


-- ------------------------------------------------ link the stock movements
alter table public.stock_movements
  add column if not exists purchase_invoice_id uuid
    references public.purchase_invoices(id) on delete restrict;

create index if not exists stock_movements_purchase_idx
  on public.stock_movements (purchase_invoice_id)
  where purchase_invoice_id is not null;


-- ------------------------------------------------------ totals for the list
create view public.purchase_invoice_totals with (security_invoker = true) as
select i.id, i.supplier_id, s.name as supplier_name,
       i.invoice_no, i.invoice_date, i.notes, i.created_at,
       count(l.id)::int                       as line_count,
       coalesce(sum(l.quantity), 0)::int      as total_qty,
       coalesce(sum(l.line_total), 0)         as total_amount
  from public.purchase_invoices i
  join public.suppliers s on s.id = i.supplier_id
  left join public.purchase_invoice_lines l on l.purchase_invoice_id = i.id
 group by i.id, s.name;


-- ------------------------------------------------------------ record_purchase
-- p_lines: [{ productId, sph, cyl, add, eye, qty, unitCost }, ...]
-- Blank unitCost falls back to the product's purchase price.
create or replace function public.record_purchase(
  p_supplier_id  uuid,
  p_invoice_no   text,
  p_invoice_date date,
  p_lines        jsonb,
  p_notes        text default null)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_no    text := btrim(coalesce(p_invoice_no, ''));
  v_inv   uuid;
  l       jsonb;
  p       record;
  v_sph   numeric;
  v_cyl   numeric;
  v_add   numeric;
  v_eye   text;
  v_qty   integer;
  v_cost  numeric;
  v_bin   uuid;
  v_count integer := 0;
  v_limit constant integer := 5000;
begin
  if v_no = '' then
    raise exception 'Enter the supplier''s invoice number.'
      using errcode = 'restrict_violation';
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one line to the purchase.'
      using errcode = 'restrict_violation';
  end if;

  if not exists (select 1 from suppliers
                  where id = p_supplier_id and deleted_at is null) then
    raise exception 'That supplier was not found.'
      using errcode = 'restrict_violation';
  end if;

  insert into purchase_invoices (supplier_id, invoice_no, invoice_date, notes)
  values (p_supplier_id, v_no,
          coalesce(p_invoice_date, (now() at time zone 'Asia/Karachi')::date),
          nullif(btrim(coalesce(p_notes, '')), ''))
  on conflict (supplier_id, lower(btrim(invoice_no))) do nothing
  returning id into v_inv;

  -- Already on file: this is the next product off the same paper invoice.
  if v_inv is null then
    select id into v_inv from purchase_invoices
     where supplier_id = p_supplier_id
       and lower(btrim(invoice_no)) = lower(v_no);
  end if;

  for l in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce(nullif(l->>'qty', '')::integer, 0);
    continue when v_qty = 0;

    if v_qty < 0 then
      raise exception 'Purchase quantities cannot be negative.'
        using errcode = 'restrict_violation';
    end if;

    v_count := v_count + 1;
    if v_count > v_limit then
      raise exception 'That is more than % lines in one go.', v_limit
        using errcode = 'restrict_violation';
    end if;

    select * into p from products
     where id = (l->>'productId')::uuid and deleted_at is null;
    if not found then
      raise exception 'A product on this purchase was not found, or has been archived.'
        using errcode = 'restrict_violation';
    end if;

    -- Powers only mean something on a lens; anything else is one bin.
    if p.tracks_power then
      v_sph := nullif(l->>'sph', '')::numeric;
      v_cyl := nullif(nullif(l->>'cyl', '')::numeric, 0);
      v_add := nullif(nullif(l->>'add', '')::numeric, 0);
      v_eye := nullif(btrim(coalesce(l->>'eye', '')), '');
      if v_sph is null then
        raise exception 'Enter the SPH for %.', p.name
          using errcode = 'restrict_violation';
      end if;
    else
      v_sph := null; v_cyl := null; v_add := null; v_eye := null;
    end if;

    v_cost := coalesce(nullif(l->>'unitCost', '')::numeric, p.purchase_price);
    if v_cost < 0 then
      raise exception 'A unit cost cannot be negative.'
        using errcode = 'restrict_violation';
    end if;

    insert into purchase_invoice_lines
      (purchase_invoice_id, product_id, product_name,
       sph, cyl, add_power, eye, quantity, unit_cost)
    values (v_inv, p.id, p.name, v_sph, v_cyl, v_add, v_eye, v_qty, v_cost);

    -- Services (coatings, tints) are billed, never held: no bin to move.
    continue when not p.tracks_stock;

    insert into stock_bins
      (product_id, tracks_power, sph, cyl, add_power, eye, qty_on_hand)
    values (p.id, p.tracks_power, v_sph, v_cyl, v_add, v_eye, v_qty)
    on conflict on constraint stock_bins_key_uq do update
      set qty_on_hand = stock_bins.qty_on_hand + v_qty,
          updated_at  = now()
    returning id into v_bin;

    insert into stock_movements (bin_id, delta, reason, note, purchase_invoice_id)
    values (v_bin, v_qty, 'purchase', 'Purchase ' || v_no, v_inv);
  end loop;

  if v_count = 0 then
    raise exception 'Enter a quantity on at least one line.'
      using errcode = 'restrict_violation';
  end if;

  return v_inv;
end $$;


-- ------------------------------------------------------------------- access
alter table public.suppliers              enable row level security;
alter table public.purchase_invoices      enable row level security;
alter table public.purchase_invoice_lines enable row level security;

create policy owner_all on public.suppliers
  for all to authenticated using (true) with check (true);

-- Append-only by omission, as with stock_movements: no UPDATE or DELETE.
create policy read   on public.purchase_invoices      for select to authenticated using (true);
create policy append on public.purchase_invoices      for insert to authenticated with check (true);
create policy read   on public.purchase_invoice_lines for select to authenticated using (true);
create policy append on public.purchase_invoice_lines for insert to authenticated with check (true);

revoke all on public.suppliers, public.purchase_invoices,
              public.purchase_invoice_lines, public.purchase_invoice_totals
  from anon;
grant select on public.purchase_invoice_totals to authenticated;

revoke all on function public.record_purchase(uuid, text, date, jsonb, text) from anon, public;
grant execute on function public.record_purchase(uuid, text, date, jsonb, text) to authenticated;
