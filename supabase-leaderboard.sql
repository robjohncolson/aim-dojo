-- Aim Dojo — global leaderboard table + RLS
-- Run ONCE in the Supabase SQL editor for project hgvnytaqmuybzbotosyj
-- (Dashboard → SQL Editor → New query → paste → Run). Safe to re-run.

create table if not exists public.aimdojo_scores (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,                                   -- per-device id (localStorage), used to keep one best per player
  name        text not null check (char_length(name) <= 24),  -- display name
  score       int  not null check (score between 0 and 400),  -- peak BPM (the ranked metric)
  hits        int,
  accuracy    int,                                            -- click %
  avg_path    int,                                            -- avg path efficiency %
  best_streak int,
  mode        text default 'rhythm',
  created_at  timestamptz not null default now()
);

create index if not exists aimdojo_scores_score_idx  on public.aimdojo_scores (score desc);
create index if not exists aimdojo_scores_client_idx on public.aimdojo_scores (client_id);

-- Public leaderboard: anon may READ everyone's scores and INSERT their own.
-- (No update/delete for anon, so players can't tamper with others' rows.)
alter table public.aimdojo_scores enable row level security;

drop policy if exists "aimdojo read"   on public.aimdojo_scores;
create policy "aimdojo read"   on public.aimdojo_scores for select to anon using (true);

drop policy if exists "aimdojo insert" on public.aimdojo_scores;
create policy "aimdojo insert" on public.aimdojo_scores for insert to anon
  with check (char_length(name) <= 24 and score between 0 and 400);
