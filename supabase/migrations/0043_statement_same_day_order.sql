-- ============================================================================
-- Customer statement: entries on the same day in the order they happened.
--
-- The running balance has always been summed in time order (entry date, then
-- when each entry was made), but the statement screen and its PDF sorted by
-- entry date and then by running balance. Within one day that put the lowest
-- balance first, so a payment appeared above the invoices it was taken
-- against, and the balances on the page no longer followed the rows.
--
-- statement_seq numbers the rows in the same order the running balance is
-- summed, so the screen can show them in that order. Read-only: no entry, total
-- or balance changes.
--
-- The new column is added last, so existing columns keep their positions.
-- ============================================================================

create or replace view public.customer_statement
with (security_invoker = true) as
with statement_rows as (
  select c.id as customer_id, 0 as ord, c.opening_balance_date as entry_date,
         'opening' as kind, null::uuid as entry_id, null::bigint as invoice_no,
         'Opening balance' as description, c.opening_balance as amount,
         c.created_at as seq_at,
         '00000000-0000-0000-0000-000000000000'::uuid as seq_id,
         null::text as sale_type
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
              else null end as sale_type
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
                          order by ord, entry_date, seq_at, seq_id) as statement_seq
  from statement_rows;
