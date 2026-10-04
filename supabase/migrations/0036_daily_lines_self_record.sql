-- ============================================================================
-- A daily line records itself in the daily register.
--
-- Until now a daily line could only be invoiced if the day's stock had already
-- been entered in the daily register ("Add today's received stock in the daily
-- register first"). Daily items are bought for the order, so the order itself
-- is the entry: when the invoice is made, whatever the register does not
-- already hold is recorded as received, and the full quantity as outgoing.
-- Stock already entered in the register is used first, so nothing is counted
-- twice. The auto-received part is remembered per posting, so a void, reopen
-- or delete takes back exactly what the invoice added.
-- ============================================================================

alter table public.daily_stock_postings
  add column if not exists auto_received integer not null default 0
    check (auto_received >= 0);

comment on column public.daily_stock_postings.auto_received is
  'Quantity this posting added to received_qty because the register did not hold enough.';

create or replace function public.post_daily_outgoing(p_order_id uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  r record;
  e public.daily_stock_entries;
  v_day date := (now() at time zone 'Asia/Karachi')::date;
  v_open integer;
  v_short integer;
begin
  for r in
    select l.product_id, max(l.product_name) as name, max(l.unit) as unit,
           sum(l.quantity)::int as qty
      from order_lines l
     where l.order_id = p_order_id and l.stock_source = 'daily'
     group by l.product_id
     order by l.product_id
  loop
    select * into e from daily_stock_entries
     where product_id = r.product_id and entry_date = v_day
     for update;

    if not found then
      select closing_qty into v_open from daily_stock_entries
       where product_id = r.product_id and entry_date < v_day
       order by entry_date desc limit 1;
      insert into daily_stock_entries
        (product_id, product_name, unit, entry_date, opening_qty)
      values (r.product_id, r.name, r.unit, v_day, coalesce(v_open, 0))
      returning * into e;
    end if;

    -- Use what the register already holds; record the rest as received.
    v_short := greatest(r.qty - (e.opening_qty + e.received_qty - e.outgoing_qty), 0);

    update daily_stock_entries
       set received_qty = received_qty + v_short,
           outgoing_qty = outgoing_qty + r.qty
     where id = e.id;
    insert into daily_stock_postings (order_id, entry_id, qty, auto_received)
    values (p_order_id, e.id, r.qty, v_short);
  end loop;
end $$;

grant execute on function public.post_daily_outgoing(uuid) to authenticated;

-- Give back the outgoing and take back the received this order added.
create or replace function public.reverse_daily_outgoing(p_order_id uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare r record;
begin
  for r in
    select entry_id, sum(qty)::int as qty, sum(auto_received)::int as auto_received
      from daily_stock_postings
     where order_id = p_order_id group by entry_id order by entry_id
  loop
    update daily_stock_entries
       set outgoing_qty = greatest(outgoing_qty - r.qty, 0),
           received_qty = greatest(received_qty - r.auto_received, 0)
     where id = r.entry_id;
  end loop;
  delete from daily_stock_postings where order_id = p_order_id;
end $$;

grant execute on function public.reverse_daily_outgoing(uuid) to authenticated;
