-- ============================================================================
-- Daily orders: a sale invoiced straight from the daily stock register.
--
-- A daily order is an ordinary order (shop, order by, deliver to, lines with
-- power, sale and purchase price) flagged is_daily. Issuing it does not touch
-- the stock bins; instead each product's quantity is added to today's
-- "outgoing" in daily_stock_entries (0029), and recorded in
-- daily_stock_postings so a void, reopen or delete can give it back exactly.
--
-- Requires 0029_daily_stock_register.sql.
-- ============================================================================

alter table public.orders
  add column if not exists is_daily boolean not null default false;

comment on column public.orders.is_daily is
  'A daily order: invoiced from the daily stock register, not the stock bins.';

create table if not exists public.daily_stock_postings (
  id       uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  entry_id uuid not null references public.daily_stock_entries(id) on delete restrict,
  qty      integer not null check (qty > 0),
  created_at timestamptz not null default now()
);
create index if not exists daily_stock_postings_order_idx
  on public.daily_stock_postings (order_id);

alter table public.daily_stock_postings enable row level security;
revoke all on table public.daily_stock_postings from anon, authenticated;
grant select, insert, delete on table public.daily_stock_postings to authenticated;
drop policy if exists daily_postings_all on public.daily_stock_postings;
create policy daily_postings_all on public.daily_stock_postings
  for all to authenticated using (true) with check (true);

