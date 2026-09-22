-- ============================================================================
-- Default every power step to 0.25.
--
-- Quarter dioptres are what the whole trade is made in, and every check in
-- this schema already enforces them. Asking for the step on each product was
-- three fields that only ever held one value.
--
-- The columns stay, so a line that genuinely comes in half-dioptre steps can
-- still say so — it is now a change rather than an entry.
-- ============================================================================

alter table public.products
  alter column sph_step set default 0.25,
  alter column cyl_step set default 0.25,
  alter column add_step set default 0.25;

-- Fill in what is already there. Harmless where no range is set: the range
-- fill needs a min and a max as well, so a step alone does nothing.
update public.products
   set sph_step = coalesce(sph_step, 0.25),
       cyl_step = coalesce(cyl_step, 0.25),
       add_step = coalesce(add_step, 0.25),
       updated_at = now()
 where sph_step is null or cyl_step is null or add_step is null;
