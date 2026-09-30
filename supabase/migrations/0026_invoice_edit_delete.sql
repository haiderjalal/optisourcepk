-- ============================================================================
-- Reopen and delete invoices safely.
--
-- Issuing an invoice posts stock movements and a ledger entry. Editing or
-- deleting it must therefore undo those postings in the same transaction;
-- changing only the order row would leave stock and customer balances wrong.
-- Reopening intentionally retires the old invoice number. The edited draft
-- receives the next number when it is issued again.
-- ============================================================================

-- The ordinary freeze triggers still protect issued invoices. These functions
-- set a transaction-local flag only while carrying out a complete reversal.
create or replace function public.freeze_issued_order() returns trigger
language plpgsql as $$
declare mutable text[] := array['status','dispatched_at','delivered_at','delivered_by',
                                'delivery_note','courier_name','tracking_no',
                                'voided_at','void_reason','notes','updated_at',
                                'rx_no','rx_stage','rx_sent_at','rx_back_at','billed_in'];
begin
  if current_setting('app.invoice_maintenance', true) = 'on' then return new; end if;
  if old.issued_at is null and old.billed_in is null then return new; end if;
  if (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable) then
    raise exception 'This order has been invoiced. Reopen the invoice before editing.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end $$;

create or replace function public.freeze_issued_lines() returns trigger
language plpgsql as $$
declare
  v_order uuid;
  tracking text[] := array['unit_cost','supplier_id','rx_status','received_at','updated_at',
                           'line_gross','line_discount','line_total'];
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

-- Restore the net stock effect and remove the matching accounting/history
-- rows. Both sale-only and already-voided invoices are handled: a voided
-- invoice has a net movement of zero.
create or replace function public.reverse_invoice_posting(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp as $$
declare r record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  for r in
    select bin_id, sum(delta)::integer as net_delta
      from public.stock_movements
     where order_id = p_order_id
     group by bin_id
     order by bin_id
  loop
    if r.net_delta <> 0 then
      update public.stock_bins
         set qty_on_hand = qty_on_hand - r.net_delta,
             updated_at = now()
       where id = r.bin_id;
    end if;
  end loop;

  delete from public.stock_movements where order_id = p_order_id;
  delete from public.ledger_entries where order_id = p_order_id;
end $$;

revoke all on function public.reverse_invoice_posting(uuid) from public;

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
     issued_at = null, invoice_no = null,
     order_qty = null, lens_qty = null,
     invoice_amount = null, discount_amount = null,
     freight_charge = 0, net_amount = null,
     gst_rate = 0, gst_amount = null,
     additional_tax_rate = 0, additional_tax_amount = null,
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

create or replace function public.delete_invoice(p_order_id uuid)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp as $$
declare o public.orders;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if o.issued_at is null then
    raise exception 'That record is not an issued invoice.'
      using errcode = 'restrict_violation';
  end if;

  perform public.reverse_invoice_posting(p_order_id);

  perform set_config('app.invoice_maintenance', 'on', true);
  update public.orders set billed_in = null where billed_in = p_order_id;
  delete from public.orders where id = p_order_id;
  return true;
end $$;

revoke all on function public.reopen_invoice(uuid) from public;
revoke all on function public.delete_invoice(uuid) from public;
grant execute on function public.reopen_invoice(uuid) to authenticated;
grant execute on function public.delete_invoice(uuid) to authenticated;

