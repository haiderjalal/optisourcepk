-- ============================================================================
-- Mixed stock orders: one order/invoice may draw some lines from permanent
-- stock bins and other lines from the separate daily stock register.
-- ============================================================================

alter table public.order_lines
  add column if not exists stock_source text not null default 'normal';

-- Preserve the meaning of daily orders created before this column existed.
-- Some are already invoiced, so use the same tightly scoped maintenance flag
-- used by reopen/restore; the freeze trigger remains active for normal writes.
do $$
begin
  perform set_config('app.invoice_maintenance', 'on', true);

  update public.order_lines l
     set stock_source = 'daily'
    from public.orders o
   where o.id = l.order_id
     and o.is_daily
     and l.stock_source = 'normal';

  perform set_config('app.invoice_maintenance', 'off', true);
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'order_lines_stock_source_valid'
       and conrelid = 'public.order_lines'::regclass
  ) then
    alter table public.order_lines
      add constraint order_lines_stock_source_valid
      check (stock_source in ('normal', 'daily'));
  end if;
end $$;

create index if not exists order_lines_order_source_idx
  on public.order_lines (order_id, stock_source);

comment on column public.order_lines.stock_source is
  'normal deducts from stock_bins; daily deducts from daily_stock_entries.';

-- Post only the daily lines. Product rows are locked in product-id order so
-- concurrent invoices cannot deadlock each other.
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
     where l.order_id = p_order_id and l.stock_source = 'daily'
     group by l.product_id
     order by l.product_id
  loop
    select * into e from daily_stock_entries
     where product_id = r.product_id and entry_date = v_day
     for update;

    if not found then
      select closing_qty into v_open from daily_stock_entries
       where product_id = r.product_id and entry_date < v_day
       order by entry_date desc limit 1;
      insert into daily_stock_entries
        (product_id, product_name, unit, entry_date, opening_qty)
      values (r.product_id, r.name, r.unit, v_day, coalesce(v_open, 0))
      returning * into e;
    end if;

    if e.opening_qty + e.received_qty - e.outgoing_qty < r.qty then
      raise exception
        'The daily register has only % % of % today, % needed. Add today''s received stock in the daily register first.',
        e.opening_qty + e.received_qty - e.outgoing_qty,
        r.unit, r.name, r.qty
        using errcode = 'restrict_violation';
    end if;

    update daily_stock_entries
       set outgoing_qty = outgoing_qty + r.qty
     where id = e.id;
    insert into daily_stock_postings (order_id, entry_id, qty)
    values (p_order_id, e.id, r.qty);
  end loop;
end $$;

grant execute on function public.post_daily_outgoing(uuid) to authenticated;

-- A mixed invoice also needs its daily lines returned on void. Calling the
-- reverse function for a normal-only invoice is harmless (there are no rows).
create or replace function public.release_daily_on_void() returns trigger
language plpgsql as $$
begin
  if new.voided_at is not null and old.voided_at is null then
    perform public.reverse_daily_outgoing(new.id);
  end if;
  return new;
end $$;

