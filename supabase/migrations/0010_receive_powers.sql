-- ============================================================================
-- Take in a whole column of powers at once.
--
-- receive_range fills every bin with the same quantity, which is right when
-- setting a product up but wrong when a delivery arrives: real deliveries are
-- a different count against each power. This takes a list of power/quantity
-- pairs and applies them in one transaction.
--
-- Powers with no quantity are simply left out by the caller, so an untouched
-- row costs nothing.
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
  v_qty integer;
  v_bin uuid;
  v_count integer := 0;
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
    -- A null power is legitimate: it is the general bin for goods held
    -- without one.
    v_sph := case when e->>'sph' is null then null else (e->>'sph')::numeric end;
    v_qty := coalesce((e->>'qty')::integer, 0);

    continue when v_qty = 0;

    insert into stock_bins
      (product_id, tracks_power, sph, cyl, add_power, eye, qty_on_hand, reorder_level)
    values (p.id, p.tracks_power, v_sph,
            nullif(p_cyl, 0), nullif(p_add, 0),
            nullif(btrim(coalesce(p_eye, '')), ''),
            v_qty, coalesce(p_alert, 0))
    on conflict on constraint stock_bins_key_uq do update
      set qty_on_hand   = stock_bins.qty_on_hand + v_qty,
          reorder_level = coalesce(p_alert, stock_bins.reorder_level),
          updated_at    = now()
    returning id into v_bin;

    insert into stock_movements (bin_id, delta, reason, note)
    values (v_bin, v_qty, p_reason, p_note);

    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

grant execute on function public.receive_powers(uuid, jsonb, numeric, numeric, text, integer, stock_reason, text) to authenticated;
