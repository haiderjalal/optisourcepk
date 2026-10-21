-- ============================================================================
-- Edit a saved purchase: its header, its lines, and the stock they moved.
--
-- Until now a purchase was kept as entered, except for the cost of a line
-- (0030). An edit changes stock, so it is done in one transaction:
--
--   1. the header is updated (supplier, invoice number, date, note);
--   2. the new lines are entered through record_purchase, the same path a new
--      purchase takes, so their stock comes in and the rules match;
--   3. the lines and stock movements the purchase had before are taken out,
--      reversing their stock.
--
-- The new stock comes in before the old is taken out, so a bin is never
-- pushed below zero on the way. If the result would leave a bin below zero,
-- that is because stock from this purchase has already been sold; the whole
-- edit is refused and nothing changes.
-- ============================================================================

create or replace function public.update_purchase(
  p_purchase_id uuid,
  p_supplier_id uuid,
  p_invoice_no  text,
  p_invoice_date date,
  p_lines       jsonb,
  p_notes       text default null)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_no text := btrim(coalesce(p_invoice_no, ''));
  v_inv uuid;
  v_old_movements uuid[];
  v_old_lines uuid[];
  m record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  perform 1 from purchase_invoices where id = p_purchase_id for update;
  if not found then
    raise exception 'That purchase was not found.' using errcode = 'restrict_violation';
  end if;

  if exists (select 1 from purchase_invoices
              where supplier_id = p_supplier_id
                and lower(btrim(invoice_no)) = lower(v_no)
                and id <> p_purchase_id) then
    raise exception 'That supplier already has a purchase with invoice number %.', v_no
      using errcode = 'restrict_violation';
  end if;

  -- What the purchase has on file now, before anything changes.
  select coalesce(array_agg(id), '{}') into v_old_movements
    from stock_movements where purchase_invoice_id = p_purchase_id;
  select coalesce(array_agg(id), '{}') into v_old_lines
    from purchase_invoice_lines where purchase_invoice_id = p_purchase_id;

  update purchase_invoices set
     supplier_id  = p_supplier_id,
     invoice_no   = v_no,
     invoice_date = coalesce(p_invoice_date, invoice_date),
     notes        = nullif(btrim(coalesce(p_notes, '')), '')
   where id = p_purchase_id;

  -- The new lines, through the same path a new purchase takes. The header
  -- matches the one just saved, so they are added to this purchase.
  v_inv := public.record_purchase(p_supplier_id, v_no, p_invoice_date, p_lines, p_notes);
  if v_inv is distinct from p_purchase_id then
    raise exception 'The purchase could not be updated.' using errcode = 'restrict_violation';
  end if;

  -- Take out what was there before, reversing its stock.
  begin
    for m in select bin_id, delta from stock_movements where id = any(v_old_movements) loop
      update stock_bins set qty_on_hand = qty_on_hand - m.delta, updated_at = now()
       where id = m.bin_id;
    end loop;
  exception when check_violation then
    raise exception 'Some of this purchase has already been sold, so it cannot be changed that far. Only what is still on the shelf can be taken back.'
      using errcode = 'restrict_violation';
  end;

  delete from stock_movements where id = any(v_old_movements);
  delete from purchase_invoice_lines where id = any(v_old_lines);

  return v_inv;
end $$;

grant execute on function public.update_purchase(uuid, uuid, text, date, jsonb, text) to authenticated;
