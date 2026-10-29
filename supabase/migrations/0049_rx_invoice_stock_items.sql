-- ============================================================================
-- An RX order can hold stock items for the same patient, billed with its lenses.
--
-- A lens line has a lab status (rx_status), set when the RX order is booked.
-- A stock item on the same order has none, so it is billed as a normal stock
-- sale: issue_invoice takes it off the shelf, the way it does any normal line.
--
-- Migration 0038's copy marked every copied line as received from the lab. It
-- now marks only the lens lines, and keeps each line's stock source.
-- ============================================================================

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
                           unit_cost, supplier_id, stock_source, rx_status, received_at,
                           rx_prism, rx_ipd, patient_name)
  select v_invoice,
         row_number() over (order by o.rx_no, l.line_no),
         concat_ws(' · ', nullif(btrim(o.external_order_ref), ''),
                   'RX-' || lpad(o.rx_no::text, 4, '0')),
         l.product_id, l.product_name, l.unit,
         l.eye, l.sph, l.cyl, l.ax, l.add_power, l.unit_price, l.discount_pct, l.quantity,
         l.unit_cost, l.supplier_id, l.stock_source,
         case when l.rx_status is null then null else 'received' end,
         case when l.rx_status is null then null else coalesce(l.received_at, now()) end,
         l.rx_prism, l.rx_ipd, o.patient_name
    from order_lines l join orders o on o.id = l.order_id
   where o.id = any(v_ids);

  update orders set billed_in = v_invoice where id = any(v_ids);

  return public.issue_invoice(v_invoice, p_freight, p_gst_rate, p_additional_tax_rate);
end $$;

grant execute on function public.issue_rx_invoice(uuid, numeric, numeric, numeric) to authenticated;
