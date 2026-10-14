-- ============================================================================
-- Monthly sales totalled in the database, not in the app.
--
-- The Sales screen used to read every line of every issued invoice, plus every
-- sales return, and add them up in JavaScript on each visit. That read grows
-- with the whole sales history. These two views give the same figures as a
-- handful of rows per month: one per channel for sales, one per month for
-- returns. They follow rx_monthly (0019), which already totals RX this way.
--
-- The rules are those of features/shop/sales/monthly.ts:
--   - an issued, non-voided invoice counts;
--   - sales are line totals after discount, before freight and tax;
--   - a line is RX when it has an RX status, daily when it draws on the daily
--     stock register, and stock otherwise;
--   - cost is known only where a line stores a unit cost; lines without one are
--     counted in lines_without_cost rather than treated as free.
-- ============================================================================

create or replace view public.sales_by_channel_monthly with (security_invoker = true) as
select date_trunc('month', o.issued_at at time zone 'Asia/Karachi')::date as month,
       case when l.rx_status is not null then 'rx'
            when l.stock_source = 'daily' then 'daily'
            else 'stock'
       end                                                               as channel,
       coalesce(sum(l.line_total), 0)::numeric(12,2)                     as sales,
       coalesce(sum(l.unit_cost * l.quantity)
                  filter (where l.unit_cost is not null), 0)::numeric(12,2) as cost,
       coalesce(sum(l.line_total)
                  filter (where l.unit_cost is not null), 0)::numeric(12,2) as known_sales,
       (count(*) filter (where l.unit_cost is null))::int                as lines_without_cost
  from public.order_lines l
  join public.orders o on o.id = l.order_id
 where o.issued_at is not null
   and o.voided_at is null
 group by 1, 2;

grant select on public.sales_by_channel_monthly to authenticated;

-- Sales returns per Karachi month, all of them, as the Sales screen always read them.
create or replace view public.sales_returns_monthly with (security_invoker = true) as
select date_trunc('month', r.returned_at at time zone 'Asia/Karachi')::date as month,
       coalesce(sum(r.amount), 0)::numeric(12,2)                           as amount
  from public.sales_returns r
 group by 1;

grant select on public.sales_returns_monthly to authenticated;
