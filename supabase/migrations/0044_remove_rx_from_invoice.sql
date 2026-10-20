-- ============================================================================
-- Take one RX order off its shop's combined invoice, and recalculate it.
--
-- A combined RX invoice carries a copy of every lens billed on it. When one RX
-- order was billed by mistake (a duplicate, say), its copies come off the
-- invoice, the invoice total is worked out again from what remains, and the
-- shop's account is credited with the difference. The invoice keeps its number
-- and date.
--
-- Later invoices of the same shop store their previous and closing balances, so
-- they move by the same amount. Their printed balances then agree with the
-- statement. RX lines never touch stock, so nothing is restocked here.
--
-- The RX order is released and left uninvoiced; the app then moves it to
-- Recently deleted. Refused when the invoice is voided, when the lens has a sales
-- return, or when it is the only lens on the invoice (void the invoice instead).
-- ============================================================================

create or replace function public.remove_rx_from_invoice(p_rx_order_id uuid)
returns public.orders
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  rx public.orders;
  inv public.orders;
  v_pattern text;
  v_old_incl numeric(12,2);
  v_removed_lines int;
  v_gross numeric(12,2);
  v_disc numeric(12,2);
  v_net numeric(12,2);
  v_gst numeric(12,2);
  v_add numeric(12,2);
  v_incl numeric(12,2);
  v_order_qty int;
  v_lens_qty int;
  v_list text;
  v_delta numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into rx from public.orders where id = p_rx_order_id for update;
  if not found or not rx.is_rx then
    raise exception 'That is not an RX order.' using errcode = 'restrict_violation';
  end if;
  if rx.billed_in is null then
    raise exception 'RX-% is not on an invoice. Delete it from the RX orders instead.',
      lpad(rx.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;

  select * into inv from public.orders where id = rx.billed_in for update;
  if inv.voided_at is not null then
    raise exception 'The invoice for RX-% is voided, so it cannot be changed.',
      lpad(rx.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;
  if inv.issued_at is null then
    raise exception 'The invoice for RX-% is not issued, so it cannot be changed.',
      lpad(rx.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;

  -- A combined invoice's lines carry the RX number at the end of order_ref.
  v_pattern := '%RX-' || lpad(rx.rx_no::text, 4, '0');
  v_old_incl := inv.amount_incl_tax;

  select count(*) into v_removed_lines
    from public.order_lines
   where order_id = inv.id and order_ref like v_pattern;
  if v_removed_lines = 0 then
    raise exception 'RX-% has no lines on this invoice.', lpad(rx.rx_no::text, 4, '0')
      using errcode = 'restrict_violation';
  end if;
  if not exists (
    select 1 from public.order_lines
     where order_id = inv.id and coalesce(order_ref, '') not like v_pattern
  ) then
    raise exception 'RX-% is the only lens on this invoice. Void the invoice instead.',
      lpad(rx.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;
  if exists (
    select 1
      from public.sales_return_lines rl
      join public.order_lines l on l.id = rl.order_line_id
     where l.order_id = inv.id and l.order_ref like v_pattern
  ) then
    raise exception 'RX-% has a sales return on this invoice, so it cannot be removed.',
      lpad(rx.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;

  -- The copies are changed on an issued invoice; the maintenance flag is
  -- transaction-local, the same switch reopen_invoice uses.
  perform set_config('app.invoice_maintenance', 'on', true);

  delete from public.order_lines where order_id = inv.id and order_ref like v_pattern;

  -- The same figures issue_invoice works out for a combined RX invoice.
  select coalesce(sum(l.line_gross), 0),
         coalesce(sum(l.line_discount), 0),
         greatest(count(distinct l.order_ref), 1),
         coalesce(sum(l.quantity) filter
           (where p.tracks_power or p.is_rx or l.rx_status is not null), 0)
    into v_gross, v_disc, v_order_qty, v_lens_qty
    from public.order_lines l join public.products p on p.id = l.product_id
   where l.order_id = inv.id;

  v_net  := v_gross - v_disc + coalesce(inv.freight_charge, 0);
  v_gst  := round(v_net * coalesce(inv.gst_rate, 0) / 100, 2);
  v_add  := round(v_net * coalesce(inv.additional_tax_rate, 0) / 100, 2);
  v_incl := v_net + v_gst + v_add;

  -- Released now, so the list of RX orders on the invoice is the remaining ones.
  update public.orders set billed_in = null where id = rx.id;

  select string_agg('RX-' || lpad(r.rx_no::text, 4, '0'), ', ' order by r.rx_no)
    into v_list
    from public.orders r where r.billed_in = inv.id;

  update public.orders set
     order_qty = v_order_qty, lens_qty = v_lens_qty,
     invoice_amount = v_gross, discount_amount = v_disc,
     net_amount = v_net, gst_amount = v_gst, additional_tax_amount = v_add,
     amount_incl_tax = v_incl,
     closing_balance = coalesce(previous_balance, 0) + v_incl,
     notes = 'RX orders: ' || coalesce(v_list, '')
   where id = inv.id
   returning * into inv;

  -- The invoice's own ledger posting follows the new total; nothing else is posted.
  if v_incl = 0 then
    delete from public.ledger_entries where order_id = inv.id and entry_type = 'invoice';
  else
    update public.ledger_entries set amount = v_incl
     where order_id = inv.id and entry_type = 'invoice';
  end if;

  -- Invoices issued after this one already carry balances that include the
  -- amount taken off; move them by the same figure.
  v_delta := v_old_incl - v_incl;
  if v_delta <> 0 then
    update public.orders set
       previous_balance = previous_balance - v_delta,
       closing_balance  = closing_balance - v_delta
     where bill_to_customer_id = inv.bill_to_customer_id
       and issued_at > inv.issued_at
       and previous_balance is not null;
  end if;

  return inv;
end $$;

grant execute on function public.remove_rx_from_invoice(uuid) to authenticated;
