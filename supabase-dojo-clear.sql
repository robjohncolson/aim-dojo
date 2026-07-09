-- Aim Dojo — WIPE the global dojo leaderboard (old-version junk / clean slate).
-- Run in Supabase SQL Editor for project hgvnytaqmuybzbotosyj.
-- ⚠️ DESTRUCTIVE: deletes ALL rows. Personal bests in the browser (localStorage) are separate.

-- Option A: full wipe, keep table + indexes + RLS
truncate table public.aimdojo_dojo restart identity;

-- Option B (if you prefer delete over truncate):
-- delete from public.aimdojo_dojo;

-- Verify empty:
-- select count(*) from public.aimdojo_dojo;
