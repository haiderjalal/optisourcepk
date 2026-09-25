-- ============================================================================
-- Shop expenses: the day-to-day running costs — fitting charges, delivery,
-- milk, chai, drinks — entered as an item and an amount, and read by month.
--
-- Deleting an entry hides it (deleted_at) rather than removing the row, so a
-- mistaken delete can be recovered and the month's history stays auditable.
-- ============================================================================

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  expense_date date not null default (now() at time zone 'Asia/Karachi')::date,
  item         text not null check (btrim(item) <> '' and length(item) <= 120),
  amount       numeric(12,2) not null check (amount > 0),
  note         text check (note is null or length(note) <= 400),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index expenses_date_idx
  on public.expenses (expense_date desc) where deleted_at is null;
create trigger expenses_touch before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.expenses enable row level security;
create policy owner_all on public.expenses
  for all to authenticated using (true) with check (true);
revoke all on public.expenses from anon;
