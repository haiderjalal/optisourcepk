-- ============================================================================
-- Save orders now, invoice them together later — the RX flow (0025) for
-- normal and daily orders.
--
-- Orders are saved as drafts as they come in. "Generate invoice" picks some of
-- one shop's saved orders, copies their lines (each keeping its normal/daily
-- stock source) onto one new invoice, issues it — stock, daily register and
-- ledger move once, in one transaction — and marks each order billed_in that
-- invoice. Billed orders are locked by the existing freeze trigger. Voiding
-- the invoice releases them; deleting it already does (0026).
-- ============================================================================

alter table public.orders
  add column if not exists combines_orders boolean not null default false;

comment on column public.orders.combines_orders is
  'An invoice made from several saved normal/daily orders; its lines are copies of theirs.';

-- Voiding a combined invoice — RX or orders — puts its orders back to ready.
create or replace function public.release_rx_orders() returns trigger
language plpgsql as $$
begin
  if (new.combines_rx or new.combines_orders)
     and new.voided_at is not null and old.voided_at is null then
    update public.orders set billed_in = null where billed_in = new.id;
  end if;
  return new;
end $$;

create or replace function public.issue_orders_invoice(
  p_customer_id uuid,
  p_order_ids   uuid[],
  p_freight numeric default 0,
  p_gst_rate numeric default 0,
  p_additional_tax_rate numeric default 0)
returns public.orders
language plpgsql security invoker set search_path = public as $$
declare
  v_ids     uuid[];
  v_list    text;
  v_daily   boolean;
  v_urgent  boolean;
  v_invoice uuid;
begin
  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    raise exception 'Tick at least one order to invoice.'
      using errcode = 'restrict_violation';
  end if;

  -- Lock the chosen orders, in a fixed order so two clicks cannot deadlock.
  select array_agg(id order by order_no),
         string_agg(order_no::text, ', ' order by order_no),
         bool_and(is_daily),
         bool_or(priority = 'urgent')
    into v_ids, v_list, v_daily, v_urgent
    from (select id, order_no, is_daily, priority from orders
           where id = any(p_order_ids)
             and bill_to_customer_id = p_customer_id
             and not is_rx and not combines_rx and not combines_orders
             and issued_at is null and voided_at is null and billed_in is null
             and status <> 'cancelled'
           order by order_no
           for update) ready;

  if v_ids is null or cardinality(v_ids) <> cardinality(array(select distinct unnest(p_order_ids))) then
    raise exception 'Some of those orders are already invoiced, cancelled, or belong to another shop. Refresh the page and try again.'
      using errcode = 'restrict_violation';
  end if;

  if exists (select 1 from unnest(v_ids) i
              where not exists (select 1 from order_lines l where l.order_id = i)) then
    raise exception 'One of those orders has no lines. Add its items or leave it out.'
      using errcode = 'restrict_violation';
  end if;

  insert into orders (bill_to_customer_id, combines_orders, is_daily, priority, notes)
  values (p_customer_id, true, coalesce(v_daily, false),
          case when v_urgent then 'urgent'::order_priority else 'normal'::order_priority end,
          'Orders: ' || v_list)
  returning id into v_invoice;

  insert into order_lines (order_id, line_no, order_ref, product_id, product_name, unit,
                           eye, sph, cyl, ax, add_power, unit_price, discount_pct, quantity,
                           unit_cost, supplier_id, stock_source)
  select v_invoice,
         row_number() over (order by o.order_no, l.line_no),
         coalesce(nullif(btrim(l.order_ref), ''), nullif(btrim(o.external_order_ref), ''),
                  o.order_no::text),
         l.product_id, l.product_name, l.unit,
         l.eye, l.sph, l.cyl, l.ax, l.add_power, l.unit_price, l.discount_pct, l.quantity,
         l.unit_cost, l.supplier_id, l.stock_source
    from order_lines l join orders o on o.id = l.order_id
   where o.id = any(v_ids);

  update orders set billed_in = v_invoice where id = any(v_ids);

  -- Stock, daily register, totals, number and ledger: one transaction.
  return public.issue_invoice(v_invoice, p_freight, p_gst_rate, p_additional_tax_rate);
end $$;

revoke all on function public.issue_orders_invoice(uuid, uuid[], numeric, numeric, numeric) from public, anon;
grant execute on function public.issue_orders_invoice(uuid, uuid[], numeric, numeric, numeric) to authenticated;
