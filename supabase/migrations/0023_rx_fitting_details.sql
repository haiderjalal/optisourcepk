-- ============================================================================
-- RX fitting details, per eye: dia, base, fitting height, prism, IPD.
--
-- Kept as short text rather than numbers: labs and opticians write these in
-- more than one way ("65", "2 BU", "31.5"), and the point is to pass them on
-- exactly as given. Only RX lines use them.
-- ============================================================================

alter table public.order_lines
  add column if not exists rx_dia            text,
  add column if not exists rx_base           text,
  add column if not exists rx_fitting_height text,
  add column if not exists rx_prism          text,
  add column if not exists rx_ipd            text;

alter table public.order_lines drop constraint if exists order_lines_rx_fitting_length;
alter table public.order_lines add constraint order_lines_rx_fitting_length check (
  coalesce(length(rx_dia), 0) <= 20 and coalesce(length(rx_base), 0) <= 20 and
  coalesce(length(rx_fitting_height), 0) <= 20 and coalesce(length(rx_prism), 0) <= 20 and
  coalesce(length(rx_ipd), 0) <= 20);
