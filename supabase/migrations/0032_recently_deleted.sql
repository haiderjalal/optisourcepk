-- ============================================================================
-- Recently deleted: a 7-day recycle bin for orders, invoices, stock movements
-- and expenses.
--
-- Deleting an order or invoice keeps a complete copy in `trash` — the order,
-- its lines and, for an issued invoice, the ledger entry, stock movements and
-- daily-register postings, plus the RX orders it billed — then deletes as
-- before (reversing stock and the ledger for an invoice). Restoring puts every
-- one of those back, with the same invoice number.
--
-- A stock movement typed by hand (receive, return, adjustment) can now be
-- deleted the same way: its effect on the bin is undone, and restored on
-- Restore. Sales and purchase-invoice movements belong to their documents.
--
-- Expenses were already hidden on delete (deleted_at); they simply join the
-- bin. Anything in the bin for more than 7 days cannot be restored, and is
-- removed for good by purge_trash(), which the Recently deleted page runs.
-- ============================================================================

create table if not exists public.trash (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('order', 'stock_movement')),
  label      text not null,
  payload    jsonb not null,
  deleted_at timestamptz not null default now()
);
create index if not exists trash_deleted_at_idx on public.trash (deleted_at desc);

alter table public.trash enable row level security;
revoke all on table public.trash from anon, authenticated;
grant select on table public.trash to authenticated;
drop policy if exists trash_read on public.trash;
create policy trash_read on public.trash for select to authenticated using (true);
-- Writes go only through the functions below.

-- Insert JSON rows into a table, every column except generated ones, so a
-- restore keeps working as columns are added to these tables later.
create or replace function public.trash_insert_rows(p_table text, p_rows jsonb)
returns void
language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_cols text;
begin
  if p_rows is null or jsonb_array_length(p_rows) = 0 then return; end if;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = p_table
     and is_generated = 'NEVER';
  execute format(
    'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1)',
    p_table, v_cols) using p_rows;
end $$;

