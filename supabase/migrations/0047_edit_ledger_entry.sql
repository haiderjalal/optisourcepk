-- ============================================================================
-- Correct a payment or adjustment entered by hand: its amount, how it was paid,
-- its reference and its note.
--
-- The ledger is appended to, so an edit is kept to what a person can get wrong
-- on a receipt. The date and the customer are fixed: moving a payment to another
-- day would reorder the statement, and the balances stored on invoices were
-- taken on the day they were issued. A mistaken date is removed and recorded
-- again.
--
-- The entry keeps its direction: a payment or a discount still reduces what is
-- owed, and removing a discount still adds it back. The amount is the magnitude.
-- Invoices issued after the entry move by the change in its amount, as they do
-- when an entry is removed or restored, so their printed balances still agree.
-- ============================================================================

create or replace function public.update_ledger_entry(
  p_entry_id uuid,
  p_amount   numeric,
  p_method   text default null,
  p_reference text default null,
  p_memo     text default null)
returns public.ledger_entries
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  e public.ledger_entries;
  v_new numeric(12,2);
  v_delta numeric(12,2);
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
    raise exception 'Only a payment or an adjustment entered by hand can be edited here. Invoices, voids and returns are changed through their own documents.'
      using errcode = 'restrict_violation';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter the amount, more than zero.' using errcode = 'restrict_violation';
  end if;
  if e.entry_type = 'payment' and nullif(btrim(coalesce(p_method, '')), '') is null then
    raise exception 'Pick how it was paid.' using errcode = 'restrict_violation';
  end if;

  -- Same direction as before: a payment or a discount is negative.
  v_new := case when e.amount < 0 then -p_amount else p_amount end;
  v_delta := v_new - e.amount;

  perform set_config('app.invoice_maintenance', 'on', true);

  if v_delta <> 0 then
    update orders set
       previous_balance = previous_balance + v_delta,
       closing_balance  = closing_balance  + v_delta
     where bill_to_customer_id = e.customer_id
       and issued_at > e.created_at
       and previous_balance is not null;
  end if;

  update ledger_entries set
     amount         = v_new,
     payment_method = case when e.entry_type = 'payment'
                           then nullif(btrim(p_method), '')::payment_method end,
     reference      = nullif(btrim(coalesce(p_reference, '')), ''),
     memo           = nullif(btrim(coalesce(p_memo, '')), '')
   where id = e.id
   returning * into e;

  return e;
end $$;

grant execute on function public.update_ledger_entry(uuid, numeric, text, text, text) to authenticated;
