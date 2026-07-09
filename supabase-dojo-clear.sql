-- Aim Dojo — WIPE the global dojo leaderboard (old-version junk / clean slate).
-- Run in Supabase SQL Editor for project hgvnytaqmuybzbotosyj (ref in index.html SB_URL).
-- ⚠️ DESTRUCTIVE: deletes ALL rows.
--
-- After wipe:
--  1. Hard-refresh the game (new build also auto-clears local board caches via BOARD_GEN).
--  2. Or open RECORDS → "CLEAR MY LOCAL BESTS".
--  3. Verify below returns 0.

-- Prefer DELETE if TRUNCATE is blocked by RLS/permissions:
delete from public.aimdojo_dojo;

-- Or:
-- truncate table public.aimdojo_dojo restart identity;

-- Verify empty:
select count(*) as remaining from public.aimdojo_dojo;
