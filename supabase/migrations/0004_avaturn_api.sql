-- =====================================================================
-- LOVE MUSEUM — Avaturn API: one Avaturn user per Love Museum user
-- Run AFTER 0001–0003. Safe to re-run.
-- =====================================================================

create table if not exists public.avaturn_users (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  avaturn_user_id text not null unique,
  created_at      timestamptz not null default now()
);

alter table public.avaturn_users enable row level security;

drop policy if exists "avaturn users own" on public.avaturn_users;
create policy "avaturn users own" on public.avaturn_users for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
