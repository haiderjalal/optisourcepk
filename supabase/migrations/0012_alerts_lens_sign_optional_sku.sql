-- ============================================================================
-- Product-wide alert quantity, plus/minus lens type, and SKU made optional.
--
-- Alerts: a power that was never received has no stock bin, so the old
-- low_stock view — which only read bins — could not see it. A product can now
-- carry one alert quantity, and every SPH x CYL position in its declared range
-- that sits at or below it is reported, including positions with no bin at
-- all (0 on hand). A bin's own reorder level still applies; whichever of the
-- two is higher wins.
--
-- SKU: the owner does not use one. The column stays so existing rows and old
-- references keep their value, but it is no longer required or shown.
-- ============================================================================

alter table public.products alter column sku drop not null;

alter table public.products
  add column if not exists alert_qty integer
    check (alert_qty is null or alert_qty >= 0),
  add column if not exists lens_sign text
    check (lens_sign is null or lens_sign in ('plus', 'minus'));

comment on column public.products.alert_qty is
  'Warn when any power in the range is at or below this. NULL = no range-wide alert.';
comment on column public.products.lens_sign is
  'plus / minus lens. Drives placeholders and the order the power grid is laid out in.';


drop view if exists public.low_stock;

-- ponytail: positions are generated on every read. Fine for a shop-sized
-- catalogue; materialise it if a product ever declares a huge SPH x CYL range.
create view public.low_stock with (security_invoker = true) as
with held as (
  select b.id as bin_id, p.id as product_id, p.name, p.category,
         b.sph, b.cyl, b.add_power, b.eye, b.qty_on_hand,
         greatest(b.reorder_level, coalesce(p.alert_qty, 0)) as reorder_level
    from public.stock_bins b
    join public.products p on p.id = b.product_id
   where p.deleted_at is null
),
ranged as (
  select p.*,
         (p.cyl_min is not null and p.cyl_max is not null
          and coalesce(p.cyl_step, 0) > 0 and p.cyl_max >= p.cyl_min) as has_cyl
    from public.products p
   where p.deleted_at is null
     and p.tracks_stock and p.tracks_power
     and p.alert_qty is not null
     and p.sph_min is not null and p.sph_max is not null
     and coalesce(p.sph_step, 0) > 0 and p.sph_max >= p.sph_min
),
positions as (
  select r.id as product_id, r.name, r.category, r.alert_qty,
         r.sph_min + s.i * r.sph_step as sph,
         c.cyl
    from ranged r
   cross join lateral generate_series(
           0, floor((r.sph_max - r.sph_min) / r.sph_step)::int) as s(i)
   cross join lateral (
     -- A zero cylinder is stored as NULL, so it is the same position.
     select nullif(r.cyl_min + g.j * r.cyl_step, 0) as cyl
       from generate_series(
              0, floor((r.cyl_max - r.cyl_min) / r.cyl_step)::int) as g(j)
      where r.has_cyl
     union all
     select null::numeric where not r.has_cyl
   ) c
)
select h.bin_id, h.product_id, h.name, h.category,
       h.sph, h.cyl, h.add_power, h.eye,
       h.qty_on_hand, h.reorder_level,
       h.reorder_level - h.qty_on_hand as shortfall
  from held h
 where h.qty_on_hand <= h.reorder_level
union all
select null::uuid, pos.product_id, pos.name, pos.category,
       pos.sph, pos.cyl, null::numeric, null::text,
       0, pos.alert_qty, pos.alert_qty
  from positions pos
 where not exists (
         select 1 from public.stock_bins b
          where b.product_id = pos.product_id
            and b.sph = pos.sph
            and b.cyl is not distinct from pos.cyl);

grant select on public.low_stock to authenticated;
revoke all on public.low_stock from anon;


-- The invoice guard named the product with its SKU; with SKU optional that
-- printed "(<NULL>)". Also fixes 0008's balance lookup, which aliased
-- customers as `c` — the same name as the record variable — so Postgres
-- refused it as ambiguous and no invoice could be issued. Same function as
-- 0008 otherwise.
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
