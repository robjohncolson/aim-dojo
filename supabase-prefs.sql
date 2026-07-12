-- Aim Dojo cloud play preferences (signed-in users only).
-- Run once in Supabase SQL Editor. Non-sensitive prefs only — never birth data.
-- Client reads/writes with the user JWT (RLS own-row). Supersedes localStorage when present.

create table if not exists public.aimdojo_prefs (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  sky_time  text null check (sky_time is null or sky_time in ('natural', 'theatre')),
  wasd_hud  boolean null,
  offset_ms integer null check (offset_ms is null or (offset_ms between -120 and 320)),
  low_rez   boolean null,
  updated_at timestamptz not null default now()
);

alter table public.aimdojo_prefs enable row level security;

drop policy if exists "aimdojo_prefs_select_own" on public.aimdojo_prefs;
drop policy if exists "aimdojo_prefs_insert_own" on public.aimdojo_prefs;
drop policy if exists "aimdojo_prefs_update_own" on public.aimdojo_prefs;
drop policy if exists "aimdojo_prefs_delete_own" on public.aimdojo_prefs;

create policy "aimdojo_prefs_select_own"
  on public.aimdojo_prefs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "aimdojo_prefs_insert_own"
  on public.aimdojo_prefs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "aimdojo_prefs_update_own"
  on public.aimdojo_prefs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "aimdojo_prefs_delete_own"
  on public.aimdojo_prefs for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.aimdojo_prefs to authenticated;
