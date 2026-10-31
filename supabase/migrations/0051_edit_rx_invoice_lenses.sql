-- ============================================================================
-- A reopened combined RX invoice can have its lenses changed.
--
-- Migration 0050 reopens a combined RX invoice so its stock items can change,
-- and leaves its lens lines as they are. This lets the lens lines change too:
-- each lens's power, quantity, discount and sale price, and the patient of each
-- RX order billed on the invoice.
--
-- The invoice's lens lines are copies of the lenses of the RX orders billed on
-- it, and the RX list reads those RX orders. Both are changed in this one
-- transaction, so the invoice and the RX list never disagree about a lens. A
-- billed RX order is frozen like an issued one, so the function uses the same
-- transaction-local switch as reopen_invoice and remove_rx_from_invoice to
-- change it. Nothing else on the RX order moves: its lab stage, lab price and
-- fitting details stay as they were.
--
-- A copy and its source are matched by position. issue_rx_invoice copies an RX
-- order's lenses in line order, and the copy's reference ends with the RX number
-- ("9493 · RX-0006"), so the nth lens of RX-0006 on the invoice is the nth lens
-- of RX-0006. If any lens cannot be matched, nothing is changed.
--
-- p_patients: [{ "rx_no": 6, "patient_name": "Ali" | null }]
-- p_lines:    [{ "id", "sph", "cyl", "ax", "add_power", "unit_price",
--                "discount_pct", "quantity" }]
-- The app has already turned a blank SPH into 0 and a zero CYL or ADD into null.
-- ============================================================================

create or replace function public.update_rx_invoice_lenses(
  p_invoice_id uuid,
  p_patients jsonb,
  p_lines jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  inv public.orders;
  rx public.orders;
  r record;
  v_lines jsonb := coalesce(p_lines, '[]'::jsonb);
  v_count int := jsonb_array_length(coalesce(p_lines, '[]'::jsonb));
  v_found int;
  v_mirrored int;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into inv from public.orders where id = p_invoice_id for update;
  if not found or not inv.combines_rx
     or inv.issued_at is not null or inv.voided_at is not null then
    raise exception 'Only a reopened, combined RX invoice can have its lenses changed.'
      using errcode = 'restrict_violation';
  end if;

  select count(distinct l.id) into v_found
    from public.order_lines l
    join jsonb_to_recordset(v_lines) as x(id uuid) on x.id = l.id
   where l.order_id = p_invoice_id and l.rx_status is not null;
  if v_found <> v_count then
    raise exception 'A lens in this change is no longer on the invoice. Refresh the page and try again.'
      using errcode = 'restrict_violation';
  end if;

  -- The invoice is a draft while reopened, so its own lines change freely.
  update public.order_lines l set
         sph = x.sph, cyl = x.cyl, ax = x.ax, add_power = x.add_power,
         unit_price = x.unit_price, discount_pct = x.discount_pct,
         quantity = x.quantity
    from jsonb_to_recordset(v_lines) as x(
           id uuid, sph numeric, cyl numeric, ax integer, add_power numeric,
           unit_price numeric, discount_pct numeric, quantity integer)
   where l.id = x.id and l.order_id = p_invoice_id;

  -- From here the billed RX orders are written, which the freeze triggers refuse
  -- unless this transaction-local switch is on.
  perform set_config('app.invoice_maintenance', 'on', true);

  for r in
    select * from jsonb_to_recordset(coalesce(p_patients, '[]'::jsonb))
             as x(rx_no integer, patient_name text)
  loop
    select * into rx from public.orders
     where is_rx and billed_in = p_invoice_id and rx_no = r.rx_no
       for update;
    if not found then
      raise exception 'RX-% is not billed on this invoice.', lpad(r.rx_no::text, 4, '0')
        using errcode = 'restrict_violation';
    end if;

    update public.order_lines set patient_name = r.patient_name
     where order_id = p_invoice_id
       and order_ref like ('%RX-' || lpad(r.rx_no::text, 4, '0'));

    -- On an RX order the patient is the line reference, unless an order number
    -- was given. Only a reference that was the old name follows the new one.
    update public.order_lines set order_ref = r.patient_name
     where order_id = rx.id and order_ref is not distinct from rx.patient_name;

    update public.orders set patient_name = r.patient_name where id = rx.id;
  end loop;

  update public.order_lines s set
         sph = x.sph, cyl = x.cyl, ax = x.ax, add_power = x.add_power,
         unit_price = x.unit_price, discount_pct = x.discount_pct,
         quantity = x.quantity
    from (select l.id,
                 substring(l.order_ref from 'RX-(\d+)$')::integer as rx_no,
                 row_number() over (
                   partition by substring(l.order_ref from 'RX-(\d+)$')
                   order by l.line_no) as n
            from public.order_lines l
           where l.order_id = p_invoice_id and l.rx_status is not null) il
    join jsonb_to_recordset(v_lines) as x(
           id uuid, sph numeric, cyl numeric, ax integer, add_power numeric,
           unit_price numeric, discount_pct numeric, quantity integer)
      on x.id = il.id
    join (select sl.id, o.rx_no,
                 row_number() over (partition by o.id order by sl.line_no) as n
            from public.order_lines sl
            join public.orders o on o.id = sl.order_id
           where o.is_rx and o.billed_in = p_invoice_id
             and sl.rx_status is not null) src
      on src.rx_no = il.rx_no and src.n = il.n
   where s.id = src.id;
  get diagnostics v_mirrored = row_count;

  if v_mirrored <> v_count then
    raise exception 'These lenses no longer match their RX orders, so they cannot be changed here.'
      using errcode = 'restrict_violation';
  end if;

  perform set_config('app.invoice_maintenance', 'off', true);
end $$;

revoke all on function public.update_rx_invoice_lenses(uuid, jsonb, jsonb) from public;
grant execute on function public.update_rx_invoice_lenses(uuid, jsonb, jsonb) to authenticated;
