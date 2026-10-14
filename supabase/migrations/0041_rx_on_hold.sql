-- ============================================================================
-- Hold an RX order at the lab, with the reason written into its notes.
--
-- A lens can stall at the lab: the lab asks a question, a lens is short, the
-- job is waiting on the optician. The shop needs to record that without losing
-- the job's place in the lab stage, so the hold is a flag beside the stage
-- rather than a fourth stage.
--
-- The reason is appended to the order's notes with the date, and a release is
-- appended the same way, so the notes read as the history of the job.
--
-- A held lens cannot be marked back from the lab until the hold is released,
-- and an invoiced order cannot be put on hold.
-- ============================================================================

alter table public.orders
  add column if not exists rx_on_hold boolean not null default false;

alter table public.orders drop constraint if exists orders_rx_on_hold_only_rx;
alter table public.orders add constraint orders_rx_on_hold_only_rx
  check (is_rx or not rx_on_hold);

comment on column public.orders.rx_on_hold is
  'RX order only: held at the lab. The reason is written into notes.';

-- Put an RX order on hold, or release it.
create or replace function public.set_rx_hold(
  p_order_id uuid,
  p_on_hold  boolean,
  p_reason   text default null)
returns public.orders
language plpgsql security invoker set search_path = public as $$
declare
  o public.orders;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_entry text;
begin
  if p_on_hold and v_reason is null then
    raise exception 'Enter the reason for the hold.' using errcode = 'restrict_violation';
  end if;
  if v_reason is not null and length(v_reason) > 200 then
    raise exception 'The reason for the hold can be 200 characters at most.'
      using errcode = 'restrict_violation';
  end if;

  select * into o from orders where id = p_order_id for update;
  if not found or not o.is_rx then
    raise exception 'That is not an RX order.' using errcode = 'restrict_violation';
  end if;
  if o.issued_at is not null or o.voided_at is not null or o.billed_in is not null then
    raise exception 'RX-% is already invoiced, so it cannot be put on hold.',
      lpad(o.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;
  if p_on_hold and o.rx_stage = 'back' then
    raise exception 'RX-% is back from the lab, so it cannot be put on hold.',
      lpad(o.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;
  if p_on_hold and o.rx_on_hold then
    raise exception 'RX-% is already on hold.',
      lpad(o.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;
  if not p_on_hold and not o.rx_on_hold then
    raise exception 'RX-% is not on hold.',
      lpad(o.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;

  v_entry := case when p_on_hold
    then 'On hold ' || to_char(now() at time zone 'Asia/Karachi', 'DD Mon YYYY') || ': ' || v_reason
    else 'Hold released ' || to_char(now() at time zone 'Asia/Karachi', 'DD Mon YYYY')
  end;

  update orders set
     rx_on_hold = p_on_hold,
     notes      = concat_ws(E'\n', nullif(btrim(notes), ''), v_entry)
   where id = p_order_id returning * into o;

  return o;
end $$;

grant execute on function public.set_rx_hold(uuid, boolean, text) to authenticated;

-- Move an RX order through the lab, as 0025 had it, with one guard: a held
-- lens has not come back yet, so it cannot be marked back.
create or replace function public.set_rx_stage(p_order_id uuid, p_stage text)
returns public.orders
language plpgsql security invoker set search_path = public as $$
declare o public.orders;
begin
  if p_stage not in ('booked', 'sent', 'back') then
    raise exception 'Unknown RX stage %.', p_stage;
  end if;

  select * into o from orders where id = p_order_id for update;
  if not found or not o.is_rx then
    raise exception 'That is not an RX order.' using errcode = 'restrict_violation';
  end if;
  if o.issued_at is not null or o.voided_at is not null or o.billed_in is not null then
    raise exception 'RX-% is already invoiced, so its lab stage is final.',
      lpad(o.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;
  if p_stage = 'back' and o.rx_on_hold then
    raise exception 'RX-% is on hold. Release the hold before it comes back from the lab.',
      lpad(o.rx_no::text, 4, '0') using errcode = 'restrict_violation';
  end if;

  update orders set
     rx_stage   = p_stage,
     rx_sent_at = case when p_stage = 'booked' then null
                       else coalesce(rx_sent_at, now()) end,
     rx_back_at = case when p_stage = 'back' then coalesce(rx_back_at, now()) end
   where id = p_order_id returning * into o;

  update order_lines set
     rx_status   = case when p_stage = 'back' then 'received' else 'ordered' end,
     received_at = case when p_stage = 'back' then o.rx_back_at end
   where order_id = p_order_id and rx_status is not null;

  return o;
end $$;
