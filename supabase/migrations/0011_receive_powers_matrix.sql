-- ============================================================================
-- Let each received entry carry its own CYL and ADD.
--
-- 0010 took a list of spheres with one cylinder for the whole batch, which is
-- right for a single-vision delivery but not for stock held as a matrix: there
-- the shelf is a grid, and every SPH x CYL square is its own box with its own
-- count.
--
-- An entry may now name its own cyl/add; when it does not, the batch values
-- are used. Both shapes go through the same function.
-- ============================================================================

create or replace function public.receive_powers(
  p_product_id uuid,
  p_entries    jsonb,
  p_cyl        numeric default null,
  p_add        numeric default null,
  p_eye        text    default null,
  p_alert      integer default null,
  p_reason     stock_reason default 'purchase',
  p_note       text default null)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  p record;
  e jsonb;
  v_sph numeric;
  v_cyl numeric;
  v_add numeric;
  v_qty integer;
  v_bin uuid;
  v_count integer := 0;
  v_limit constant integer := 5000;
begin
  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Expected a list of powers and quantities.';
  end if;

  select * into p from products
   where id = p_product_id and tracks_stock and deleted_at is null;

  if not found then
    raise exception
      'Cannot hold stock of that product. It is either archived, or set up as a service.'
      using errcode = 'restrict_violation';
  end if;

  for e in select * from jsonb_array_elements(p_entries)
  loop
    v_qty := coalesce((e->>'qty')::integer, 0);
    continue when v_qty = 0;

    v_count := v_count + 1;
    if v_count > v_limit then
      raise exception 'That is more than % entries in one go.', v_limit
        using errcode = 'restrict_violation';
    end if;

    -- A null anywhere is legitimate: it is the general bin for that axis.
    v_sph := case when e->>'sph' is null then null else (e->>'sph')::numeric end;

    -- The entry wins when it names a value; otherwise the batch value applies.
    v_cyl := case when e ? 'cyl' and e->>'cyl' is not null
                  then (e->>'cyl')::numeric else p_cyl end;
    v_add := case when e ? 'add' and e->>'add' is not null
                  then (e->>'add')::numeric else p_add end;

    insert into stock_bins
      (product_id, tracks_power, sph, cyl, add_power, eye, qty_on_hand, reorder_level)
    values (p.id, p.tracks_power, v_sph,
            nullif(v_cyl, 0), nullif(v_add, 0),
            nullif(btrim(coalesce(p_eye, '')), ''),
            v_qty, coalesce(p_alert, 0))
    on conflict on constraint stock_bins_key_uq do update
      set qty_on_hand   = stock_bins.qty_on_hand + v_qty,
          reorder_level = coalesce(p_alert, stock_bins.reorder_level),
          updated_at    = now()
    returning id into v_bin;

    insert into stock_movements (bin_id, delta, reason, note)
    values (v_bin, v_qty, p_reason, p_note);
  end loop;

  return v_count;
end $$;

grant execute on function public.receive_powers(uuid, jsonb, numeric, numeric, text, integer, stock_reason, text) to authenticated;
