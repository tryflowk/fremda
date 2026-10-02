-- Cloud copy of each reader's progress (see src/lib/sync.ts): one row per person.
create table if not exists public.verba_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.verba_progress enable row level security;

create policy "read own progress" on public.verba_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own progress" on public.verba_progress
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own progress" on public.verba_progress
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
