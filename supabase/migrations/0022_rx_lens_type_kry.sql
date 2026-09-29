-- ============================================================================
-- RX lens type: KRY (Kryptok bifocal) replaces NV on the job card.
--
-- 'nv' stays allowed so RX orders already booked with it, including issued
-- ones that cannot be edited, still satisfy the rule. New orders offer KRY.
-- ============================================================================

alter table public.orders drop constraint if exists orders_rx_lens_type_valid;
alter table public.orders add constraint orders_rx_lens_type_valid
  check (rx_lens_type in ('sv', 'kry', 'nv', 'dbf', 'prog'));
