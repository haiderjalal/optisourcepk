-- ============================================================================
-- RX lens type: add Blended (invisible bifocal) to SV / KRY / DBF / PROG.
-- 'nv' stays allowed for orders booked before KRY replaced it (see 0022).
-- ============================================================================

alter table public.orders drop constraint if exists orders_rx_lens_type_valid;
alter table public.orders add constraint orders_rx_lens_type_valid
  check (rx_lens_type in ('sv', 'kry', 'nv', 'dbf', 'prog', 'blended'));
