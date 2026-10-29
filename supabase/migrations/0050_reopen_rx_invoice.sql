-- ============================================================================
-- A combined RX invoice can be reopened to add stock items and freight.
--
-- Migration 0048 refused this, because reopening used to lead to the normal order
-- form, which rewrote every line and stripped the lab status from the lenses.
-- Editing now goes through the invoice's own form, which keeps the RX lines and
-- replaces only the stock items. Reopening reverses the invoice's stock and
-- ledger postings, so issuing it again takes the stock once, with the freight.
--
-- The body is migration 0034's, without the combined-invoice check.
-- ============================================================================

create or replace function public.reopen_invoice(p_order_id uuid)
returns public.orders
language plpgsql security definer
set search_path = public, pg_temp as $$
declare o public.orders;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Invoice was not found.'; end if;
  if o.issued_at is null then
    raise exception 'That record is not an issued invoice.'
      using errcode = 'restrict_violation';
  end if;
  if o.voided_at is not null then
    raise exception 'A voided invoice cannot be edited, but it can be deleted.'
      using errcode = 'restrict_violation';
  end if;

  perform public.reverse_invoice_posting(p_order_id);
  perform set_config('app.invoice_maintenance', 'on', true);

  update public.orders set
     status = 'created',
     dispatched_at = null, delivered_at = null,
     delivered_by = null, delivery_note = null,
     -- Keep the number and date for when it is issued again.
     reserved_invoice_no = coalesce(o.reserved_invoice_no, o.invoice_no),
     reserved_issued_at  = coalesce(o.reserved_issued_at, o.issued_at),
     issued_at = null, invoice_no = null,
     order_qty = null, lens_qty = null,
     invoice_amount = null, discount_amount = null,
     net_amount = null,
     gst_amount = null,
     additional_tax_amount = null,
     amount_incl_tax = null,
     previous_balance = null, closing_balance = null,
     voided_at = null, void_reason = null,
     bill_to_name = null, bill_to_shop = null,
     bill_to_address = null, bill_to_phone = null,
     bill_to_ntn = null, bill_to_strn = null
   where id = p_order_id
   returning * into o;

  return o;
end $$;

revoke all on function public.reopen_invoice(uuid) from public;
grant execute on function public.reopen_invoice(uuid) to authenticated;
