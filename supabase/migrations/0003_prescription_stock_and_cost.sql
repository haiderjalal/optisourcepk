-- ============================================================================
-- Hold stock by the full prescription, and record what it cost.
--
-- Until now a bin was keyed by (product, SPH) alone. Lenses are commonly held
-- as an SPH x CYL matrix, progressives by ADD, and some lines are eye-specific,
-- so the bin key grows to (product, SPH, CYL, ADD, eye).
--
-- The extra columns are NULLABLE and each is opt-in per product, so nothing
-- explodes by default: a frame stays one bin, an SPH-only lens keeps one bin
-- per power, and only a product explicitly marked as tracking CYL gains the
-- second dimension. UNIQUE NULLS NOT DISTINCT keeps every combination a real
-- singleton either way.
--
-- Existing rows are unaffected: their new columns are NULL, which is exactly
-- "this product does not split stock on that attribute".
-- ============================================================================

-- ------------------------------------------------------------- what it costs
alter table public.products
  add column if not exists purchase_price numeric(12,2) not null default 0
    check (purchase_price >= 0);

comment on column public.products.purchase_price is
  'What we pay for it. list_price is what we sell it for; the difference is margin.';
comment on column public.products.list_price is
  'Sale price before any customer discount.';

-- Which prescription attributes split this product's stock. tracks_power
-- (SPH) already exists; these three extend it. Each one multiplies the number
-- of bins, so they are off by default and turned on only where the shelf
-- really is organised that way.
alter table public.products
  add column if not exists tracks_cyl boolean not null default false,
  add column if not exists tracks_add boolean not null default false,
  add column if not exists tracks_eye boolean not null default false;

-- Any prescription split implies the product is stocked at all.
alter table public.products
  drop constraint if exists products_dimensions_need_stock;
alter table public.products
  add constraint products_dimensions_need_stock
  check (not (tracks_power or tracks_cyl or tracks_add or tracks_eye)
         or tracks_stock);


-- --------------------------------------------------------------- wider bins
alter table public.stock_bins
  add column if not exists cyl       numeric(5,2),
  add column if not exists add_power numeric(4,2),
  add column if not exists eye       text;

alter table public.stock_bins
  drop constraint if exists stock_bins_eye_valid;
alter table public.stock_bins
  add constraint stock_bins_eye_valid check (eye is null or eye in ('R','L'));

alter table public.stock_bins
  drop constraint if exists stock_bins_cyl_step;
alter table public.stock_bins
  add constraint stock_bins_cyl_step
  check (cyl is null or (cyl between -12 and 12 and mod(cyl, 0.25) = 0));

alter table public.stock_bins
  drop constraint if exists stock_bins_add_step;
alter table public.stock_bins
  add constraint stock_bins_add_step
  check (add_power is null or (add_power between 0.25 and 6 and mod(add_power, 0.25) = 0));

-- The bin key itself. Same NULLS NOT DISTINCT behaviour, four more columns.
alter table public.stock_bins
  drop constraint if exists stock_bins_product_sph_uq;
alter table public.stock_bins
  drop constraint if exists stock_bins_key_uq;
alter table public.stock_bins
  add constraint stock_bins_key_uq
  unique nulls not distinct (product_id, sph, cyl, add_power, eye);


-- ============================================================================
-- Receiving stock, now with the full prescription.
-- ============================================================================
drop function if exists public.adjust_stock(uuid, numeric, integer, stock_reason, text);

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

  -- Ignore any attribute this product does not split stock on, so a stray
  -- value cannot quietly create a second bin for the same shelf position.
  insert into stock_bins (product_id, tracks_power, sph, cyl, add_power, eye, qty_on_hand)
  values (p.id, p.tracks_power,
          case when p.tracks_power then p_sph else null end,
          case when p.tracks_cyl   then p_cyl else null end,
          case when p.tracks_add   then p_add else null end,
          case when p.tracks_eye   then p_eye else null end,
          p_delta)
  on conflict on constraint stock_bins_key_uq
    do update set qty_on_hand = stock_bins.qty_on_hand + p_delta, updated_at = now()
  returning id, qty_on_hand into v_bin, v_qty;

  insert into stock_movements (bin_id, delta, reason, note)
  values (v_bin, p_delta, p_reason, p_note);
  return v_qty;
end $$;


-- Set the alert level for one bin, addressed by its prescription rather than
-- by an id the caller would otherwise have to look up first.
create or replace function public.set_bin_alert(
  p_product_id uuid,
  p_sph   numeric,
  p_cyl   numeric,
  p_add   numeric,
  p_eye   text,
  p_level integer)
returns void
language plpgsql security invoker set search_path = public as $$
declare p record;
begin
  if p_level < 0 then raise exception 'An alert quantity cannot be negative.'; end if;
  select * into p from products where id = p_product_id;
  if not found then raise exception 'That product was not found.'; end if;

  update stock_bins set reorder_level = p_level, updated_at = now()
   where product_id = p_product_id
     and sph       is not distinct from (case when p.tracks_power then p_sph else null end)
     and cyl       is not distinct from (case when p.tracks_cyl   then p_cyl else null end)
     and add_power is not distinct from (case when p.tracks_add   then p_add else null end)
     and eye       is not distinct from (case when p.tracks_eye   then p_eye else null end);
end $$;


-- ============================================================================
-- Issuing, matching a line to its bin on every tracked attribute.
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

  -- Group by the bin each line actually draws on: the line's values, with any
  -- attribute this product does not track flattened to NULL first. Two eyes at
  -- the same power then correctly draw on one bin.
  for r in
    select p.id as product_id, p.name as product_name, p.sku, p.unit,
           case when p.tracks_power then l.sph       else null end as sph,
           case when p.tracks_cyl   then l.cyl       else null end as cyl,
           case when p.tracks_add   then l.add_power else null end as add_power,
           case when p.tracks_eye   then l.eye       else null end as eye,
           sum(l.quantity)::int as qty
      from order_lines l join products p on p.id = l.product_id
     where l.order_id = p_order_id and p.tracks_stock
     group by p.id, p.name, p.sku, p.unit,
              case when p.tracks_power then l.sph       else null end,
              case when p.tracks_cyl   then l.cyl       else null end,
              case when p.tracks_add   then l.add_power else null end,
              case when p.tracks_eye   then l.eye       else null end
     order by p.id, 5, 6, 7, 8
  loop
    -- Describe the bin the way the operator sees it on screen.
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


-- ---------------------------------------------------------------- low stock
-- Rebuilt so the alert list can name the exact shelf position.
drop view if exists public.low_stock;
create view public.low_stock with (security_invoker = true) as
select b.id as bin_id, p.id as product_id, p.sku, p.name, p.category,
       b.sph, b.cyl, b.add_power, b.eye,
       b.qty_on_hand, b.reorder_level,
       b.reorder_level - b.qty_on_hand as shortfall
  from public.stock_bins b join public.products p on p.id = b.product_id
 where p.deleted_at is null and b.qty_on_hand <= b.reorder_level;

grant execute on function public.adjust_stock(uuid, numeric, numeric, numeric, text, integer, stock_reason, text) to authenticated;
grant execute on function public.set_bin_alert(uuid, numeric, numeric, numeric, text, integer) to authenticated;
grant execute on function public.issue_invoice(uuid, numeric, numeric, numeric) to authenticated;
