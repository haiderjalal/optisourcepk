-- ============================================================================
-- Payments to a supplier go to the supplier's account, not to one invoice.
--
-- A supplier's bills are shown as one total: everything bought, everything paid,
-- and what is still owed. Migration 0053 tied each payment to one purchase
-- invoice; this removes that link. The amount owed is the total of the supplier's
-- purchases less every payment made to them. A payment above the amount owed is
-- still refused, and the supplier row is locked while that check runs.
--
-- record_supplier_payment(p_supplier_id, p_amount, p_payment_date, p_method,
--                         p_reference, p_memo) returns the new id.
-- A null p_payment_date means today in Karachi.
-- ============================================================================

drop view if exists public.purchase_invoice_balances;
drop function if exists public.record_supplier_payment(uuid, numeric, date, payment_method, text, text);

alter table public.supplier_payments drop constraint if exists supplier_payments_invoice_fk;
drop index if exists public.supplier_payments_invoice_idx;
alter table public.supplier_payments drop column if exists purchase_invoice_id;
drop index if exists public.purchase_invoices_id_supplier_uq;

-- ------------------------------------------------------- the supplier's account
create view public.supplier_balances with (security_invoker = true) as
select s.id as supplier_id,
       s.name as supplier_name,
       coalesce(b.bought, 0)                       as total_bought,
       coalesce(p.paid, 0)                         as total_paid,
       coalesce(b.bought, 0) - coalesce(p.paid, 0) as owed
  from public.suppliers s
  left join (
    select supplier_id, sum(total_amount) as bought
      from public.purchase_invoice_totals
     group by supplier_id
  ) b on b.supplier_id = s.id
  left join (
    select supplier_id, sum(amount) as paid
      from public.supplier_payments
     group by supplier_id
  ) p on p.supplier_id = s.id
 where s.deleted_at is null;

-- ---------------------------------------------------------- record a payment
create or replace function public.record_supplier_payment(
  p_supplier_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_method payment_method,
  p_reference text,
  p_memo text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_owed numeric;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  -- Holds the supplier's lock until the payment is in, so the check below and
  -- the insert see every payment already made to them.
  perform 1 from public.suppliers
   where id = p_supplier_id and deleted_at is null
   for update;
  if not found then
    raise exception 'That supplier was not found.'
      using errcode = 'no_data_found';
  end if;

  select owed into v_owed from public.supplier_balances
   where supplier_id = p_supplier_id;
  if p_amount > v_owed then
    raise exception 'Only Rs % is owed to this supplier.', v_owed
      using errcode = 'restrict_violation';
  end if;

  insert into public.supplier_payments
         (supplier_id, amount, payment_date, payment_method, reference, memo)
  values (p_supplier_id, p_amount,
          coalesce(p_payment_date, (now() at time zone 'Asia/Karachi')::date),
          p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_memo), ''))
  returning id into v_id;

  return v_id;
end $$;

-- ------------------------------------------------------------------- access
revoke all on public.supplier_balances from anon;
grant select on public.supplier_balances to authenticated;

revoke all on function public.record_supplier_payment(uuid, numeric, date, payment_method, text, text)
  from anon, public;
grant execute on function public.record_supplier_payment(uuid, numeric, date, payment_method, text, text)
  to authenticated;
