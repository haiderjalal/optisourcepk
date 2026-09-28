-- ============================================================================
-- RX orders as a job card: one patient per RX order, like the paper form.
--
-- Adds the RX number (RX-0001, its own sequence), the patient, lens type,
-- tint/photochromic/antiglare reason and frame make to the order, and the lab
-- stage: booked -> sent to lab -> back from lab. The invoice can only be
-- issued once the lens is back, when the lab's price is known.
--
-- The stage lives on the order; set_rx_stage keeps the lines' rx_status in
-- step (back = received) so the RX search and monthly figures keep working.
-- ============================================================================

create sequence if not exists public.rx_no_seq;

alter table public.orders
  add column if not exists rx_no          bigint unique,
  add column if not exists patient_name   text,
  add column if not exists rx_lens_type   text,
  add column if not exists rx_tint_reason text,
  add column if not exists frame_material text,
  add column if not exists frame_type     text,
  add column if not exists rx_stage       text,
  add column if not exists rx_sent_at     timestamptz,
  add column if not exists rx_back_at     timestamptz;

alter table public.orders drop constraint if exists orders_rx_lens_type_valid;
alter table public.orders add constraint orders_rx_lens_type_valid
  check (rx_lens_type in ('sv', 'nv', 'dbf', 'prog'));
alter table public.orders drop constraint if exists orders_frame_material_valid;
alter table public.orders add constraint orders_frame_material_valid
  check (frame_material in ('plastic', 'metal'));
alter table public.orders drop constraint if exists orders_frame_type_valid;
alter table public.orders add constraint orders_frame_type_valid
  check (frame_type in ('rimmed', 'half', 'rimless'));
alter table public.orders drop constraint if exists orders_rx_stage_valid;
alter table public.orders add constraint orders_rx_stage_valid
  check (rx_stage in ('booked', 'sent', 'back'));
alter table public.orders drop constraint if exists orders_rx_fields_only_rx;
alter table public.orders add constraint orders_rx_fields_only_rx
  check (is_rx or (rx_no is null and rx_stage is null));
alter table public.orders drop constraint if exists orders_patient_length;
alter table public.orders add constraint orders_patient_length
  check (patient_name is null or length(patient_name) <= 120);
alter table public.orders drop constraint if exists orders_tint_reason_length;
alter table public.orders add constraint orders_tint_reason_length
  check (rx_tint_reason is null or length(rx_tint_reason) <= 400);

-- The lab stage and RX number may change on an issued invoice (the number is
-- back-filled below); nothing on them is printed as money.
create or replace function public.freeze_issued_order() returns trigger
language plpgsql as $$
declare mutable text[] := array['status','dispatched_at','delivered_at','delivered_by',
                                'delivery_note','courier_name','tracking_no',
                                'voided_at','void_reason','notes','updated_at',
                                'rx_no','rx_stage','rx_sent_at','rx_back_at'];
begin
  if old.issued_at is null then return new; end if;
  if (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable) then
    raise exception 'Invoice % has been issued. Void it and raise a new one instead of editing.', old.invoice_no
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

-- A new RX order gets the next RX number and starts booked.
create or replace function public.number_rx_order() returns trigger
language plpgsql as $$
begin
  if new.is_rx then
    if new.rx_no is null then new.rx_no := nextval('public.rx_no_seq'); end if;
    if new.rx_stage is null then new.rx_stage := 'booked'; end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_number_rx on public.orders;
create trigger orders_number_rx before insert or update of is_rx on public.orders
  for each row execute function public.number_rx_order();

-- Number the RX orders made before this, oldest first.
with numbered as (
  select id, row_number() over (order by created_at, order_no) as n
    from public.orders where is_rx and rx_no is null
)
update public.orders o set rx_no = numbered.n + coalesce(
         (select max(rx_no) from public.orders where rx_no is not null), 0)
  from numbered where o.id = numbered.id;

select setval('public.rx_no_seq',
              coalesce((select max(rx_no) from public.orders), 0) + 1, false);

-- Their stage: invoiced or fully received counts as back from the lab.
update public.orders o
   set rx_stage = case
         when o.issued_at is not null
           or not exists (select 1 from public.order_lines l
                           where l.order_id = o.id and l.rx_status is distinct from 'received')
         then 'back' else 'booked' end,
       rx_back_at = case
         when o.issued_at is not null
           or not exists (select 1 from public.order_lines l
                           where l.order_id = o.id and l.rx_status is distinct from 'received')
         then coalesce(o.issued_at, now()) end
 where o.is_rx and o.rx_stage is null;

-- Move an RX order through the lab, lines and order together.
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
  if o.issued_at is not null or o.voided_at is not null then
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

grant execute on function public.set_rx_stage(uuid, text) to authenticated;

-- Refuses an RX invoice until it is back from the lab. Same function as 0020
-- otherwise.
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
  if o.is_rx and o.rx_stage is distinct from 'back' then
    raise exception 'RX-% is not back from the lab yet. Mark it back from the lab, check the prices, then issue.',
      lpad(o.rx_no::text, 4, '0')
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
