-- ============================================================================
-- Editing an invoice keeps its number.
--
-- reopen_invoice (0026/0028) retired the invoice number, so editing invoice
-- 1042 and issuing it again produced invoice 1043 — to the shop it looked as
-- if the invoice had been deleted and a new one made. An edit now changes the
-- same invoice: reopening keeps the number (and the original issue date) on
-- the draft, and issuing it again reuses them instead of drawing the next
-- number. The stock and ledger postings are still reversed and re-posted in
-- full, so quantities and balances follow the edit exactly.
--
-- The kept number is held in its own column while the invoice is a draft, so
-- every screen that treats `invoice_no` as "issued" keeps working unchanged.
-- ============================================================================

alter table public.orders
  add column if not exists reserved_invoice_no bigint,
  add column if not exists reserved_issued_at  timestamptz;

comment on column public.orders.reserved_invoice_no is
  'Invoice number kept while an issued invoice is reopened for editing; reused when it is issued again.';
comment on column public.orders.reserved_issued_at is
  'Original issue time kept while an invoice is reopened; restored when it is issued again.';

-- Belt and braces: a kept number can belong to one order only.
create unique index if not exists orders_reserved_invoice_no_uq
  on public.orders (reserved_invoice_no) where reserved_invoice_no is not null;


create or replace function public.reopen_invoice(p_order_id uuid)
returns public.orders
language plpgsql security definer
set search_path = public, pg_temp as $$
declare o public.orders;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Invoice was not found.'; end if;
  if o.issued_at is null then
    raise exception 'That record is not an issued invoice.'
      using errcode = 'restrict_violation';
  end if;
  if o.voided_at is not null then
    raise exception 'A voided invoice cannot be edited, but it can be deleted.'
      using errcode = 'restrict_violation';
  end if;

  perform public.reverse_invoice_posting(p_order_id);
  perform set_config('app.invoice_maintenance', 'on', true);

  update public.orders set
     status = 'created',
     dispatched_at = null, delivered_at = null,
     delivered_by = null, delivery_note = null,
     -- Keep the number and date for when it is issued again.
     reserved_invoice_no = coalesce(o.reserved_invoice_no, o.invoice_no),
     reserved_issued_at  = coalesce(o.reserved_issued_at, o.issued_at),
     issued_at = null, invoice_no = null,
     order_qty = null, lens_qty = null,
     invoice_amount = null, discount_amount = null,
     net_amount = null,
     gst_amount = null,
     additional_tax_amount = null,
     amount_incl_tax = null,
     previous_balance = null, closing_balance = null,
     voided_at = null, void_reason = null,
     bill_to_name = null, bill_to_shop = null,
     bill_to_address = null, bill_to_phone = null,
     bill_to_ntn = null, bill_to_strn = null
   where id = p_order_id
   returning * into o;

  return o;
end $$;

revoke all on function public.reopen_invoice(uuid) from public;
grant execute on function public.reopen_invoice(uuid) to authenticated;


-- Same as 0033, except a reopened invoice gets its own number and date back.
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

  -- An edited invoice keeps its number; only a new one draws the next.
  if o.reserved_invoice_no is not null then
    v_no := o.reserved_invoice_no;
  else
    update counters set next_value = next_value + 1
     where name = 'invoice_no' returning next_value - 1 into v_no;
  end if;

  update orders set
     issued_at = coalesce(o.reserved_issued_at, now()), invoice_no = v_no,
     reserved_invoice_no = null, reserved_issued_at = null,
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
