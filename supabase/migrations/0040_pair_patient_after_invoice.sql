-- ============================================================================
-- A pair's patient name can be added or changed after the invoice is issued.
--
-- The patient is a label on the line. It sets no price, quantity, stock
-- movement or ledger entry, so changing it leaves every figure as issued.
-- Everything else on an issued line stays frozen, exactly as before. The next
-- time the invoice is printed or shared, its PDF carries the new name.
--
-- The only change to the function from 0026 is `patient_name` in the list of
-- fields an invoiced line may still change.
-- ============================================================================

create or replace function public.freeze_issued_lines() returns trigger
language plpgsql as $$
declare
  v_order uuid;
  tracking text[] := array['unit_cost','supplier_id','rx_status','received_at','updated_at',
                           'line_gross','line_discount','line_total','patient_name'];
begin
  if current_setting('app.invoice_maintenance', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_order := case when tg_op = 'DELETE' then old.order_id else new.order_id end;
  if exists (select 1 from public.orders o
              where o.id = v_order and (o.issued_at is not null or o.billed_in is not null)) then
    if tg_op = 'UPDATE'
       and (to_jsonb(new) - tracking) is not distinct from (to_jsonb(old) - tracking) then
      return new;
    end if;
    raise exception 'Cannot change the lines of an invoiced order.'
      using errcode = 'restrict_violation';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
