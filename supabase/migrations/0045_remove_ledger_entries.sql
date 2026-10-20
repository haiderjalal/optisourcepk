-- ============================================================================
-- Remove a payment or adjustment from a customer's ledger, to Recently deleted.
--
-- Only entries typed by hand can be removed: a payment, or an adjustment such as
-- a payment discount. Invoices, voids and sales returns carry an order or a
-- return and are removed through their own documents.
--
-- Removing an entry moves the stored previous and closing balances of every
-- invoice issued after it by the same amount, so the printed balances keep
-- agreeing with the statement. Restoring it moves them back. The entry keeps its
-- original date and time, so it returns to the same place on the statement.
--
-- The statement gets a `removable` flag, appended to the view, so the screen
-- offers the action only on entries that can be removed.
-- ============================================================================

-- The bin takes one more kind of item.
alter table public.trash drop constraint if exists trash_kind_check;
alter table public.trash add constraint trash_kind_check
  check (kind in ('order', 'stock_movement', 'ledger_entry'));

-- Move a hand-typed payment or adjustment into the bin.
create or replace function public.trash_ledger_entry(p_entry_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  e public.ledger_entries;
  v_label text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into e from ledger_entries where id = p_entry_id for update;
  if not found then
    raise exception 'That entry was not found.' using errcode = 'restrict_violation';
  end if;
  if e.entry_type::text not in ('payment', 'adjustment')
     or e.order_id is not null or e.return_id is not null then
    raise exception 'Only a payment or an adjustment entered by hand can be removed here. Invoices, voids and returns are removed through their own documents.'
      using errcode = 'restrict_violation';
  end if;

  v_label := coalesce(e.memo, initcap(e.entry_type::text))
          || ' · Rs ' || trim(to_char(abs(e.amount), 'FM999999990.00'))
          || ' · ' || to_char(e.entry_date, 'DD Mon YYYY');

  perform set_config('app.invoice_maintenance', 'on', true);

  -- Invoices issued after the entry carry balances that include it; take it out.
  update orders set
     previous_balance = previous_balance - e.amount,
     closing_balance  = closing_balance  - e.amount
   where bill_to_customer_id = e.customer_id
     and issued_at > e.created_at
     and previous_balance is not null;

  delete from ledger_entries where id = e.id;

  insert into trash (kind, label, payload)
  values ('ledger_entry', v_label, to_jsonb(e))
  returning id into v_id;

  return v_id;
end $$;

grant execute on function public.trash_ledger_entry(uuid) to authenticated;

-- restore_trash as 0032 had it, with one more kind: a ledger entry comes back
-- at its original time, and the invoices issued after it take it in again.
create or replace function public.restore_trash(p_trash_id uuid)
returns text
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  t public.trash;
  r record;
  v_order uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into t from trash where id = p_trash_id for update;
  if not found then raise exception 'That item is no longer in Recently deleted.'; end if;
  if t.deleted_at < now() - interval '7 days' then
    raise exception 'This was deleted more than 7 days ago and can no longer be restored.'
      using errcode = 'restrict_violation';
  end if;

  perform set_config('app.invoice_maintenance', 'on', true);

  if t.kind = 'order' then
    v_order := (t.payload->'order'->>'id')::uuid;
    if exists (select 1 from orders where id = v_order) then
      raise exception 'This order already exists again.' using errcode = 'restrict_violation';
    end if;

    perform trash_insert_rows('orders', jsonb_build_array(t.payload->'order'));
    perform trash_insert_rows('order_lines', t.payload->'lines');

    -- Its stock movements, applied to the bins again.
    for r in
      select (x->>'bin_id')::uuid as bin_id, sum((x->>'delta')::int)::int as delta
        from jsonb_array_elements(t.payload->'movements') x
       group by 1 order by 1
    loop
      update stock_bins set qty_on_hand = qty_on_hand + r.delta, updated_at = now()
       where id = r.bin_id and qty_on_hand + r.delta >= 0;
      if not found then
        raise exception 'There is not enough stock now to restore this invoice. Receive the stock first, then restore.'
          using errcode = 'restrict_violation';
      end if;
    end loop;
    perform trash_insert_rows('stock_movements', t.payload->'movements');

    perform trash_insert_rows('ledger_entries', t.payload->'ledger');

    -- Its daily-register outgoing, taken again.
    for r in
      select (x->>'entry_id')::uuid as entry_id, sum((x->>'qty')::int)::int as qty
        from jsonb_array_elements(t.payload->'daily') x
       group by 1 order by 1
    loop
      update daily_stock_entries set outgoing_qty = outgoing_qty + r.qty
       where id = r.entry_id
         and opening_qty + received_qty - outgoing_qty - r.qty >= 0;
      if not found then
        raise exception 'The daily register no longer has enough to restore this invoice.'
          using errcode = 'restrict_violation';
      end if;
    end loop;
    perform trash_insert_rows('daily_stock_postings', t.payload->'daily');

    -- The RX orders it billed go back on it, unless billed again since.
    if exists (select 1 from orders
                where id in (select (jsonb_array_elements_text(t.payload->'billed'))::uuid)
                  and billed_in is not null) then
      raise exception 'One of its RX orders is already on another invoice, so this invoice cannot be restored.'
        using errcode = 'restrict_violation';
    end if;
    update orders set billed_in = v_order
     where id in (select (jsonb_array_elements_text(t.payload->'billed'))::uuid);

  elsif t.kind = 'stock_movement' then
    update stock_bins set qty_on_hand = qty_on_hand + (t.payload->>'delta')::int,
                          updated_at = now()
     where id = (t.payload->>'bin_id')::uuid
       and qty_on_hand + (t.payload->>'delta')::int >= 0;
    if not found then
      raise exception 'There is not enough stock now to restore this entry.'
        using errcode = 'restrict_violation';
    end if;
    perform trash_insert_rows('stock_movements', jsonb_build_array(t.payload));

  elsif t.kind = 'ledger_entry' then
    if exists (select 1 from ledger_entries where id = (t.payload->>'id')::uuid) then
      raise exception 'This entry already exists again.' using errcode = 'restrict_violation';
    end if;
    perform trash_insert_rows('ledger_entries', jsonb_build_array(t.payload));

    -- Invoices issued after the entry were stored without it; put it back in.
    update orders set
       previous_balance = previous_balance + (t.payload->>'amount')::numeric,
       closing_balance  = closing_balance  + (t.payload->>'amount')::numeric
     where bill_to_customer_id = (t.payload->>'customer_id')::uuid
       and issued_at > (t.payload->>'created_at')::timestamptz
       and previous_balance is not null;
  end if;

  delete from trash where id = t.id;
  return t.label;
end $$;

-- The statement, as 0043 had it, with one column added at the end: whether the
-- entry can be removed from the statement.
create or replace view public.customer_statement
with (security_invoker = true) as
with statement_rows as (
  select c.id as customer_id, 0 as ord, c.opening_balance_date as entry_date,
         'opening' as kind, null::uuid as entry_id, null::bigint as invoice_no,
         'Opening balance' as description, c.opening_balance as amount,
         c.created_at as seq_at,
         '00000000-0000-0000-0000-000000000000'::uuid as seq_id,
         null::text as sale_type,
         false as removable
    from public.customers c where c.deleted_at is null
  union all
  select l.customer_id, 1, l.entry_date, l.entry_type::text, l.id, o.invoice_no,
         case
           when l.entry_type = 'invoice' and o.combines_rx then
             'RX: ' || coalesce((
               select string_agg(
                 'RX-' || lpad(r.rx_no::text, 4, '0') ||
                 case when nullif(btrim(r.lab_order_no), '') is null then ''
                      else ' / Lab ' || btrim(r.lab_order_no) end,
                 ', ' order by r.rx_no)
                 from public.orders r where r.billed_in = o.id
             ), 'combined RX invoice')
           when l.entry_type = 'invoice' and o.is_rx then
             'RX-' || lpad(o.rx_no::text, 4, '0') ||
             case when nullif(btrim(o.lab_order_no), '') is null then ''
                  else ' / Lab ' || btrim(o.lab_order_no) end
           else coalesce(l.memo, initcap(l.entry_type::text))
         end as description,
         l.amount, l.created_at, l.id,
         case when l.entry_type = 'invoice' and (o.combines_rx or o.is_rx)
                then 'rx'
              when l.entry_type = 'invoice' then 'stock'
              when l.entry_type = 'adjustment' then 'adjustment'
              else null end as sale_type,
         (l.entry_type in ('payment', 'adjustment')
            and l.order_id is null and l.return_id is null) as removable
    from public.ledger_entries l
    left join public.orders o on o.id = l.order_id
)
select customer_id, entry_date, kind, entry_id, invoice_no, description,
       case when amount > 0 then  amount end as debit,
       case when amount < 0 then -amount end as credit,
       amount,
       sum(amount) over (partition by customer_id
                         order by ord, entry_date, seq_at, seq_id
                         rows between unbounded preceding and current row) as running_balance,
       sale_type,
       row_number() over (partition by customer_id
                          order by ord, entry_date, seq_at, seq_id) as statement_seq,
       removable
  from statement_rows;
