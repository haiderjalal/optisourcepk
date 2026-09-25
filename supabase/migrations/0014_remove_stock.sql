-- ============================================================================
-- Make removing stock work.
--
-- adjust_stock did every movement as INSERT ... ON CONFLICT DO UPDATE, with
-- the delta as the inserted quantity. Postgres checks CHECK constraints on the
-- row it is about to insert *before* it looks for the conflict, so a negative
-- delta was refused by `qty_on_hand >= 0` even when the bin held plenty:
-- 20 on hand, remove 10, "would take the stock below zero".
--
-- Receiving is unchanged. Removing now locks the existing bin, checks the
-- count, and updates it — with a message that says what is actually there.
-- Same signature, so existing grants and callers carry over.
-- ============================================================================

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_sph        numeric,
  p_cyl        numeric,
  p_add        numeric,
  p_eye        text,
  p_delta      integer,
  p_reason     stock_reason default 'adjustment',
  p_note       text default null)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  p      record;
  v_bin  uuid;
  v_qty  integer;
  v_cyl  numeric := nullif(p_cyl, 0);             -- zero cylinder means none
  v_add  numeric := nullif(p_add, 0);             -- zero addition means none
  v_eye  text    := nullif(btrim(coalesce(p_eye, '')), '');
begin
  if p_delta = 0 then raise exception 'Enter a quantity other than zero.'; end if;

  select * into p from products
   where id = p_product_id and tracks_stock and deleted_at is null;

  if not found then
    raise exception
      'Cannot hold stock of that product. It is either archived, or set up as a service rather than something you stock.'
      using errcode = 'restrict_violation';
  end if;

  if p_delta > 0 then
    insert into stock_bins (product_id, tracks_power, sph, cyl, add_power, eye, qty_on_hand)
    values (p.id, p.tracks_power,
            p_sph,                                -- 0.00 is plano: a real power, kept
            v_cyl, v_add, v_eye, p_delta)
    on conflict on constraint stock_bins_key_uq
      do update set qty_on_hand = stock_bins.qty_on_hand + p_delta, updated_at = now()
    returning id, qty_on_hand into v_bin, v_qty;
  else
    select id, qty_on_hand into v_bin, v_qty
      from stock_bins
     where product_id = p.id
       and sph       is not distinct from p_sph
       and cyl       is not distinct from v_cyl
       and add_power is not distinct from v_add
       and eye       is not distinct from v_eye
     for update;

    if v_bin is null then
      raise exception
        'There is no stock of % at that power to remove. Check the SPH, CYL, ADD and eye match what is on the shelf.',
        p.name
        using errcode = 'restrict_violation';
    end if;

    if v_qty + p_delta < 0 then
      raise exception
        'Only % % of % on hand at that power, so % cannot be removed.',
        v_qty, p.unit, p.name, -p_delta
        using errcode = 'restrict_violation';
    end if;

    update stock_bins
       set qty_on_hand = qty_on_hand + p_delta, updated_at = now()
     where id = v_bin
    returning qty_on_hand into v_qty;
  end if;

  insert into stock_movements (bin_id, delta, reason, note)
  values (v_bin, p_delta, p_reason, p_note);

  return v_qty;
end $$;
