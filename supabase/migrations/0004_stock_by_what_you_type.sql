-- ============================================================================
-- Stock is keyed by whatever you actually type, and a general bin covers a
-- more specific line.
--
-- 0003 gated CYL, ADD and eye behind per-product flags, so the fields were
-- hidden unless the product had been configured first. That got in the way.
-- The inputs are now always available and the value entered is stored as
-- given — no flag decides whether it counts.
--
-- The obvious risk of that is a silent mismatch: stock received as plain
-- SPH -2.00 would no longer satisfy a line written SPH -2.00 CYL -0.50.
-- So issuing now looks for the exact bin first and falls back to the more
-- general one, which is how the shelf really works: you hold a power, and a
-- cylinder on the prescription does not mean a separate box.
--
-- The tracks_cyl / tracks_add / tracks_eye columns stay for now but no longer
-- decide anything; nothing reads them after this.
-- ============================================================================

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_sph        numeric,
  p_cyl        numeric,
  p_add        numeric,
  p_eye        text,
  p_delta      integer,
  p_reason     stock_reason default 'adjustment',
  p_note       text default null)
returns integer
language plpgsql security invoker set search_path = public as $$
declare v_bin uuid; v_qty integer; p record;
begin
  if p_delta = 0 then raise exception 'Enter a quantity other than zero.'; end if;

  select * into p from products
   where id = p_product_id and tracks_stock and deleted_at is null;

  if not found then
    raise exception
      'Cannot hold stock of that product. It is either archived, or set up as a service rather than something you stock.'
      using errcode = 'restrict_violation';
  end if;

  -- Stored exactly as entered. A blank stays NULL, which is the general bin.
  insert into stock_bins (product_id, tracks_power, sph, cyl, add_power, eye, qty_on_hand)
  values (p.id, p.tracks_power, p_sph, p_cyl, p_add,
          nullif(btrim(coalesce(p_eye, '')), ''), p_delta)
  on conflict on constraint stock_bins_key_uq
    do update set qty_on_hand = stock_bins.qty_on_hand + p_delta, updated_at = now()
  returning id, qty_on_hand into v_bin, v_qty;

  insert into stock_movements (bin_id, delta, reason, note)
  values (v_bin, p_delta, p_reason, p_note);
  return v_qty;
end $$;


create or replace function public.set_bin_alert(
  p_product_id uuid,
  p_sph   numeric,
  p_cyl   numeric,
  p_add   numeric,
  p_eye   text,
  p_level integer)
returns void
language plpgsql security invoker set search_path = public as $$
begin
  if p_level < 0 then raise exception 'An alert quantity cannot be negative.'; end if;

  update stock_bins set reorder_level = p_level, updated_at = now()
   where product_id = p_product_id
     and sph       is not distinct from p_sph
     and cyl       is not distinct from p_cyl
     and add_power is not distinct from p_add
     and eye       is not distinct from nullif(btrim(coalesce(p_eye, '')), '');
end $$;


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
    select p.id as product_id, p.name as product_name, p.sku, p.unit,
           l.sph, l.cyl, l.add_power, l.eye,
           sum(l.quantity)::int as qty
      from order_lines l join products p on p.id = l.product_id
     where l.order_id = p_order_id and p.tracks_stock
     group by p.id, p.name, p.sku, p.unit, l.sph, l.cyl, l.add_power, l.eye
     -- Deterministic order so concurrent invoices cannot deadlock on shared bins.
     order by p.id, l.sph, l.cyl, l.add_power, l.eye
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

    -- Exact shelf position first.
    select b.id, b.qty_on_hand into v_bin, v_have
      from stock_bins b
     where b.product_id = r.product_id
       and b.sph       is not distinct from r.sph
       and b.cyl       is not distinct from r.cyl
       and b.add_power is not distinct from r.add_power
       and b.eye       is not distinct from r.eye
     for update;

    -- Then the more general bin: same power, nothing else specified. Stock
    -- held as plain SPH covers a line that also carries a cylinder.
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
        'No stock has been received for % (%)%. Open the product and receive some before invoicing.',
        r.product_name, r.sku,
        case when v_desc = '' then '' else ' — ' || v_desc end
        using errcode = 'restrict_violation';
    end if;

    if v_have < r.qty then
      raise exception
        'Not enough stock of % (%)%: % % on hand, % needed.',
        r.product_name, r.sku,
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

grant execute on function public.adjust_stock(uuid, numeric, numeric, numeric, text, integer, stock_reason, text) to authenticated;
grant execute on function public.set_bin_alert(uuid, numeric, numeric, numeric, text, integer) to authenticated;
grant execute on function public.issue_invoice(uuid, numeric, numeric, numeric) to authenticated;
