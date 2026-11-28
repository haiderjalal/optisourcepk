-- ============================================================================
-- Each purchase invoice shows how much of it has been paid.
--
-- Payments are recorded against the supplier as a whole (migration 0054), so a
-- bill's paid amount is worked out here: the supplier's total payments are applied
-- to their bills oldest first, by invoice date then entry time. A bill is paid up
-- to its total before the next one starts, and a bill with nothing applied shows 0.
--
-- paid_amount is added to the end of purchase_invoice_totals, so the columns the
-- app already reads are unchanged and supplier_balances keeps working.
-- ============================================================================

create or replace view public.purchase_invoice_totals with (security_invoker = true) as
with bills as (
  select i.id, i.supplier_id, s.name as supplier_name,
         i.invoice_no, i.invoice_date, i.notes, i.created_at,
         count(l.id)::int                  as line_count,
         coalesce(sum(l.quantity), 0)::int as total_qty,
         coalesce(sum(l.line_total), 0)    as total_amount
    from public.purchase_invoices i
    join public.suppliers s on s.id = i.supplier_id
    left join public.purchase_invoice_lines l on l.purchase_invoice_id = i.id
   group by i.id, s.name
),
supplier_paid as (
  select supplier_id, sum(amount) as total_paid
    from public.supplier_payments
   group by supplier_id
),
with_paid as (
  select b.*, coalesce(p.total_paid, 0) as supplier_paid
    from bills b
    left join supplier_paid p on p.supplier_id = b.supplier_id
)
select id, supplier_id, supplier_name, invoice_no, invoice_date, notes, created_at,
       line_count, total_qty, total_amount,
       least(
         total_amount,
         greatest(
           0,
           supplier_paid - coalesce(sum(total_amount) over (
             partition by supplier_id
             order by invoice_date, created_at, id
             rows between unbounded preceding and 1 preceding), 0))
       ) as paid_amount
  from with_paid;
