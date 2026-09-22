-- ============================================================================
-- Name the product in stock errors instead of printing a UUID.
--
-- "No stock bin for product fe7b1ebf-b55a-… at SPH -2.00" is true but useless
-- at the counter: it does not say which product, and it does not say what to
-- do about it. These replacements say both.
--
-- Only the two functions change. No table, column or constraint is touched.
-- ============================================================================

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
  v_power text;
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

  -- Deduct stock. Aggregated per bin and locked in a deterministic order, so
  -- two concurrent invoices can never take the same locks in opposite order.
  for r in
    select l.product_id, l.sph, sum(l.quantity)::int as qty,
           p.name as product_name, p.sku as sku, p.unit as unit
      from order_lines l join products p on p.id = l.product_id
     where l.order_id = p_order_id and p.tracks_stock
     group by l.product_id, l.sph, p.name, p.sku, p.unit
     order by l.product_id, l.sph
  loop
    -- Blank for goods held without a power, so the message reads naturally
    -- either way.
    v_power := case when r.sph is null then ''
                    else format(' at %s%s',
                                case when r.sph > 0 then '+' else '' end,
                                trim(to_char(r.sph, 'FM990.00'))) end;

    select b.id, b.qty_on_hand into v_bin, v_have
      from stock_bins b
     where b.product_id = r.product_id and b.sph is not distinct from r.sph
     for update;

    if v_bin is null then
      raise exception
        'No stock has been received for % (%)%. Open the product and receive some before invoicing.',
        r.product_name, r.sku, v_power
        using errcode = 'restrict_violation';
    end if;

    if v_have < r.qty then
      raise exception
        'Not enough stock of % (%)%: % % on hand, % needed.',
        r.product_name, r.sku, v_power, v_have, r.unit, r.qty
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
     amount_incl_tax = v_incl
   where id = p_order_id returning * into o;

  if v_incl <> 0 then
    insert into ledger_entries (customer_id, entry_date, entry_type, amount, order_id, memo)
    values (o.bill_to_customer_id, (o.issued_at at time zone 'Asia/Karachi')::date,
            'invoice', v_incl, o.id, 'Invoice ' || v_no);
  end if;

  return o;
end $$;


create or replace function public.adjust_stock(
  p_product_id uuid,
  p_sph        numeric,
  p_delta      integer,
  p_reason     stock_reason default 'adjustment',
  p_note       text default null)
returns integer
language plpgsql security invoker set search_path = public as $$
declare v_bin uuid; v_qty integer; v_name text;
begin
  if p_delta = 0 then raise exception 'Enter a quantity other than zero.'; end if;

  select name into v_name from products where id = p_product_id;

  insert into stock_bins (product_id, tracks_power, sph, qty_on_hand)
  select p.id, p.tracks_power, p_sph, p_delta
    from products p
   where p.id = p_product_id and p.tracks_stock and p.deleted_at is null
  on conflict on constraint stock_bins_product_sph_uq
    do update set qty_on_hand = stock_bins.qty_on_hand + p_delta, updated_at = now()
  returning id, qty_on_hand into v_bin, v_qty;

  if v_bin is null then
    raise exception
      'Cannot hold stock of %. It is either archived, or set up as a service rather than something you stock.',
      coalesce(v_name, 'that product')
      using errcode = 'restrict_violation';
  end if;

  insert into stock_movements (bin_id, delta, reason, note)
  values (v_bin, p_delta, p_reason, p_note);
  return v_qty;
end $$;

grant execute on function public.issue_invoice(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.adjust_stock(uuid, numeric, integer, stock_reason, text) to authenticated;
