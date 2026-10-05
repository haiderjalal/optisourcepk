-- ============================================================================
-- Returns: a shop sends back items from an issued invoice.
--
-- The invoice stays exactly as it was issued — it is a statement of what was
-- sold on that date. A return is its own record (RET-0001 …) with the time,
-- the shop, the invoice and the lines that came back. Recording it, in one
-- transaction:
--   * puts each item back where it came from — the stock bin for a normal
--     line, today's daily register for a daily line (lab RX lenses and
--     services were never on the shelf, so nothing moves for them);
--   * credits the shop's account by the returned lines' value, as a ledger
--     adjustment linked to the invoice, so the statement shows it.
-- A return made by mistake can be undone, which reverses both. An invoice
-- that has returns cannot be edited, voided or deleted until they are undone,
-- so stock and balances can never be reversed twice.
-- ============================================================================

create sequence if not exists public.return_no_seq start 1;

create table public.sales_returns (
  id          uuid primary key default gen_random_uuid(),
  return_no   bigint not null unique default nextval('public.return_no_seq'),
  order_id    uuid not null references public.orders(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  returned_at timestamptz not null default now(),
  amount      numeric(12,2) not null check (amount >= 0),
  note        text check (note is null or char_length(note) <= 400),
  created_at  timestamptz not null default now()
);
create index sales_returns_order_idx    on public.sales_returns (order_id);
create index sales_returns_returned_idx on public.sales_returns (returned_at desc);

create table public.sales_return_lines (
  id             uuid primary key default gen_random_uuid(),
  return_id      uuid not null references public.sales_returns(id) on delete cascade,
  order_line_id  uuid not null references public.order_lines(id) on delete restrict,
  product_id     uuid not null references public.products(id) on delete restrict,
  product_name   text not null,
  unit           text not null,
  eye            text,
  sph            numeric(5,2),
  cyl            numeric(5,2),
  ax             integer,
  add_power      numeric(4,2),
  quantity       integer not null check (quantity > 0),
  unit_price     numeric(12,2) not null,
  amount         numeric(12,2) not null,
  stock_source   text not null default 'normal',
  -- Where the item went back to, so an undo takes it from the same place.
  bin_id         uuid references public.stock_bins(id) on delete restrict,
  daily_entry_id uuid references public.daily_stock_entries(id) on delete restrict
);
create index sales_return_lines_return_idx on public.sales_return_lines (return_id);
create index sales_return_lines_line_idx   on public.sales_return_lines (order_line_id);

alter table public.ledger_entries
  add column if not exists return_id uuid references public.sales_returns(id) on delete restrict;
alter table public.stock_movements
  add column if not exists return_id uuid references public.sales_returns(id) on delete set null;

-- Read freely; written only through the functions below.
alter table public.sales_returns      enable row level security;
alter table public.sales_return_lines enable row level security;
revoke all on public.sales_returns, public.sales_return_lines from anon, authenticated;
grant select on public.sales_returns, public.sales_return_lines to authenticated;
create policy read on public.sales_returns      for select to authenticated using (true);
create policy read on public.sales_return_lines for select to authenticated using (true);


-- ------------------------------------------------------------ record a return
-- p_lines: [{ "orderLineId": uuid, "qty": int }, ...]
create or replace function public.record_sales_return(
  p_order_id uuid,
  p_lines    jsonb,
  p_note     text default null)
returns public.sales_returns
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  o      public.orders;
  ret    public.sales_returns;
  e      jsonb;
  l      record;
  v_qty  integer;
  v_done integer;
  v_amt  numeric(12,2);
  v_bin  uuid;
  v_ent  public.daily_stock_entries;
  v_day  date := (now() at time zone 'Asia/Karachi')::date;
  v_open integer;
  v_total numeric(12,2) := 0;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Invoice was not found.'; end if;
  if o.issued_at is null then
    raise exception 'Only an issued invoice can have a return.'
      using errcode = 'restrict_violation';
  end if;
  if o.voided_at is not null then
    raise exception 'Invoice % is void, so nothing on it can be returned.', o.invoice_no
      using errcode = 'restrict_violation';
  end if;
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Pick the items that came back.' using errcode = 'restrict_violation';
  end if;

  insert into sales_returns (order_id, customer_id, amount, note)
  values (o.id, o.bill_to_customer_id, 0, nullif(btrim(coalesce(p_note, '')), ''))
  returning * into ret;

  for e in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce(nullif(e->>'qty', '')::integer, 0);
    continue when v_qty = 0;
    if v_qty < 0 then
      raise exception 'Return quantities cannot be negative.' using errcode = 'restrict_violation';
    end if;

    select ol.*, p.tracks_stock, p.tracks_power
      into l
      from order_lines ol join products p on p.id = ol.product_id
     where ol.id = (e->>'orderLineId')::uuid and ol.order_id = o.id;
    if not found then
      raise exception 'That item is not on invoice %.', o.invoice_no using errcode = 'restrict_violation';
    end if;

    select coalesce(sum(rl.quantity), 0) into v_done
      from sales_return_lines rl where rl.order_line_id = l.id;
    if v_done + v_qty > l.quantity then
      raise exception '% — only % of % can still be returned (% already returned).',
        l.product_name, l.quantity - v_done, l.quantity, v_done
        using errcode = 'restrict_violation';
    end if;

    -- The line's own value, discount included, for the quantity returned.
    v_amt := round(l.line_total * v_qty / l.quantity, 2);
    v_bin := null;
    v_ent := null;

    if l.rx_status is null and l.tracks_stock and l.stock_source = 'daily' then
      -- Back on today's daily register.
      select * into v_ent from daily_stock_entries
       where product_id = l.product_id and entry_date = v_day for update;
      if not found then
        select closing_qty into v_open from daily_stock_entries
         where product_id = l.product_id and entry_date < v_day
         order by entry_date desc limit 1;
        insert into daily_stock_entries (product_id, product_name, unit, entry_date, opening_qty)
        values (l.product_id, l.product_name, l.unit, v_day, coalesce(v_open, 0))
        returning * into v_ent;
      end if;
      update daily_stock_entries set received_qty = received_qty + v_qty where id = v_ent.id;

    elsif l.rx_status is null and l.tracks_stock then
      -- Back into the bin it was sold from: the exact shelf position, else
      -- the both-eyes bin at that power (as issuing falls back), else a new bin.
      select id into v_bin from stock_bins
       where product_id = l.product_id
         and sph is not distinct from (case when l.tracks_power then l.sph end)
         and cyl is not distinct from nullif(l.cyl, 0)
         and add_power is not distinct from nullif(l.add_power, 0)
         and eye is not distinct from l.eye
       for update;
      if v_bin is null and l.eye is not null then
        select id into v_bin from stock_bins
         where product_id = l.product_id
           and sph is not distinct from (case when l.tracks_power then l.sph end)
           and cyl is not distinct from nullif(l.cyl, 0)
           and add_power is not distinct from nullif(l.add_power, 0)
           and eye is null
         for update;
      end if;
      if v_bin is null then
        insert into stock_bins (product_id, tracks_power, sph, cyl, add_power, eye, qty_on_hand)
        values (l.product_id, l.tracks_power, case when l.tracks_power then l.sph end,
                nullif(l.cyl, 0), nullif(l.add_power, 0), l.eye, 0)
        returning id into v_bin;
      end if;
      update stock_bins set qty_on_hand = qty_on_hand + v_qty, updated_at = now()
       where id = v_bin;
      insert into stock_movements (bin_id, delta, reason, order_id, note, return_id)
      values (v_bin, v_qty, 'return', o.id,
              'Return RET-' || lpad(ret.return_no::text, 4, '0'), ret.id);
    end if;

    insert into sales_return_lines
      (return_id, order_line_id, product_id, product_name, unit, eye, sph, cyl, ax,
       add_power, quantity, unit_price, amount, stock_source, bin_id, daily_entry_id)
    values (ret.id, l.id, l.product_id, l.product_name, l.unit, l.eye, l.sph, l.cyl, l.ax,
            l.add_power, v_qty, l.unit_price, v_amt, l.stock_source, v_bin, v_ent.id);

    v_total := v_total + v_amt;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Enter how many of at least one item came back.'
      using errcode = 'restrict_violation';
  end if;

  update sales_returns set amount = v_total where id = ret.id returning * into ret;

  if v_total > 0 then
    insert into ledger_entries (customer_id, entry_date, entry_type, amount, order_id, memo, return_id)
    values (o.bill_to_customer_id, v_day, 'adjustment', -v_total, o.id,
            'Return RET-' || lpad(ret.return_no::text, 4, '0') || ' · Invoice ' || o.invoice_no,
            ret.id);
  end if;

  return ret;
end $$;


-- -------------------------------------------------------------- undo a return
create or replace function public.delete_sales_return(p_return_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  ret public.sales_returns;
  rl  record;
  v_have integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into ret from sales_returns where id = p_return_id for update;
  if not found then return false; end if;

  for rl in
    select * from sales_return_lines where return_id = ret.id order by id
  loop
    if rl.bin_id is not null then
      select qty_on_hand into v_have from stock_bins where id = rl.bin_id for update;
      if v_have < rl.quantity then
        raise exception
          'RET-% cannot be undone: % of the returned % has been sold again (% left on the shelf).',
          lpad(ret.return_no::text, 4, '0'), rl.quantity - v_have, rl.product_name, v_have
          using errcode = 'restrict_violation';
      end if;
      update stock_bins set qty_on_hand = qty_on_hand - rl.quantity, updated_at = now()
       where id = rl.bin_id;
      insert into stock_movements (bin_id, delta, reason, order_id, note)
      values (rl.bin_id, -rl.quantity, 'adjustment', ret.order_id,
              'Return RET-' || lpad(ret.return_no::text, 4, '0') || ' undone');
    elsif rl.daily_entry_id is not null then
      update daily_stock_entries set received_qty = received_qty - rl.quantity
       where id = rl.daily_entry_id
         and opening_qty + received_qty - outgoing_qty >= rl.quantity;
      if not found then
        raise exception
          'RET-% cannot be undone: the returned % has been used in the daily register since.',
          lpad(ret.return_no::text, 4, '0'), rl.product_name
          using errcode = 'restrict_violation';
      end if;
    end if;
  end loop;

  delete from ledger_entries where return_id = ret.id;
  delete from sales_returns where id = ret.id;  -- lines cascade
  return true;
end $$;

revoke all on function public.record_sales_return(uuid, jsonb, text) from public, anon;
revoke all on function public.delete_sales_return(uuid) from public, anon;
grant execute on function public.record_sales_return(uuid, jsonb, text) to authenticated;
grant execute on function public.delete_sales_return(uuid) to authenticated;


-- ------------------------------------- an invoice with returns stays as issued
-- Editing, voiding or deleting it would reverse its stock and ledger postings
-- on top of the returns'. Undo the returns first.
create or replace function public.guard_returned_invoice() returns trigger
language plpgsql as $$
begin
  if exists (select 1 from public.sales_returns r where r.order_id = old.id)
     and (tg_op = 'DELETE'
          or (old.issued_at is not null and new.issued_at is null)
          or (old.voided_at is null and new.voided_at is not null)) then
    raise exception
      'Invoice % has returns. Undo them on the Returns page before editing, voiding or deleting the invoice.',
      old.invoice_no
      using errcode = 'restrict_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists orders_guard_returns on public.orders;
create trigger orders_guard_returns
  before update of issued_at, voided_at or delete on public.orders
  for each row execute function public.guard_returned_invoice();
