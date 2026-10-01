-- ============================================================================
-- RX references and separated business totals.
--
-- The optician name already lives in orders.order_by_name. This migration
-- adds the lab's own order number, exposes RX/stock labels on statements, and
-- provides one RLS-respecting totals row for the ledger screen.
-- ============================================================================

alter table public.orders
  add column if not exists lab_order_no text;

comment on column public.orders.lab_order_no is
  'RX only: the order/reference number assigned by the external lab.';

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
       sale_type
  from statement_rows;

create or replace view public.business_totals
with (security_invoker = true) as
select
  (select coalesce(sum(o.amount_incl_tax), 0)::numeric(14,2)
     from public.orders o
    where o.issued_at is not null and o.voided_at is null
      and not (o.combines_rx or o.is_rx)) as stock_sales,
  (select coalesce(sum(o.amount_incl_tax), 0)::numeric(14,2)
     from public.orders o
    where o.issued_at is not null and o.voided_at is null
      and (o.combines_rx or o.is_rx)) as rx_sales,
  (select coalesce(sum(l.line_total), 0)::numeric(14,2)
     from public.purchase_invoice_lines l) as stock_purchases,
  (select coalesce(sum(coalesce(l.unit_cost, 0) * l.quantity), 0)::numeric(14,2)
     from public.order_lines l
     join public.orders o on o.id = l.order_id
    where o.issued_at is not null and o.voided_at is null
      and (o.combines_rx or o.is_rx)
      and l.rx_status is not null) as rx_purchases;

revoke all on public.business_totals from anon;
grant select on public.business_totals to authenticated;

