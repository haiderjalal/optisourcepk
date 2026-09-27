-- ============================================================================
-- RX orders: lenses made to a prescription, ordered from a lab per job.
--
-- An RX order is an ordinary order whose lines use an RX product. RX products
-- hold no stock, so issuing the invoice never checks or deducts a bin. Each RX
-- line carries what the lens cost us and who made it, and moves from
-- 'ordered' to 'received' when the lens comes back from the lab. Delivery to
-- the customer is the order's own dispatched / delivered status.
--
-- The cost and receipt fields stay editable after the invoice is issued: the
-- lab's bill and the lens itself often arrive after the customer is billed,
-- and neither changes a figure on the invoice.
-- ============================================================================

alter table public.products
  add column if not exists is_rx boolean not null default false;

alter table public.products drop constraint if exists products_rx_no_stock;
alter table public.products
  add constraint products_rx_no_stock check (not is_rx or not tracks_stock);

comment on column public.products.is_rx is
  'Made to order per prescription (RX). Never stocked; lines track the lab job instead.';

alter table public.order_lines
  add column if not exists unit_cost   numeric(12,2),
  add column if not exists supplier_id uuid references public.suppliers(id) on delete restrict,
  add column if not exists rx_status   text,
  add column if not exists received_at timestamptz;

alter table public.order_lines drop constraint if exists order_lines_unit_cost_valid;
alter table public.order_lines
  add constraint order_lines_unit_cost_valid check (unit_cost is null or unit_cost >= 0);
alter table public.order_lines drop constraint if exists order_lines_rx_status_valid;
alter table public.order_lines
  add constraint order_lines_rx_status_valid check (rx_status in ('ordered', 'received'));
alter table public.order_lines drop constraint if exists order_lines_received_pair;
alter table public.order_lines
  add constraint order_lines_received_pair check (
    (rx_status = 'received') = (received_at is not null) or rx_status is null);

comment on column public.order_lines.unit_cost is
  'What one unit cost us (RX: the lab price). Never printed on the invoice.';
comment on column public.order_lines.rx_status is
  'RX lines only: ordered from the lab, or received back. NULL for everything else.';

-- The RX screen searches open jobs by power.
create index if not exists order_lines_rx_idx
  on public.order_lines (rx_status, sph, cyl, add_power) where rx_status is not null;

-- Issued lines stay frozen, except for the RX tracking fields.
create or replace function public.freeze_issued_lines() returns trigger
language plpgsql as $$
declare
  v_order uuid;
  -- The generated totals are not computed yet in a BEFORE trigger, so NEW
  -- has them blank; they follow from columns that are compared anyway.
  tracking text[] := array['unit_cost','supplier_id','rx_status','received_at','updated_at',
                           'line_gross','line_discount','line_total'];
begin
  v_order := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
  if exists (select 1 from public.orders o where o.id = v_order and o.issued_at is not null) then
    if tg_op = 'UPDATE'
       and (to_jsonb(new) - tracking) is not distinct from (to_jsonb(old) - tracking) then
      return new;
    end if;
    raise exception 'Cannot change the lines of an issued invoice.'
      using errcode = 'restrict_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- RX sales, cost and profit per month, by the month the invoice was issued.
-- Sales are line totals after discount, before freight and tax — the same
-- figure the line shows. A line with no cost entered counts as zero cost and
-- is counted in missing_cost so the gap is visible.
create or replace view public.rx_monthly with (security_invoker = true) as
select date_trunc('month', o.issued_at at time zone 'Asia/Karachi')::date as month,
       count(*)::int                                            as lines,
       coalesce(sum(l.quantity), 0)::int                        as lenses,
       coalesce(sum(l.line_total), 0)::numeric(12,2)            as sales,
       coalesce(sum(coalesce(l.unit_cost, 0) * l.quantity), 0)::numeric(12,2) as cost,
       coalesce(sum(l.line_total - coalesce(l.unit_cost, 0) * l.quantity), 0)::numeric(12,2) as profit,
       (count(*) filter (where l.unit_cost is null))::int       as missing_cost
  from public.order_lines l
  join public.orders o on o.id = l.order_id
 where l.rx_status is not null
   and o.issued_at is not null
   and o.voided_at is null
 group by 1;

grant select on public.rx_monthly to authenticated;

-- Lens Qty on the invoice counts RX lenses too. Same function as 0018 otherwise.
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

  select coalesce(sum(l.line_gross), 0),
         coalesce(sum(l.line_discount), 0),
         greatest(count(distinct l.order_ref), 1),
         coalesce(sum(l.quantity) filter (where p.tracks_power or p.is_rx), 0)
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
