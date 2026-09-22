-- ============================================================================
-- Per-product power ranges.
--
-- Each product can declare the range it is made in — SPH, CYL, ADD, axis and
-- which eyes. Two payoffs: the receive form can bound and step its inputs
-- instead of accepting any number, and a whole grid of bins can be created in
-- one go rather than typed power by power.
--
-- Every column is nullable. A product with no range behaves exactly as before.
-- ============================================================================

alter table public.products
  add column if not exists sph_min  numeric(5,2),
  add column if not exists sph_max  numeric(5,2),
  add column if not exists sph_step numeric(4,2),
  add column if not exists cyl_min  numeric(5,2),
  add column if not exists cyl_max  numeric(5,2),
  add column if not exists cyl_step numeric(4,2),
  add column if not exists add_min  numeric(4,2),
  add column if not exists add_max  numeric(4,2),
  add column if not exists add_step numeric(4,2),
  add column if not exists axis_min  integer,
  add column if not exists axis_max  integer,
  add column if not exists axis_step integer,
  -- 'both' means the item is not eye-specific; 'R'/'L' pin it to one side.
  add column if not exists eyes text;

alter table public.products drop constraint if exists products_eyes_valid;
alter table public.products
  add constraint products_eyes_valid
  check (eyes is null or eyes in ('both', 'R', 'L'));

-- A range must run the right way round, and a step must move.
alter table public.products drop constraint if exists products_sph_range;
alter table public.products
  add constraint products_sph_range
  check ((sph_min is null or sph_max is null or sph_min <= sph_max)
     and (sph_step is null or sph_step > 0));

alter table public.products drop constraint if exists products_cyl_range;
alter table public.products
  add constraint products_cyl_range
  check ((cyl_min is null or cyl_max is null or cyl_min <= cyl_max)
     and (cyl_step is null or cyl_step > 0));

alter table public.products drop constraint if exists products_add_range;
alter table public.products
  add constraint products_add_range
  check ((add_min is null or add_max is null or add_min <= add_max)
     and (add_step is null or add_step > 0));

alter table public.products drop constraint if exists products_axis_range;
alter table public.products
  add constraint products_axis_range
  check ((axis_min is null or axis_min between 0 and 180)
     and (axis_max is null or axis_max between 0 and 180)
     and (axis_min is null or axis_max is null or axis_min <= axis_max)
     and (axis_step is null or axis_step > 0));


-- ============================================================================
-- Create every bin in a product's range at once.
--
-- One transaction: either the whole grid is laid out or none of it is. Each
-- bin is created at p_qty, or topped up if it already exists, so running it
-- twice does not double anything it did not mean to.
--
-- Returns the number of bins touched.
-- ============================================================================
create or replace function public.receive_range(
  p_product_id uuid,
  p_qty        integer,
  p_alert      integer default null)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  p record;
  s numeric; c numeric; a numeric;
  v_eyes text[];
  e text;
  v_count integer := 0;
  v_bin uuid;
  -- A guard, not a preference: an SPH x CYL x ADD grid multiplies fast, and
  -- silently creating tens of thousands of rows helps nobody.
  v_limit constant integer := 5000;
begin
  if p_qty < 0 then raise exception 'Quantity cannot be negative.'; end if;

  select * into p from products
   where id = p_product_id and tracks_stock and deleted_at is null;

  if not found then
    raise exception
      'Cannot hold stock of that product. It is either archived, or set up as a service.'
      using errcode = 'restrict_violation';
  end if;

  if p.sph_min is null or p.sph_max is null or coalesce(p.sph_step, 0) <= 0 then
    raise exception
      'Set an SPH range and step on the product before filling it.'
      using errcode = 'restrict_violation';
  end if;

  v_eyes := case
              when p.eyes = 'R' then array['R']
              when p.eyes = 'L' then array['L']
              else array[null]::text[]
            end;

  s := p.sph_min;
  while s <= p.sph_max loop
    -- Each dimension collapses to a single NULL pass when it has no range,
    -- so one set of loops covers every shape of product.
    c := case when p.cyl_min is not null and coalesce(p.cyl_step, 0) > 0
              then p.cyl_min else null end;
    loop
      a := case when p.add_min is not null and coalesce(p.add_step, 0) > 0
                then p.add_min else null end;
      loop
        foreach e in array v_eyes loop
          v_count := v_count + 1;
          if v_count > v_limit then
            raise exception
              'That range would create more than % bins. Narrow it, or widen the step.', v_limit
              using errcode = 'restrict_violation';
          end if;

          insert into stock_bins
            (product_id, tracks_power, sph, cyl, add_power, eye,
             qty_on_hand, reorder_level)
          values (p.id, p.tracks_power, s, nullif(c, 0), nullif(a, 0), e,
                  p_qty, coalesce(p_alert, 0))
          on conflict on constraint stock_bins_key_uq do update
            set qty_on_hand   = stock_bins.qty_on_hand + p_qty,
                reorder_level = coalesce(p_alert, stock_bins.reorder_level),
                updated_at    = now()
          returning id into v_bin;

          if p_qty <> 0 then
            insert into stock_movements (bin_id, delta, reason, note)
            values (v_bin, p_qty, 'purchase', 'Range fill');
          end if;
        end loop;

        exit when a is null;
        a := a + p.add_step;
        exit when a > p.add_max;
      end loop;

      exit when c is null;
      c := c + p.cyl_step;
      exit when c > p.cyl_max;
    end loop;

    s := s + p.sph_step;
  end loop;

  return v_count;
end $$;

grant execute on function public.receive_range(uuid, integer, integer) to authenticated;
