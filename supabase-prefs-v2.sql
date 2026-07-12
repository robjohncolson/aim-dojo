-- Aim Dojo cloud prefs v2 — run after supabase-prefs.sql (or on a fresh project).
-- Adds display/play preferences. Non-sensitive only — never birth data.
-- Safe to re-run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS patterns via DO blocks.

alter table public.aimdojo_prefs
  add column if not exists display_name text null,
  add column if not exists dojo_sort text null,
  add column if not exists sky_mode text null,
  add column if not exists sound_on boolean null,
  add column if not exists wasd_tap_text boolean null;

-- Constraints (idempotent via drop/create names)
alter table public.aimdojo_prefs drop constraint if exists aimdojo_prefs_display_name_len;
alter table public.aimdojo_prefs
  add constraint aimdojo_prefs_display_name_len
  check (display_name is null or char_length(display_name) <= 24);

alter table public.aimdojo_prefs drop constraint if exists aimdojo_prefs_dojo_sort_ck;
alter table public.aimdojo_prefs
  add constraint aimdojo_prefs_dojo_sort_ck
  check (dojo_sort is null or dojo_sort in ('peak_bpm', 'runtime'));

alter table public.aimdojo_prefs drop constraint if exists aimdojo_prefs_sky_mode_ck;
alter table public.aimdojo_prefs
  add constraint aimdojo_prefs_sky_mode_ck
  check (sky_mode is null or sky_mode in ('decorative', 'clocked', 'clocked_chart'));

-- Keep existing RLS; no policy changes required (own-row still applies to all columns).
