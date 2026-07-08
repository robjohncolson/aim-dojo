-- Aim Dojo — add TIME (runtime) column for the 2-metric dojo board (BPM + TIME).
-- Run ONCE in the Supabase SQL editor for project hgvnytaqmuybzbotosyj.
-- Safe to re-run (IF NOT EXISTS).
--
-- Why: the web client ranks free-play by peak_bpm + runtime (seconds).
-- The original aimdojo_dojo table only had far/high/streak/peak_bpm/kills.
-- Without this column, SELECT ... runtime fails (42703) and the board shows "offline".

alter table public.aimdojo_dojo
  add column if not exists runtime real not null default 0
  check (runtime >= 0 and runtime <= 7200);

create index if not exists aimdojo_dojo_runtime_idx
  on public.aimdojo_dojo (runtime desc);

-- Optional: allow anon insert of the simplified payload shape (if you still use direct Supabase insert).
-- Railway /dojo with service role bypasses RLS and does not need this.
drop policy if exists "aimdojo_dojo insert" on public.aimdojo_dojo;
create policy "aimdojo_dojo insert" on public.aimdojo_dojo for insert to anon
  with check (
    char_length(name) <= 24
    and far    between 0 and 50
    and high   between 0 and 30
    and streak between 0 and 5000
    and peak_bpm between 0 and 400
    and kills  between 0 and 5000
    and runtime between 0 and 7200
  );
