-- ============================================================================
-- Let a purchase line's cost be corrected after the purchase is saved.
--
-- Purchases stay append-only for everything that moved stock: quantity,
-- product and powers cannot change (the stock movement already happened). The
-- cost is only a price — fixing a typo in it, or entering it when the
-- supplier's bill arrives late, changes no stock. So exactly that one column
-- becomes updatable, by column privilege; RLS opens UPDATE, the grant limits
-- it to unit_cost, and the existing CHECK keeps it >= 0.
-- ============================================================================

drop policy if exists edit_cost on public.purchase_invoice_lines;
create policy edit_cost on public.purchase_invoice_lines
  for update to authenticated using (true) with check (true);

revoke update on public.purchase_invoice_lines from authenticated;
grant update (unit_cost) on public.purchase_invoice_lines to authenticated;
