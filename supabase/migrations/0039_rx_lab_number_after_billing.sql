-- ============================================================================
-- The lab's order number on an RX job can be corrected after it is billed.
--
-- A billed RX job is frozen like any invoiced order, so its lab number could
-- not be fixed once it was on an invoice. The number is a reference, not a
-- price or a quantity: it changes no stock, no ledger amount and no total. The
-- statements and the RX screens read it live, so changing the order row is
-- enough for every place it is shown to follow.
--
-- Only lab_order_no is opened, and only on RX orders. This is 0026's trigger
-- as it stood, with that one column added for RX.
-- ============================================================================

create or replace function public.freeze_issued_order() returns trigger
language plpgsql as $$
declare mutable text[] := array['status','dispatched_at','delivered_at','delivered_by',
                                'delivery_note','courier_name','tracking_no',
                                'voided_at','void_reason','notes','updated_at',
                                'rx_no','rx_stage','rx_sent_at','rx_back_at','billed_in'];
begin
  if current_setting('app.invoice_maintenance', true) = 'on' then return new; end if;
  if old.issued_at is null and old.billed_in is null then return new; end if;
  if old.is_rx then mutable := mutable || array['lab_order_no']; end if;
  if (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable) then
    raise exception 'This order has been invoiced. Reopen the invoice before editing.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;
