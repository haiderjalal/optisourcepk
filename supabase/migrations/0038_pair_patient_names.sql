-- ============================================================================
-- A patient name on each invoice line, so every pair says who it is for.
--
-- The invoice builder sets it on both lines of an R + L pair, and it prints in
-- front of the pair. A combined invoice copies it from its lines (normal
-- orders) or from each RX job's patient (RX orders).
-- ============================================================================

alter table public.order_lines
  add column if not exists patient_name text;

alter table public.order_lines drop constraint if exists order_lines_patient_name_length;
alter table public.order_lines add constraint order_lines_patient_name_length
  check (patient_name is null or length(patient_name) <= 120);

comment on column public.order_lines.patient_name is
  'The patient this lens pair is for. Printed in front of the pair; null when not given.';

-- The two combine functions, as they stand in 0035 and 0025, with the patient
-- name carried onto the copied lines.

create or replace function public.issue_orders_invoice(
  p_customer_id uuid,
  p_order_ids   uuid[],
  p_freight numeric default 0,
  p_gst_rate numeric default 0,
  p_additional_tax_rate numeric default 0)
returns public.orders
language plpgsql security invoker set search_path = public as $$
declare
  v_ids     uuid[];
  v_list    text;
  v_daily   boolean;
  v_urgent  boolean;
  v_invoice uuid;
begin
  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    raise exception 'Tick at least one order to invoice.'
      using errcode = 'restrict_violation';
  end if;

  -- Lock the chosen orders, in a fixed order so two clicks cannot deadlock.
  select array_agg(id order by order_no),
         string_agg(order_no::text, ', ' order by order_no),
         bool_and(is_daily),
         bool_or(priority = 'urgent')
    into v_ids, v_list, v_daily, v_urgent
    from (select id, order_no, is_daily, priority from orders
           where id = any(p_order_ids)
             and bill_to_customer_id = p_customer_id
             and not is_rx and not combines_rx and not combines_orders
             and issued_at is null and voided_at is null and billed_in is null
             and status <> 'cancelled'
           order by order_no
           for update) ready;

  if v_ids is null or cardinality(v_ids) <> cardinality(array(select distinct unnest(p_order_ids))) then
    raise exception 'Some of those orders are already invoiced, cancelled, or belong to another shop. Refresh the page and try again.'
      using errcode = 'restrict_violation';
  end if;

  if exists (select 1 from unnest(v_ids) i
              where not exists (select 1 from order_lines l where l.order_id = i)) then
    raise exception 'One of those orders has no lines. Add its items or leave it out.'
      using errcode = 'restrict_violation';
  end if;

  insert into orders (bill_to_customer_id, combines_orders, is_daily, priority, notes)
  values (p_customer_id, true, coalesce(v_daily, false),
          case when v_urgent then 'urgent'::order_priority else 'normal'::order_priority end,
          'Orders: ' || v_list)
  returning id into v_invoice;

  insert into order_lines (order_id, line_no, order_ref, product_id, product_name, unit,
                           eye, sph, cyl, ax, add_power, unit_price, discount_pct, quantity,
                           unit_cost, supplier_id, stock_source, patient_name)
  select v_invoice,
         row_number() over (order by o.order_no, l.line_no),
         coalesce(nullif(btrim(l.order_ref), ''), nullif(btrim(o.external_order_ref), ''),
                  o.order_no::text),
         l.product_id, l.product_name, l.unit,
         l.eye, l.sph, l.cyl, l.ax, l.add_power, l.unit_price, l.discount_pct, l.quantity,
         l.unit_cost, l.supplier_id, l.stock_source, l.patient_name
    from order_lines l join orders o on o.id = l.order_id
   where o.id = any(v_ids);

  update orders set billed_in = v_invoice where id = any(v_ids);

  -- Stock, daily register, totals, number and ledger: one transaction.
  return public.issue_invoice(v_invoice, p_freight, p_gst_rate, p_additional_tax_rate);
end $$;

revoke all on function public.issue_orders_invoice(uuid, uuid[], numeric, numeric, numeric) from public, anon;
grant execute on function public.issue_orders_invoice(uuid, uuid[], numeric, numeric, numeric) to authenticated;

-- Invoice every ready RX order of one shop, together.
create or replace function public.issue_rx_invoice(
  p_customer_id uuid,
  p_freight numeric default 0,
  p_gst_rate numeric default 0,
  p_additional_tax_rate numeric default 0)
returns public.orders
language plpgsql security invoker set search_path = public as $$
declare
  v_ids uuid[];
  v_unpriced bigint;
  v_invoice uuid;
  v_list text;
begin
  select array_agg(id order by rx_no), string_agg('RX-' || lpad(rx_no::text, 4, '0'), ', ' order by rx_no)
    into v_ids, v_list
    from (select id, rx_no from orders
           where bill_to_customer_id = p_customer_id and is_rx
             and issued_at is null and voided_at is null and billed_in is null
             and rx_stage = 'back'
           for update) ready;

  if v_ids is null then
    raise exception 'No RX orders for this shop are ready to invoice. An RX order is ready once it is back from the lab and priced.'
      using errcode = 'restrict_violation';
  end if;

  select min(o.rx_no) into v_unpriced
    from orders o join order_lines l on l.order_id = o.id
   where o.id = any(v_ids) and l.unit_price <= 0;
  if v_unpriced is not null then
    raise exception 'RX-% has no sale price yet. Enter its prices, then generate the invoice.',
      lpad(v_unpriced::text, 4, '0') using errcode = 'restrict_violation';
  end if;

  insert into orders (bill_to_customer_id, combines_rx, notes)
  values (p_customer_id, true, 'RX orders: ' || v_list)
  returning id into v_invoice;

  insert into order_lines (order_id, line_no, order_ref, product_id, product_name, unit,
                           eye, sph, cyl, ax, add_power, unit_price, discount_pct, quantity,
                           unit_cost, supplier_id, rx_status, received_at, rx_prism, rx_ipd,
                           patient_name)
  select v_invoice,
         row_number() over (order by o.rx_no, l.line_no),
         concat_ws(' · ', nullif(btrim(o.external_order_ref), ''),
                   'RX-' || lpad(o.rx_no::text, 4, '0')),
         l.product_id, l.product_name, l.unit,
         l.eye, l.sph, l.cyl, l.ax, l.add_power, l.unit_price, l.discount_pct, l.quantity,
         l.unit_cost, l.supplier_id, 'received', coalesce(l.received_at, now()),
         l.rx_prism, l.rx_ipd, o.patient_name
    from order_lines l join orders o on o.id = l.order_id
   where o.id = any(v_ids);

  update orders set billed_in = v_invoice where id = any(v_ids);

  return public.issue_invoice(v_invoice, p_freight, p_gst_rate, p_additional_tax_rate);
end $$;

grant execute on function public.issue_rx_invoice(uuid, numeric, numeric, numeric) to authenticated;
