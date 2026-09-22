-- ============================================================================
-- Allow ADD to be 0.
--
-- The original bound was 0.25 to 6, on the reasoning that an addition below a
-- quarter dioptre is not a real prescription. In practice 0 gets typed to mean
-- "no addition on this line" — and a form that rejects it is just in the way.
--
-- 0 and NULL are both accepted and both mean the same thing here. The range
-- and the quarter-step rule are otherwise unchanged.
-- ============================================================================

alter table public.order_lines
  drop constraint if exists order_lines_add_step;
alter table public.order_lines
  add constraint order_lines_add_step
  check (add_power is null or (add_power between 0 and 6 and mod(add_power, 0.25) = 0));

alter table public.stock_bins
  drop constraint if exists stock_bins_add_step;
alter table public.stock_bins
  add constraint stock_bins_add_step
  check (add_power is null or (add_power between 0 and 6 and mod(add_power, 0.25) = 0));
