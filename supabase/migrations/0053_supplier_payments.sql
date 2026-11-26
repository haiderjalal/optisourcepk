-- ============================================================================
-- Money sent to suppliers, each payment against one purchase invoice.
--
-- A supplier payment is money going out, so it lives in its own table rather
-- than in ledger_entries, which is keyed to customers. Each payment settles one
-- purchase invoice. An invoice's balance is its total less what was paid on it.
-- A payment larger than the balance is refused, and the invoice row is locked
-- while the balance is checked, so two payments cannot both pass the check.
--
-- Append-only, as purchase invoices are: a payment is never edited or deleted
-- here. A mistaken payment is corrected by a fix made in the database.
--
-- record_supplier_payment(p_purchase_invoice_id, p_amount, p_payment_date,
--                         p_method, p_reference, p_memo) returns the new id.
-- A null p_payment_date means today in Karachi.
-- ============================================================================

-- The composite foreign key below needs a unique target: (id, supplier_id).
create unique index purchase_invoices_id_supplier_uq
  on public.purchase_invoices (id, supplier_id);

create table public.supplier_payments (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid not null references public.suppliers(id) on delete restrict,
  purchase_invoice_id uuid not null,
  amount              numeric(12,2) not null check (amount > 0),
  -- Business date, backdatable, as with ledger entries.
  payment_date        date not null default (now() at time zone 'Asia/Karachi')::date,
  payment_method      payment_method not null,
  reference           text,        -- cheque number, bank reference
  memo                text,
  created_at          timestamptz not null default now(),
  -- The invoice must belong to the supplier the payment is recorded against.
  constraint supplier_payments_invoice_fk
    foreign key (purchase_invoice_id, supplier_id)
    references public.purchase_invoices (id, supplier_id) on delete restrict
);

create index supplier_payments_invoice_idx
  on public.supplier_payments (purchase_invoice_id);
create index supplier_payments_supplier_date_idx
  on public.supplier_payments (supplier_id, payment_date desc, created_at desc);

-- ------------------------------------------------------- balances per invoice
create view public.purchase_invoice_balances with (security_invoker = true) as
select t.id, t.supplier_id, t.supplier_name, t.invoice_no, t.invoice_date,
       t.total_amount,
       coalesce(p.paid, 0)                    as paid_amount,
       t.total_amount - coalesce(p.paid, 0)   as balance
  from public.purchase_invoice_totals t
  left join (
    select purchase_invoice_id, sum(amount) as paid
      from public.supplier_payments
     group by purchase_invoice_id
  ) p on p.purchase_invoice_id = t.id;

-- ---------------------------------------------------------- record a payment
create or replace function public.record_supplier_payment(
  p_purchase_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_method payment_method,
  p_reference text,
  p_memo text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_inv public.purchase_invoices;
  v_owed numeric;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  -- Holds the invoice's lock until the payment is in, so the check below and
  -- the insert see every payment already made on it.
  select * into v_inv from public.purchase_invoices
   where id = p_purchase_invoice_id for update;
  if not found then
    raise exception 'That purchase invoice was not found.'
      using errcode = 'no_data_found';
  end if;

  select balance into v_owed from public.purchase_invoice_balances
   where id = p_purchase_invoice_id;
  if p_amount > v_owed then
    raise exception 'Only Rs % is owed on this invoice.', v_owed
      using errcode = 'restrict_violation';
  end if;

  insert into public.supplier_payments
         (supplier_id, purchase_invoice_id, amount, payment_date,
          payment_method, reference, memo)
  values (v_inv.supplier_id, v_inv.id, p_amount,
          coalesce(p_payment_date, (now() at time zone 'Asia/Karachi')::date),
          p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_memo), ''))
  returning id into v_id;

  return v_id;
end $$;

-- ------------------------------------------------------------------- access
alter table public.supplier_payments enable row level security;

-- Append-only by omission: no UPDATE or DELETE policy.
create policy read   on public.supplier_payments for select to authenticated using (true);
create policy append on public.supplier_payments for insert to authenticated with check (true);

revoke all on public.supplier_payments, public.purchase_invoice_balances from anon;
grant select on public.purchase_invoice_balances to authenticated;

revoke all on function public.record_supplier_payment(uuid, numeric, date, payment_method, text, text)
  from anon, public;
grant execute on function public.record_supplier_payment(uuid, numeric, date, payment_method, text, text)
  to authenticated;
