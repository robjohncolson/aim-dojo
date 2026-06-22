-- Aim Dojo — global DOJO RECORDS board (free-play session bests). THE DOJO PIVOT.
-- Run ONCE in the Supabase SQL editor for project hgvnytaqmuybzbotosyj. Safe to re-run.
-- Ranks free-play runs across five metrics: farthest hit, highest hit, best streak,
-- peak tempo, and total targets neutralized (kills). The board dedups to each client's
-- best in the active sort column (client-side, like aimdojo_daily).
--
-- NOTE: free-play has NO seed/replay, so there is NO replay verification like the daily.
-- Anti-cheat is best-effort SANITY caps (here + in the Railway /dojo endpoint), not proof.

create table if not exists public.aimdojo_dojo (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,                                       -- per-device id (one best per player)
  name        text not null check (char_length(name) <= 24),
  far         real not null check (far  >= 0 and far  <= 50),      -- farthest hit (m); room diagonal ~46.3 (railgun hit-scan reach; ARC ballistic max ~36)
  high        real not null check (high >= 0 and high <= 30),      -- highest hit (m); room cap ~25.5 (ROOM_BY)
  streak      int  not null check (streak    between 0 and 5000),  -- best streak this run
  peak_bpm    int  not null check (peak_bpm  between 0 and 400),   -- peak tempo (bpm); engine max 172
  kills       int  not null check (kills     between 0 and 5000),  -- total targets neutralized this session
  created_at  timestamptz not null default now()
);

create index if not exists aimdojo_dojo_kills_idx  on public.aimdojo_dojo (kills    desc);
create index if not exists aimdojo_dojo_streak_idx on public.aimdojo_dojo (streak   desc);
create index if not exists aimdojo_dojo_bpm_idx    on public.aimdojo_dojo (peak_bpm desc);
create index if not exists aimdojo_dojo_far_idx    on public.aimdojo_dojo (far      desc);
create index if not exists aimdojo_dojo_high_idx   on public.aimdojo_dojo (high     desc);
create index if not exists aimdojo_dojo_client_idx on public.aimdojo_dojo (client_id);

-- Public board: anon may READ everyone's records.
alter table public.aimdojo_dojo enable row level security;

drop policy if exists "aimdojo_dojo read" on public.aimdojo_dojo;
create policy "aimdojo_dojo read" on public.aimdojo_dojo for select to anon using (true);

-- Anon INSERT is enabled here for the direct-insert fallback (when RAILWAY_URL is empty
-- in index.html). Once the Railway /dojo endpoint is deployed + verified, DROP this policy
-- so the service-role server becomes the sole writer (mirrors what we did for aimdojo_daily):
--     drop policy "aimdojo_dojo insert" on public.aimdojo_dojo;
drop policy if exists "aimdojo_dojo insert" on public.aimdojo_dojo;
create policy "aimdojo_dojo insert" on public.aimdojo_dojo for insert to anon
  with check (char_length(name) <= 24
    and far    between 0 and 50   and high     between 0 and 30
    and streak between 0 and 5000 and peak_bpm between 0 and 400 and kills between 0 and 5000);
