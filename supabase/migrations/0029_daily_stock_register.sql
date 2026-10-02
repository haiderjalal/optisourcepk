-- A separate day-by-day register for fast-turnover items. These rows do not
-- alter stock_bins: permanent inventory keeps its existing movement ledger,
-- while this register records the morning-to-evening daily count.

create table public.daily_stock_entries (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  product_name text not null check (btrim(product_name) <> ''),
  unit text not null check (btrim(unit) <> ''),
  entry_date date not null default (now() at time zone 'Asia/Karachi')::date,
  opening_qty integer not null default 0 check (opening_qty >= 0),
  received_qty integer not null default 0 check (received_qty >= 0),
  outgoing_qty integer not null default 0 check (outgoing_qty >= 0),
  closing_qty integer generated always as
    (opening_qty + received_qty - outgoing_qty) stored,
  note text check (note is null or char_length(note) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_stock_nonnegative_closing
    check (opening_qty + received_qty - outgoing_qty >= 0),
  constraint daily_stock_one_item_per_day unique (product_id, entry_date)
);

create index daily_stock_entries_date_idx
  on public.daily_stock_entries (entry_date desc, updated_at desc);

create trigger daily_stock_entries_touch
  before update on public.daily_stock_entries
  for each row execute function public.set_updated_at();

alter table public.daily_stock_entries enable row level security;

revoke all on table public.daily_stock_entries from anon, authenticated;
grant select, insert, update on table public.daily_stock_entries to authenticated;

create policy daily_stock_read on public.daily_stock_entries
  for select to authenticated using (true);
create policy daily_stock_add on public.daily_stock_entries
  for insert to authenticated with check (true);
create policy daily_stock_change on public.daily_stock_entries
  for update to authenticated using (true) with check (true);

