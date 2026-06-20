-- Aim Dojo — daily seeded challenge board
-- Run ONCE in the Supabase SQL editor for project hgvnytaqmuybzbotosyj. Safe to re-run.

create table if not exists public.aimdojo_daily (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,                                   -- per-device id (one best per player per day)
  name        text not null check (char_length(name) <= 24),
  day         text not null check (char_length(day) <= 12),    -- UTC day key, e.g. 2026-6-19
  score       int  not null check (score between 0 and 5000),  -- kills in the fixed-length challenge
  accuracy    int,
  best_streak int,
  replay      text,                                            -- compact ghost replay (quantized aim path + hit times)
  created_at  timestamptz not null default now()
);

-- if you created this table before ghosts existed, add the column:
alter table public.aimdojo_daily add column if not exists replay text;

create index if not exists aimdojo_daily_day_score_idx on public.aimdojo_daily (day, score desc);
create index if not exists aimdojo_daily_client_idx     on public.aimdojo_daily (client_id);

-- Public board: anon may READ everyone's daily scores and INSERT their own.
alter table public.aimdojo_daily enable row level security;

drop policy if exists "aimdojo_daily read"   on public.aimdojo_daily;
create policy "aimdojo_daily read"   on public.aimdojo_daily for select to anon using (true);

drop policy if exists "aimdojo_daily insert" on public.aimdojo_daily;
create policy "aimdojo_daily insert" on public.aimdojo_daily for insert to anon
  with check (char_length(name) <= 24 and char_length(day) <= 12 and score between 0 and 5000);