-- Add a daily order's items to today's outgoing, one register row per product.
create or replace function public.post_daily_outgoing(p_order_id uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  r record;
  e public.daily_stock_entries;
  v_day date := (now() at time zone 'Asia/Karachi')::date;
  v_open integer;
begin
  for r in
    select l.product_id, max(l.product_name) as name, max(l.unit) as unit,
           sum(l.quantity)::int as qty
      from order_lines l
     where l.order_id = p_order_id
     group by l.product_id
     order by l.product_id
  loop
    select * into e from daily_stock_entries
     where product_id = r.product_id and entry_date = v_day
     for update;

    if not found then
      -- Today starts where the last day closed, as the register form does.
      select closing_qty into v_open from daily_stock_entries
       where product_id = r.product_id and entry_date < v_day
       order by entry_date desc limit 1;
      insert into daily_stock_entries (product_id, product_name, unit, entry_date, opening_qty)
      values (r.product_id, r.name, r.unit, v_day, coalesce(v_open, 0))
      returning * into e;
    end if;

    if e.opening_qty + e.received_qty - e.outgoing_qty < r.qty then
      raise exception
        'The daily register has only % % of % today, % needed. Add today''s received stock in the daily register first.',
        e.opening_qty + e.received_qty - e.outgoing_qty, r.unit, r.name, r.qty
        using errcode = 'restrict_violation';
    end if;

    update daily_stock_entries set outgoing_qty = outgoing_qty + r.qty
     where id = e.id;
    insert into daily_stock_postings (order_id, entry_id, qty)
    values (p_order_id, e.id, r.qty);
  end loop;
end $$;

grant execute on function public.post_daily_outgoing(uuid) to authenticated;

-- Give a daily order's items back to the register days they came from.
create or replace function public.reverse_daily_outgoing(p_order_id uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare r record;
begin
  for r in
    select entry_id, sum(qty)::int as qty from daily_stock_postings
     where order_id = p_order_id group by entry_id order by entry_id
  loop
    update daily_stock_entries
       set outgoing_qty = greatest(outgoing_qty - r.qty, 0)
     where id = r.entry_id;
  end loop;
  delete from daily_stock_postings where order_id = p_order_id;
end $$;

grant execute on function public.reverse_daily_outgoing(uuid) to authenticated;

-- Reopen and delete go through reverse_invoice_posting: give the register
-- back there too. Same as 0026 otherwise.
create or replace function public.reverse_invoice_posting(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp as $$
declare r record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  for r in
    select bin_id, sum(delta)::integer as net_delta
      from public.stock_movements
     where order_id = p_order_id
     group by bin_id
     order by bin_id
  loop
    if r.net_delta <> 0 then
      update public.stock_bins
         set qty_on_hand = qty_on_hand - r.net_delta,
             updated_at = now()
       where id = r.bin_id;
    end if;
  end loop;

  delete from public.stock_movements where order_id = p_order_id;
  delete from public.ledger_entries where order_id = p_order_id;
  perform public.reverse_daily_outgoing(p_order_id);
end $$;

revoke all on function public.reverse_invoice_posting(uuid) from public;

-- A void keeps the invoice but takes back what it moved: for a daily order,
-- the register's outgoing.
create or replace function public.release_daily_on_void() returns trigger
language plpgsql as $$
begin
  if new.is_daily and new.voided_at is not null and old.voided_at is null then
    perform public.reverse_daily_outgoing(new.id);
  end if;
  return new;
end $$;

drop trigger if exists orders_release_daily on public.orders;
create trigger orders_release_daily after update of voided_at on public.orders
  for each row execute function public.release_daily_on_void();

-- Daily orders skip the stock bins and post to the daily register. Same
-- function as 0025 otherwise.
create or replace function public.issue_invoice(
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
  v_prev numeric(12,2);
  v_desc text;
begin
  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'Order % was not found.', p_order_id; end if;
  if o.issued_at is not null then
    raise exception 'Order % is already invoice %.', o.order_no, o.invoice_no; end if;
  if o.status = 'cancelled' then
    raise exception 'Order % is cancelled.', o.order_no; end if;
  if not exists (select 1 from order_lines where order_id = p_order_id) then
    raise exception 'Order % has no lines.', o.order_no; end if;
  if o.is_rx then
    raise exception 'RX orders are invoiced together, one invoice per shop: open RX orders and use Generate invoice under Ready to invoice.'
      using errcode = 'restrict_violation';
  end if;

  select * into c from customers where id = o.bill_to_customer_id;

  for r in
    select p.id as product_id, p.name as product_name, p.unit,
           l.sph,
           nullif(l.cyl, 0)       as cyl,
           nullif(l.add_power, 0) as add_power,
           l.eye,
           sum(l.quantity)::int as qty
      from order_lines l join products p on p.id = l.product_id
     where l.order_id = p_order_id and p.tracks_stock
       and l.rx_status is null            -- RX lenses come from a lab, not the shelf
       and not o.is_daily                 -- daily orders draw on the daily register
     group by p.id, p.name, p.unit,
              l.sph, nullif(l.cyl, 0), nullif(l.add_power, 0), l.eye
     order by p.id, l.sph, nullif(l.cyl, 0), nullif(l.add_power, 0), l.eye
  loop
    v_desc := concat_ws(' ',
      case when r.sph is null then null
           else format('SPH %s%s', case when r.sph > 0 then '+' else '' end,
                       trim(to_char(r.sph, 'FM990.00'))) end,
      case when r.cyl is null then null
           else format('CYL %s%s', case when r.cyl > 0 then '+' else '' end,
                       trim(to_char(r.cyl, 'FM990.00'))) end,
      case when r.add_power is null then null
           else format('ADD +%s', trim(to_char(r.add_power, 'FM990.00'))) end,
      case when r.eye is null then null else format('(%s)', r.eye) end);

    select b.id, b.qty_on_hand into v_bin, v_have
      from stock_bins b
     where b.product_id = r.product_id
       and b.sph       is not distinct from r.sph
       and b.cyl       is not distinct from r.cyl
       and b.add_power is not distinct from r.add_power
       and b.eye       is not distinct from r.eye
     for update;

    -- Stock received for both eyes at this exact power.
    if v_bin is null and r.eye is not null then
      select b.id, b.qty_on_hand into v_bin, v_have
        from stock_bins b
       where b.product_id = r.product_id
         and b.sph       is not distinct from r.sph
         and b.cyl       is not distinct from r.cyl
         and b.add_power is not distinct from r.add_power
         and b.eye is null
       for update;
    end if;

    if v_bin is null then
      select b.id, b.qty_on_hand into v_bin, v_have
        from stock_bins b
       where b.product_id = r.product_id
         and b.sph is not distinct from r.sph
         and b.cyl is null and b.add_power is null and b.eye is null
       for update;
    end if;

    if v_bin is null then
      raise exception
        'No stock has been received for %. Open the product and receive some before invoicing.',
        r.product_name ||
        case when v_desc = '' then '' else ' — ' || v_desc end
        using errcode = 'restrict_violation';
    end if;

    if v_have < r.qty then
      raise exception
        'Not enough stock of %: % % on hand, % needed.',
        r.product_name ||
        case when v_desc = '' then '' else ' — ' || v_desc end,
        v_have, r.unit, r.qty
        using errcode = 'restrict_violation';
    end if;

    update stock_bins set qty_on_hand = qty_on_hand - r.qty, updated_at = now()
     where id = v_bin;
    insert into stock_movements (bin_id, delta, reason, order_id)
    values (v_bin, -r.qty, 'sale', p_order_id);
  end loop;

  if o.is_daily then
    perform public.post_daily_outgoing(p_order_id);
  end if;

  select coalesce(sum(l.line_gross), 0),
         coalesce(sum(l.line_discount), 0),
         greatest(count(distinct l.order_ref), 1),
         coalesce(sum(l.quantity) filter (where p.tracks_power or p.is_rx or l.rx_status is not null), 0)
    into v_gross, v_disc, v_oqty, v_lqty
    from order_lines l join products p on p.id = l.product_id
   where l.order_id = p_order_id;

  v_net  := v_gross - v_disc + coalesce(p_freight, 0);
  v_gst  := round(v_net * p_gst_rate / 100, 2);
  v_add  := round(v_net * p_additional_tax_rate / 100, 2);
  v_incl := v_net + v_gst + v_add;

  -- Read the account BEFORE this invoice's own entry is posted. Same
  -- arithmetic as customer_balances, so the invoice and the statement agree.
  select cu.opening_balance + coalesce(sum(l.amount), 0)
    into v_prev
    from customers cu
    left join ledger_entries l on l.customer_id = cu.id
   where cu.id = o.bill_to_customer_id
   group by cu.opening_balance;

  v_prev := coalesce(v_prev, 0);

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
     amount_incl_tax = v_incl,
     previous_balance = v_prev,
     closing_balance  = v_prev + v_incl
   where id = p_order_id returning * into o;

  if v_incl <> 0 then
    insert into ledger_entries (customer_id, entry_date, entry_type, amount, order_id, memo)
    values (o.bill_to_customer_id, (o.issued_at at time zone 'Asia/Karachi')::date,
            'invoice', v_incl, o.id, 'Invoice ' || v_no);
  end if;

  return o;
end $$;

grant execute on function public.issue_invoice(uuid, numeric, numeric, numeric) to authenticated;
