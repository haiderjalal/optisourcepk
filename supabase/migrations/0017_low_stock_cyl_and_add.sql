-- ============================================================================
-- Range-wide alerts for every lens layout.
--
-- 0015 counted a product with an ADD range as SPH x ADD, which dropped CYL for
-- products that have both (the stock screen shows those as one SPH x CYL table
-- per ADD). Positions are now SPH x CYL x ADD, each axis present only when its
-- range has a non-zero value — a 0.00-only range means none, as on screen.
-- ============================================================================

drop view if exists public.low_stock;

-- ponytail: positions are generated on every read. Fine for a shop-sized
-- catalogue; materialise it if a product ever declares a huge range.
create view public.low_stock with (security_invoker = true) as
with held as (
  select b.id as bin_id, p.id as product_id, p.name, p.category,
         b.sph, b.cyl, b.add_power, b.eye, b.qty_on_hand,
         greatest(b.reorder_level, coalesce(p.alert_qty, 0)) as reorder_level
    from public.stock_bins b
    join public.products p on p.id = b.product_id
   where p.deleted_at is null
),
ranged as (
  select p.*,
         (p.cyl_min is not null and p.cyl_max is not null
          and coalesce(p.cyl_step, 0) > 0 and p.cyl_max >= p.cyl_min
          and (p.cyl_min <> 0 or p.cyl_max <> 0)) as has_cyl,
         (p.add_min is not null and p.add_max is not null
          and coalesce(p.add_step, 0) > 0 and p.add_max >= p.add_min
          and (p.add_min <> 0 or p.add_max <> 0)) as has_add
    from public.products p
   where p.deleted_at is null
     and p.tracks_stock and p.tracks_power
     and p.alert_qty is not null
     and p.sph_min is not null and p.sph_max is not null
     and coalesce(p.sph_step, 0) > 0 and p.sph_max >= p.sph_min
),
positions as (
  select r.id as product_id, r.name, r.category, r.alert_qty,
         r.sph_min + s.i * r.sph_step as sph,
         c.cyl, a.add_power
    from ranged r
   cross join lateral generate_series(
           0, floor((r.sph_max - r.sph_min) / r.sph_step)::int) as s(i)
   cross join lateral (
     -- A zero CYL or ADD is stored as NULL, so it is the same position.
     select nullif(r.cyl_min + g.j * r.cyl_step, 0) as cyl
       from generate_series(
              0, floor((r.cyl_max - r.cyl_min) / r.cyl_step)::int) as g(j)
      where r.has_cyl
     union all
     select null::numeric where not r.has_cyl
   ) c
   cross join lateral (
     select nullif(r.add_min + g.j * r.add_step, 0) as add_power
       from generate_series(
              0, floor((r.add_max - r.add_min) / r.add_step)::int) as g(j)
      where r.has_add
     union all
     select null::numeric where not r.has_add
   ) a
)
select h.bin_id, h.product_id, h.name, h.category,
       h.sph, h.cyl, h.add_power, h.eye,
       h.qty_on_hand, h.reorder_level,
       h.reorder_level - h.qty_on_hand as shortfall
  from held h
 where h.qty_on_hand <= h.reorder_level
union all
select null::uuid, pos.product_id, pos.name, pos.category,
       pos.sph, pos.cyl, pos.add_power, null::text,
       0, pos.alert_qty, pos.alert_qty
  from positions pos
 where not exists (
         select 1 from public.stock_bins b
          where b.product_id = pos.product_id
            and b.sph = pos.sph
            and b.cyl       is not distinct from pos.cyl
            and b.add_power is not distinct from pos.add_power);

grant select on public.low_stock to authenticated;
revoke all on public.low_stock from anon;
