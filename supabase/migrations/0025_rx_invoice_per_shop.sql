-- ============================================================================
-- One RX invoice per shop: every RX order that is ready goes on one invoice.
--
-- An RX order stays the job — its RX number, patient, lab stage — but it is no
-- longer invoiced on its own. issue_rx_invoice gathers a shop's RX orders that
-- are back from the lab and priced, copies their lenses onto one new invoice
-- (reference "9493 · RX-0006": the optician's order number and ours), issues
-- it, and marks each RX order billed_in that invoice. One ledger entry, one
-- invoice number.
--
-- Billed RX orders are locked like issued ones. Voiding the combined invoice
-- releases them, so they can be invoiced again.
-- ============================================================================

alter table public.orders
  add column if not exists billed_in   uuid references public.orders(id) on delete restrict,
  add column if not exists combines_rx boolean not null default false;

create index if not exists orders_billed_in_idx
  on public.orders (billed_in) where billed_in is not null;

comment on column public.orders.billed_in is
  'RX order only: the combined invoice it was billed on.';
comment on column public.orders.combines_rx is
  'A combined RX invoice: its lines are copies of the RX orders billed in it.';

-- An RX order billed on a combined invoice is as fixed as an issued one;
-- billed_in itself may change, so a void can release it.
create or replace function public.freeze_issued_order() returns trigger
language plpgsql as $$
declare mutable text[] := array['status','dispatched_at','delivered_at','delivered_by',
                                'delivery_note','courier_name','tracking_no',
                                'voided_at','void_reason','notes','updated_at',
                                'rx_no','rx_stage','rx_sent_at','rx_back_at','billed_in'];
begin
  if old.issued_at is null and old.billed_in is null then return new; end if;
  if (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable) then
    raise exception 'This order has been invoiced. Void the invoice and raise a new one instead of editing.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

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
  if exists (select 1 from public.orders o
              where o.id = v_order and (o.issued_at is not null or o.billed_in is not null)) then
    if tg_op = 'UPDATE'
       and (to_jsonb(new) - tracking) is not distinct from (to_jsonb(old) - tracking) then
      return new;
    end if;
    raise exception 'Cannot change the lines of an invoiced order.'
      using errcode = 'restrict_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- The lab stage is final once billed, as once issued.
create or replace function public.set_rx_stage(p_order_id uuid, p_stage text)
returns public.orders
language plpgsql security invoker set search_path = public as $$
declare o public.orders;
begin
  if p_stage not in ('booked', 'sent', 'back') then
    raise exception 'Unknown RX stage %.', p_stage;
  end if;

  select * into o from orders where id = p_order_id for update;
  if not found or not o.is_rx then
    raise exception 'That is not an RX order.' using errcode = 'restrict_violation';
  end if;
  if o.issued_at is not null or o.voided_at is not null or o.billed_in is not null then
    raise exception 'RX-% is already invoiced, so its lab stage is final.',
      lpad(o.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;

  update orders set
     rx_stage   = p_stage,
     rx_sent_at = case when p_stage = 'booked' then null
                       else coalesce(rx_sent_at, now()) end,
     rx_back_at = case when p_stage = 'back' then coalesce(rx_back_at, now()) end
   where id = p_order_id returning * into o;

  update order_lines set
     rx_status   = case when p_stage = 'back' then 'received' else 'ordered' end,
     received_at = case when p_stage = 'back' then o.rx_back_at end
   where order_id = p_order_id and rx_status is not null;

  return o;
end $$;

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
                           unit_cost, supplier_id, rx_status, received_at, rx_prism, rx_ipd)
  select v_invoice,
         row_number() over (order by o.rx_no, l.line_no),
         concat_ws(' · ', nullif(btrim(o.external_order_ref), ''),
                   'RX-' || lpad(o.rx_no::text, 4, '0')),
         l.product_id, l.product_name, l.unit,
         l.eye, l.sph, l.cyl, l.ax, l.add_power, l.unit_price, l.discount_pct, l.quantity,
         l.unit_cost, l.supplier_id, 'received', coalesce(l.received_at, now()),
         l.rx_prism, l.rx_ipd
    from order_lines l join orders o on o.id = l.order_id
   where o.id = any(v_ids);

  update orders set billed_in = v_invoice where id = any(v_ids);

  return public.issue_invoice(v_invoice, p_freight, p_gst_rate, p_additional_tax_rate);
end $$;

grant execute on function public.issue_rx_invoice(uuid, numeric, numeric, numeric) to authenticated;

-- Voiding a combined invoice puts its RX orders back to "ready".
create or replace function public.release_rx_orders() returns trigger
language plpgsql as $$
begin
  if new.combines_rx and new.voided_at is not null and old.voided_at is null then
    update public.orders set billed_in = null where billed_in = new.id;
  end if;
  return new;
end $$;

drop trigger if exists orders_release_rx on public.orders;
create trigger orders_release_rx after update of voided_at on public.orders
  for each row execute function public.release_rx_orders();

-- issue_invoice now refuses an RX order on its own; they go through
-- issue_rx_invoice. Same function as 0021 otherwise.
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
