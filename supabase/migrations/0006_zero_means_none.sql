-- ============================================================================
-- A zero cylinder or addition is the same as none.
--
-- Allowing 0 in the ADD field (0005) created a trap: stock received as
-- SPH -2.00 with CYL 0.00 and ADD 0.00 typed in produced a bin keyed on those
-- zeros, while an order line leaving them blank produced NULLs. 0 and NULL are
-- distinct values, so the bin never matched and invoicing reported no stock
-- for a product sitting on the shelf.
--
-- Zero is now normalised to NULL for CYL and ADD, on the way in and when
-- matching. SPH is deliberately left alone: 0.00 there is a plano lens, a real
-- power, and not the same as "no sphere".
-- ============================================================================

-- ---------------------------------------------------- fix what is already in
-- Merge a zero bin into its NULL twin where both exist, so normalising below
-- cannot collide with the unique key. Quantities add; the zero bin goes.
with pairs as (
  select z.id as zero_id, n.id as null_id, z.qty_on_hand as qty
    from public.stock_bins z
    join public.stock_bins n
      on n.product_id = z.product_id
     and n.sph is not distinct from z.sph
     and n.eye is not distinct from z.eye
     and n.cyl is null and n.add_power is null
   where (z.cyl = 0 or z.add_power = 0)
     and z.id <> n.id
)
update public.stock_bins b
   set qty_on_hand = b.qty_on_hand + pairs.qty, updated_at = now()
  from pairs
 where b.id = pairs.null_id;

-- Movements point at the surviving bin so no history is lost.
with pairs as (
  select z.id as zero_id, n.id as null_id
    from public.stock_bins z
    join public.stock_bins n
      on n.product_id = z.product_id
     and n.sph is not distinct from z.sph
     and n.eye is not distinct from z.eye
     and n.cyl is null and n.add_power is null
   where (z.cyl = 0 or z.add_power = 0)
     and z.id <> n.id
)
update public.stock_movements m
   set bin_id = pairs.null_id
  from pairs
 where m.bin_id = pairs.zero_id;

delete from public.stock_bins z
 where (z.cyl = 0 or z.add_power = 0)
   and exists (
     select 1 from public.stock_bins n
      where n.product_id = z.product_id
        and n.sph is not distinct from z.sph
        and n.eye is not distinct from z.eye
        and n.cyl is null and n.add_power is null
        and n.id <> z.id);

update public.stock_bins
   set cyl = nullif(cyl, 0), add_power = nullif(add_power, 0), updated_at = now()
 where cyl = 0 or add_power = 0;

-- Order lines too, so a blank prints blank rather than 0.00. Only drafts: an
-- issued invoice is frozen, and its lines are a record of what was sent.
update public.order_lines l
   set cyl = nullif(l.cyl, 0), add_power = nullif(l.add_power, 0)
  from public.orders o
 where o.id = l.order_id
   and o.issued_at is null
   and (l.cyl = 0 or l.add_power = 0);


-- ------------------------------------------------------------ receiving
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

  insert into stock_bins (product_id, tracks_power, sph, cyl, add_power, eye, qty_on_hand)
  values (p.id, p.tracks_power,
          p_sph,                       -- 0.00 is plano: a real power, kept
          nullif(p_cyl, 0),            -- zero cylinder means none
          nullif(p_add, 0),            -- zero addition means none
          nullif(btrim(coalesce(p_eye, '')), ''),
          p_delta)
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
     and cyl       is not distinct from nullif(p_cyl, 0)
     and add_power is not distinct from nullif(p_add, 0)
     and eye       is not distinct from nullif(btrim(coalesce(p_eye, '')), '');
end $$;


-- -------------------------------------------------------------- issuing
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
           l.sph,
           nullif(l.cyl, 0)       as cyl,
           nullif(l.add_power, 0) as add_power,
           l.eye,
           sum(l.quantity)::int as qty
      from order_lines l join products p on p.id = l.product_id
     where l.order_id = p_order_id and p.tracks_stock
     group by p.id, p.name, p.sku, p.unit,
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

    -- Exact shelf position first.
    select b.id, b.qty_on_hand into v_bin, v_have
      from stock_bins b
     where b.product_id = r.product_id
       and b.sph       is not distinct from r.sph
       and b.cyl       is not distinct from r.cyl
       and b.add_power is not distinct from r.add_power
       and b.eye       is not distinct from r.eye
     for update;

    -- Then the general bin: same power, nothing else specified.
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