-- Same invoice transaction as 0031, now selecting normal and daily lines
-- independently. Either both inventories and the ledger commit, or none do.
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
       and l.rx_status is null
       and l.stock_source = 'normal'
     group by p.id, p.name, p.unit,
              l.sph, nullif(l.cyl, 0), nullif(l.add_power, 0), l.eye
     order by p.id, l.sph, nullif(l.cyl, 0), nullif(l.add_power, 0), l.eye
  loop
    v_bin := null;
    v_have := null;
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
        'No normal stock has been received for %. Open the product and receive some before invoicing.',
        r.product_name || case when v_desc = '' then '' else ' — ' || v_desc end
        using errcode = 'restrict_violation';
    end if;

    if v_have < r.qty then
      raise exception
        'Not enough normal stock of %: % % on hand, % needed.',
        r.product_name || case when v_desc = '' then '' else ' — ' || v_desc end,
        v_have, r.unit, r.qty
        using errcode = 'restrict_violation';
    end if;

    update stock_bins set qty_on_hand = qty_on_hand - r.qty, updated_at = now()
     where id = v_bin;
    insert into stock_movements (bin_id, delta, reason, order_id)
    values (v_bin, -r.qty, 'sale', p_order_id);
  end loop;

  if exists (
    select 1 from order_lines
     where order_id = p_order_id and stock_source = 'daily'
  ) then
    perform public.post_daily_outgoing(p_order_id);
  end if;

  select coalesce(sum(l.line_gross), 0),
         coalesce(sum(l.line_discount), 0),
         greatest(count(distinct l.order_ref), 1),
         coalesce(sum(l.quantity) filter
           (where p.tracks_power or p.is_rx or l.rx_status is not null), 0)
    into v_gross, v_disc, v_oqty, v_lqty
    from order_lines l join products p on p.id = l.product_id
   where l.order_id = p_order_id;

  v_net  := v_gross - v_disc + coalesce(p_freight, 0);
  v_gst  := round(v_net * p_gst_rate / 100, 2);
  v_add  := round(v_net * p_additional_tax_rate / 100, 2);
  v_incl := v_net + v_gst + v_add;

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
    insert into ledger_entries
      (customer_id, entry_date, entry_type, amount, order_id, memo)
    values
      (o.bill_to_customer_id,
       (o.issued_at at time zone 'Asia/Karachi')::date,
       'invoice', v_incl, o.id, 'Invoice ' || v_no);
  end if;

  return o;
end $$;

grant execute on function public.issue_invoice(uuid, numeric, numeric, numeric)
  to authenticated;

-- Keep the three businesses separate in the ledger totals. For a mixed
-- invoice, freight and tax are allocated in the same proportion as its line
-- totals so the daily + normal figures still add back to the invoice total.
create or replace view public.business_totals
with (security_invoker = true) as
with non_rx_invoices as (
  select o.id, o.amount_incl_tax,
         coalesce(sum(l.line_total) filter
           (where l.stock_source = 'normal'), 0) as normal_lines,
         coalesce(sum(l.line_total) filter
           (where l.stock_source = 'daily'), 0) as daily_lines,
         coalesce(sum(l.line_total), 0) as all_lines
    from public.orders o
    join public.order_lines l on l.order_id = o.id
   where o.issued_at is not null and o.voided_at is null
     and not (o.combines_rx or o.is_rx)
   group by o.id, o.amount_incl_tax
)
select
  (select coalesce(sum(
     case when all_lines = 0 then
       case when normal_lines > 0 or daily_lines = 0 then amount_incl_tax else 0 end
     else amount_incl_tax * normal_lines / all_lines end), 0)::numeric(14,2)
     from non_rx_invoices) as stock_sales,
  (select coalesce(sum(o.amount_incl_tax), 0)::numeric(14,2)
     from public.orders o
    where o.issued_at is not null and o.voided_at is null
      and (o.combines_rx or o.is_rx)) as rx_sales,
  (select coalesce(sum(l.line_total), 0)::numeric(14,2)
     from public.purchase_invoice_lines l) as stock_purchases,
  (select coalesce(sum(coalesce(l.unit_cost, 0) * l.quantity), 0)::numeric(14,2)
     from public.order_lines l
     join public.orders o on o.id = l.order_id
    where o.issued_at is not null and o.voided_at is null
      and (o.combines_rx or o.is_rx)
      and l.rx_status is not null) as rx_purchases,
  -- New columns are appended: CREATE OR REPLACE VIEW requires the existing
  -- four columns to keep their names and positions.
  (select coalesce(sum(
     case when all_lines = 0 then
       case when daily_lines > 0 then amount_incl_tax else 0 end
     else amount_incl_tax * daily_lines / all_lines end), 0)::numeric(14,2)
     from non_rx_invoices) as daily_sales,
  (select coalesce(sum(coalesce(l.unit_cost, 0) * l.quantity), 0)::numeric(14,2)
     from public.order_lines l
     join public.orders o on o.id = l.order_id
    where o.issued_at is not null and o.voided_at is null
      and not (o.combines_rx or o.is_rx)
      and l.stock_source = 'daily') as daily_purchases;

revoke all on public.business_totals from anon;
grant select on public.business_totals to authenticated;