revoke all on function public.trash_insert_rows(text, jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------- orders/invoices
create or replace function public.trash_order(p_order_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  o public.orders;
  v_payload jsonb;
  v_label text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into o from orders where id = p_order_id for update;
  if not found then raise exception 'That order was not found.'; end if;
  if o.billed_in is not null then
    raise exception 'This RX order is on a combined invoice. Delete that invoice instead; this order comes back as ready to invoice.'
      using errcode = 'restrict_violation';
  end if;

  v_payload := jsonb_build_object(
    'order', to_jsonb(o),
    'lines', coalesce((select jsonb_agg(to_jsonb(l) order by l.line_no)
                         from order_lines l where l.order_id = o.id), '[]'),
    'movements', coalesce((select jsonb_agg(to_jsonb(m))
                             from stock_movements m where m.order_id = o.id), '[]'),
    'ledger', coalesce((select jsonb_agg(to_jsonb(e))
                          from ledger_entries e where e.order_id = o.id), '[]'),
    'daily', coalesce((select jsonb_agg(to_jsonb(d))
                         from daily_stock_postings d where d.order_id = o.id), '[]'),
    'billed', coalesce((select jsonb_agg(b.id)
                          from orders b where b.billed_in = o.id), '[]'));

  v_label := case
    when o.issued_at is not null then 'Invoice ' || o.invoice_no
    when o.is_rx then 'RX-' || lpad(o.rx_no::text, 4, '0')
    else 'Order ' || o.order_no end
    || ' — ' || coalesce(o.bill_to_shop,
                         (select shop_name from customers where id = o.bill_to_customer_id), '');

  if o.issued_at is not null then
    perform public.reverse_invoice_posting(o.id);
  end if;
  perform set_config('app.invoice_maintenance', 'on', true);
  update orders set billed_in = null where billed_in = o.id;
  delete from orders where id = o.id;

  insert into trash (kind, label, payload) values ('order', v_label, v_payload)
  returning id into v_id;
  return v_id;
end $$;

-- ------------------------------------------------------------ stock movements
create or replace function public.trash_stock_movement(p_movement_id uuid)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m public.stock_movements;
  v_label text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into m from stock_movements where id = p_movement_id for update;
  if not found then raise exception 'That stock entry was not found.'; end if;
  if m.order_id is not null or m.purchase_invoice_id is not null
     or m.reason in ('sale', 'void') then
    raise exception 'This stock entry belongs to an invoice or a purchase. Delete or edit that document instead.'
      using errcode = 'restrict_violation';
  end if;

  update stock_bins set qty_on_hand = qty_on_hand - m.delta, updated_at = now()
   where id = m.bin_id
     and qty_on_hand - m.delta >= 0;
  if not found then
    raise exception 'Some of this stock has already been sold or removed, so this entry cannot be deleted now.'
      using errcode = 'restrict_violation';
  end if;

  select p.name || ' ' || case when m.delta > 0 then '+' else '' end || m.delta
         || ' (' || m.reason::text || ')'
    into v_label
    from stock_bins b join products p on p.id = b.product_id
   where b.id = m.bin_id;

  delete from stock_movements where id = m.id;
  insert into trash (kind, label, payload)
  values ('stock_movement', coalesce(v_label, 'Stock entry'), to_jsonb(m))
  returning id into v_id;
  return v_id;
end $$;

-- -------------------------------------------------------------------- restore
create or replace function public.restore_trash(p_trash_id uuid)
returns text
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  t public.trash;
  r record;
  v_order uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;

  select * into t from trash where id = p_trash_id for update;
  if not found then raise exception 'That item is no longer in Recently deleted.'; end if;
  if t.deleted_at < now() - interval '7 days' then
    raise exception 'This was deleted more than 7 days ago and can no longer be restored.'
      using errcode = 'restrict_violation';
  end if;

  perform set_config('app.invoice_maintenance', 'on', true);

  if t.kind = 'order' then
    v_order := (t.payload->'order'->>'id')::uuid;
    if exists (select 1 from orders where id = v_order) then
      raise exception 'This order already exists again.' using errcode = 'restrict_violation';
    end if;

    perform trash_insert_rows('orders', jsonb_build_array(t.payload->'order'));
    perform trash_insert_rows('order_lines', t.payload->'lines');

    -- Its stock movements, applied to the bins again.
    for r in
      select (x->>'bin_id')::uuid as bin_id, sum((x->>'delta')::int)::int as delta
        from jsonb_array_elements(t.payload->'movements') x
       group by 1 order by 1
    loop
      update stock_bins set qty_on_hand = qty_on_hand + r.delta, updated_at = now()
       where id = r.bin_id and qty_on_hand + r.delta >= 0;
      if not found then
        raise exception 'There is not enough stock now to restore this invoice. Receive the stock first, then restore.'
          using errcode = 'restrict_violation';
      end if;
    end loop;
    perform trash_insert_rows('stock_movements', t.payload->'movements');

    perform trash_insert_rows('ledger_entries', t.payload->'ledger');

    -- Its daily-register outgoing, taken again.
    for r in
      select (x->>'entry_id')::uuid as entry_id, sum((x->>'qty')::int)::int as qty
        from jsonb_array_elements(t.payload->'daily') x
       group by 1 order by 1
    loop
      update daily_stock_entries set outgoing_qty = outgoing_qty + r.qty
       where id = r.entry_id
         and opening_qty + received_qty - outgoing_qty - r.qty >= 0;
      if not found then
        raise exception 'The daily register no longer has enough to restore this invoice.'
          using errcode = 'restrict_violation';
      end if;
    end loop;
    perform trash_insert_rows('daily_stock_postings', t.payload->'daily');

    -- The RX orders it billed go back on it, unless billed again since.
    if exists (select 1 from orders
                where id in (select (jsonb_array_elements_text(t.payload->'billed'))::uuid)
                  and billed_in is not null) then
      raise exception 'One of its RX orders is already on another invoice, so this invoice cannot be restored.'
        using errcode = 'restrict_violation';
    end if;
    update orders set billed_in = v_order
     where id in (select (jsonb_array_elements_text(t.payload->'billed'))::uuid);

  elsif t.kind = 'stock_movement' then
    update stock_bins set qty_on_hand = qty_on_hand + (t.payload->>'delta')::int,
                          updated_at = now()
     where id = (t.payload->>'bin_id')::uuid
       and qty_on_hand + (t.payload->>'delta')::int >= 0;
    if not found then
      raise exception 'There is not enough stock now to restore this entry.'
        using errcode = 'restrict_violation';
    end if;
    perform trash_insert_rows('stock_movements', jsonb_build_array(t.payload));
  end if;

  delete from trash where id = t.id;
  return t.label;
end $$;

-- -------------------------------------------------------------------- purge
-- Anything deleted more than 7 days ago goes for good. Run by the Recently
-- deleted page, so it happens whenever the bin is looked at.
create or replace function public.purge_trash()
returns integer
language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = 'insufficient_privilege';
  end if;
  delete from trash where deleted_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  delete from expenses where deleted_at < now() - interval '7 days';
  return v_count;
end $$;

revoke all on function public.trash_order(uuid) from public, anon;
revoke all on function public.trash_stock_movement(uuid) from public, anon;
revoke all on function public.restore_trash(uuid) from public, anon;
revoke all on function public.purge_trash() from public, anon;
grant execute on function public.trash_order(uuid) to authenticated;
grant execute on function public.trash_stock_movement(uuid) to authenticated;
grant execute on function public.restore_trash(uuid) to authenticated;
grant execute on function public.purge_trash() to authenticated;
