-- ============================================================================
-- An RX job can name its lens coating, printed on the lens sticker.
--
-- The coating is a plain label on the RX order, like the tint reason. Only RX
-- orders use it. The invoice freeze keeps it as issued, the same as every other
-- RX card field once the order is billed.
-- ============================================================================

alter table public.orders
  add column if not exists rx_coating text
    check (rx_coating is null or length(rx_coating) between 1 and 80);

comment on column public.orders.rx_coating is
  'RX only: the lens coating, printed on the lens sticker (for example NIGHT VISION).';
