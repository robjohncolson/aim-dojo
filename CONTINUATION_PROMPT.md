# Aim Dojo — Continuation / Handover

Paste-in context for resuming work on **aim-dojo** in a new session.

## What it is
A single-file, browser-based **rhythm + spatial-audio aim trainer** with a full day/night sky,
adaptive difficulty, a multiplayer stack, and a **ballistic (projectile) shot mode with a firing-computer
scope**. Built for the user (high-school math teacher, robjohncolson). Everything lives in **`index.html`**
— no build step (~2260 lines; one big IIFE of JS after a Codex perf pass).

- **Repo:** `github.com/robjohncolson/aim-dojo` (public). `gh` is authed as **robjohncolson**.
- **Live:** https://robjohncolson.github.io/aim-dojo/ (GitHub Pages, deploys from `main` root).
- **Tech (all CDN, no bundler):** Three.js r128, Tone.js 14.8.49, qrcodejs 1.0.0, @supabase/supabase-js@2.
  (Tone.js + Supabase are now **lazy-loaded**; only Three.js loads eagerly — see the perf pass.)
- **Working dir:** `C:\Users\rober\Downloads\Projects\aim-dojo` (its own git repo, nested in parent Projects).

## ⚠️ Critical working constraints (read first)
1. **BUILDING BLIND.** The browser-harness can't attach (Chrome's `chrome://inspect/#remote-debugging`
   needs a one-time manual **Allow** the user hasn't done). **Every feature is verified by syntax + logic
   only, never seen running.** The user playtests and reports back. Visual features (the trajectory viz,
   scope, floor HUD) are tuned iteratively by eye — expect several round-trips.
2. **Validation pattern** (use after EVERY edit): extract the inline `<script>` to a temp file and
   `node --check` it:
   ```bash
   python - <<'PY'
   s=open(r"C:\Users\rober\Downloads\Projects\aim-dojo\index.html",encoding="utf-8").read()
   i=s.index('"use strict"'); a=s.rfind('<script>',0,i)+len('<script>'); b=s.index('</script>',i)
   open(r"C:\Users\rober\AppData\Local\Temp\chk.js","w",encoding="utf-8").write(s[a:b])
   PY
   node --check "C:/Users/rober/AppData/Local/Temp/chk.js"
   ```
3. **ALSO grep for dangling refs after removing/renaming a symbol.** `node --check` only catches syntax,
   NOT runtime `ReferenceError`. Removing a `const`/`let` while a reference survives = a freeze that passes
   syntax check. This bit us TWICE (`arcLine`, `remotes`). After any rename/removal:
   `python - <<'PY' ... re.findall(r'\bSYMBOL\b', js) ...` and confirm 0 stray uses.
4. **Deploy loop:** edit `index.html` → `git add -A && git commit` (end msg with the Co-Authored-By line)
   → `git push origin main` → Pages rebuilds in ~40–90s. Poll for a unique new string:
   ```bash
   for i in $(seq 1 12); do st=$(gh api repos/robjohncolson/aim-dojo/pages/builds/latest --jq .status);
   has=$(curl -s "https://robjohncolson.github.io/aim-dojo/?cb=$RANDOM" | grep -c 'SOME_NEW_STRING');
   echo "$st $has"; [ "$st" = built ] && [ "$has" -ge 1 ] && break; sleep 8; done
   ```
5. **Line numbers drift** (the Codex perf pass renumbered everything; we add code constantly). **Match by
   text, not line number** when editing.
6. **Review risky changes before pushing.** Pattern used this session: for large/gameplay-touching diffs,
   run an adversarial review (multi-agent workflow, or a single Explore/general-purpose agent) over the
   diff + file, verify each finding, fix, THEN push. Caught a real daily-leak bug and a reflection
   regression before they shipped.

## Files
- `index.html` — the entire game (HTML + CSS + one big IIFE of JS).
- `README.md`, `LICENSE` (MIT), `.gitignore`.
- `supabase-leaderboard.sql` — `aimdojo_scores` (global peak-BPM board). **Run.** ✅
- `supabase-daily.sql` — `aimdojo_daily` (daily challenge + `replay` ghost column). **Run.** ✅
- `server/` — Railway anti-cheat (`server.js` Express, `package.json`, `.env.example`, `README.md`).
  **DEPLOYED + live + locked down.** ✅ (see Supabase/Railway).

## Architecture of `index.html` (mental map)
One IIFE. **`animate()` is invoked LAST, at the very end of the IIFE bootstrap** (after all module-scope
`const`/`let` exist) — do NOT move it earlier (that caused the original total-freeze TDZ). Major systems:

- **Seeded RNG:** `rng`/`rnd()`, `mulberry32`, `strHash`, `dayKey` (UTC). Daily challenge reseeds so
  everyone gets the same run. `Math.random` elsewhere.
- **CFG** object — all tunables. **`projectile:true` (ARC is the DEFAULT shot type now), scope:true.**
- **Scene/renderer/camera**, `PLAYER_POS=(0,EYE=4,0)` (player rotates via yaw/pitch).
- **Sky/day-night/reflection/floor:** dome shader, `updateSky`, sun+moon orbit, planar sky reflection
  (`reflRT`, `syncReflUniformSize`/`reflResDirty`), day checker floor + night grid. Largely as before;
  the perf pass made textures **deferred** (`buildStars`, checker map built at idle).
- **Targets:** pooled (`acquireTargetMesh`/`acquireTargetRecord`); `spawnTarget`; beat-locked `onGrid`;
  brownian wander (off in the seeded challenge). Each `tg` has `.mesh/.shell/.vel/.radius/.born/.dead/.sc`.
- **Firing:**
  - **Railgun (hit-scan):** `fire()` → manual ray-sphere (the perf pass replaced `THREE.Raycaster`).
  - **Ballistic (ARC, free-play only):** `fire()` → `spawnProjectile()` when `CFG.projectile &&
    !state.challenge`. Pooled projectiles, gravity-integrated, swept segment-vs-sphere collision.
    **Rhythm graded by FIRE-TIME** (`atT` threaded into `gradeRhythmHit`/`onHit`), so "fire on the beat"
    holds; the projectile adds the spatial lead+drop skill. A shot counts ONCE (hit XOR expire).
- **`computeShotPlan(M,V)` — THE shared shot helper (ARC section).** Launches from the **bottom-right
  muzzle** (`BLADE_DX/DY/DZ`) with a velocity solved to land where the eye→crosshair parabola lands
  (`_arcI`). Used by: `spawnProjectile` (real bullet), `updateArcPreview` (the dashed ribbon), and the
  scope lock (`simShotHits`). So the **bullet flies exactly down the drawn ribbon.**
- **Trajectory viz (`updateArcPreview`, ARC only, throttled ~20Hz):** a **thin, faint, SOLID camera-facing
  ribbon** (`arcRibbon`, billboarded quad strip; `RIB_HALF:0.045`, opacity 0.16). The old scrolling
  marching-dash texture was RETIRED (slimmed per playtest — `makeDashTex`/`DASH_PERIOD`/`arcLen` gone, no
  `.material.map`). Plus `arcLand` (static landing ring) + `arcPulseA/B` (beat-pulsed rings at the impact,
  still present). Lofted ballistics (`projSpeed:24, projGravity:16`) make the parabola visibly curved.
  `animateArcPulse` runs every frame; geometry rebuild is throttled.
- **Ballistic scope (`updateScope`, ARC only, throttled ~30Hz):** `scopeLockTarget` (nearest to crosshair)
  → `simShotHits` (marches the REAL shot vs the moving target → **path-accurate LOCK**). Renders: a
  **seeking→LOCK reticle** (`#lockBox`,
  bracket around the target, gold "LOCK" when your shot would connect), and a HUD (`#scopeHud`:
  θ→TGT / AIM elevation / RANGE / FLIGHT / LEAD; m/ft via `CFG.scopeUnits`). `projectPointScope` projects
  world points to screen (mirrors `projectDir`). The gold **aim-pip** (`#scopeAim`) is **RETIRED** (element
  + CSS kept, `scopeAimEl` never gets `.on`) — redundant once the orb holds still + the lock box exists.
- **Floor HUD (`updateTargetMarks`, ALL modes, every frame):** under every live target — a **beat-synced
  pulsing ring** on the floor + a **vertical dropline** + a floating **distance label** (`.tgtDist`, slant
  range in m/ft). Pooled (`targetMarks`). `updateLandRings` + `spawnLandRing`: a big ring radiates out
  where a ballistic shot hits the floor.
- **Adaptive engine:** `maybeAdjust`→`changeBpm`/`changeSpeed`. Skipped in the daily.
- **Audio:** lazy Tone.js; synths + chord on hit. The daily refuses to start without audio (`startChallenge`
  gates on `toneReady`).
- **Leaderboards (Supabase, raw fetch, anon key embedded, RLS-protected):** global `aimdojo_scores`
  (peak BPM; `submitScore` **skips ARC + challenge runs** to keep the board hit-scan-pure) + daily
  `aimdojo_daily` (kills + `replay` ghost; `submitDaily` routes through Railway).
- **Daily challenge:** `startChallenge` (seed from `dayKey`), fixed ease-in tempo ramp, `endChallenge`
  (stops the run SYNCHRONOUSLY then releases pointer lock). **`EXIT DAILY → FREE PLAY` button** on the
  pause overlay clears `state.challenge` and restores the start card (`exitChallenge`/`restoreStartCard`).
  ARC/scope/projectile are all force-disabled in the daily via `!state.challenge` guards.
- **Ghosts:** record aim @20Hz + hits → JSON `replay`; `loadGhost`/`updateGhost` draw the top scorer's
  purple reticle.
- **Realtime (Supabase Realtime):** `initRealtime` → presence ("N in the dojo") + `broadcastAim` (rides
  k/s/c too) + green opponent reticles. **Live Score Race** (`renderScoreRace`): a kill ladder of everyone
  on today's seed, gated to the challenge, "passed you!" flash. Gated so solo frames skip the work.
- **Mobile:** touch controls; FIRE routes through `fire()`. Reduced-motion respected (gates the flashy bits
  incl. the trajectory viz + floor HUD pulses).

## Supabase / Railway — ALL DONE ✅
- **Project:** `hgvnytaqmuybzbotosyj`. Anon key embedded (public by design, RLS-protected).
- `aimdojo_scores` + `aimdojo_daily`: created.
- **Railway verify server: deployed + wired + locked down.** `RAILWAY_URL =
  'https://aim-dojo-production.up.railway.app'` (index.html). `/health` returns `{ok:true,configured:true}`.
  Daily scores POST to `/daily` → server validates (replay parse, score≤hits, hit-rate≤8/s, UTC-day,
  rate-limit) → service-role insert. The **anon-insert policy was dropped** (`drop policy "aimdojo_daily
  insert"`), so the server is the sole writer to the daily board. Verified end-to-end this session.

## Multiplayer roadmap — all stages + Live Score Race + Percentile Pace Ghost + Weekly Seasons ✅
leaderboard → daily seeded challenge → ghosts → Railway-verified scores (DEPLOYED) → realtime presence +
reticles → **Live Score Race** → **Percentile Pace Ghost** (live "DAILY PACE — ahead of X% of today's
field" bar; `loadPaceField`/`updatePaceGhost`, top-center HUD, works SOLO since it races the *recorded*
field) → **Weekly Seasons** (`loadSeasonBoard`, a standings board summing each player's best daily score
this UTC week). Remaining roadmap ideas (not built): **shareable result card + streak** (next, mostly
client-side); **Best-of-3 Duel brackets** (needs a realtime lobby/matchmaking — big lift, low confidence
build-blind).

### Percentile Pace Ghost — how it works (built)
`updatePaceGhost` (daily branch, throttled ~6Hz via `PACE_STEP`) sweeps a monotonic `Int32Array` cursor
per opponent run through that run's recorded **scoring-hit times** (`replay.h`, centiseconds) vs `state.t`,
then renders `pct=round((below+ties*0.5)/paceTotal)`. `loadPaceField` fetches today's runs (deduped to each
client's best, like `loadDailyBoard`) on `startChallenge`; `hidePace` clears it on every exit. Tiers: gold
≥80% / red <40%; flash on climb (reduced-motion gated); "warming up" before your first kill (no false 50%).
**Replay `h` now records SCORING hits only** (the `h.push` moved into the `if(good)` branch of
`gradeRhythmHit`), so `h.length === score` and pace matches the board exactly — and the ghost reticle now
flashes on scoring hits. Server `score≤h.length` / hit-rate checks still pass (h only got smaller).
**Scaling note (not built):** `loadPaceField` downloads up to 120 FULL replays and parses each just to read
`h` (the big `a[] aim path is wasted). If a single day's field ever gets large, add a server/Supabase
h-only aggregate (RPC or a lightweight `pace` column) instead of fetching whole replays.

### Weekly Seasons — how it works (built)
`loadSeasonBoard` renders the `#seasonBox` standings (rank / name / total / "Nd" days-played) under the
daily board. `seasonDays()` builds the **7 day-keys of the current UTC week (Mon–Sun)** via `dayKeyOf` —
which MUST mirror `dayKey()`'s **non-padded** format (`2026-6-15`, not `06-15`), because the stored `day`
strings aren't zero-padded so a lexical `day=gte` range query is WRONG; we query exact keys with
`day=in.(...)`. Per player, take the **best score per day**, **sum** across the days played, sort by total
(then days-played). Reuses `aimdojo_daily` — no new table/server/realtime. Wired into all three board
refreshes (startup, run end, `submitDaily`). **Scaling note:** client-aggregates up to `limit=2000` rows;
if a week's field gets large, move to a server aggregate (same path as the pace ghost).
- **FPS/DPR readout (dev/validation):** visit `…/?fps` (or `#fps`) → live `N fps · dpr X.XX` top-left
  during play (`_showFps`/`fpsEMA` in `animate`, EMA of rAF timestamps + `renderer.getPixelRatio()`).
  Cross-device (no keyboard needed) → the way to finally validate the Codex perf pass on phones/school
  machines. Gated to the URL flag; zero cost otherwise.

## Key tunables (in `CFG` unless noted)
- **Ballistics:** `projSpeed:24`, `projGravity:16` (lofted for a visible arc; raise speed / lower gravity
  to flatten — keep `projSpeed²/projGravity ≥ ~30` so far targets stay reachable), `projRadius`, `projLife`.
  `projectile:true` (ARC default), `projArc:true`, `scope:true`, `scopeUnits:'m'`.
- **Trajectory ribbon (ARC section consts):** `RIB_HALF:0.045` (thin), ribbon material opacity `0.16`
  (faint, SOLID — dashes retired), `BLADE_DX/DY/DZ` (muzzle offset, bottom-right), `ARC_SAMP:30`.
- **Floor HUD (`updateTargetMarks`):** ring radius `0.5+beat*0.38`, `Math.pow(...,1.6)` beat envelope,
  marker color `0xffce5c`. **Land ring (`updateLandRings`):** `0.5+k*3.4` radius, `0.55s` life.
- **Scope lock:** `simShotHits` radius margin (`+0.12`), lock cone in `scopeLockTarget` (`bestDot 0.72`).
- **Skill-gated spawn distance (FREE-PLAY only):** `rangeStart:11`, `rangeMax:28`, `rangeNear:8`,
  `rangeBand:8`, `rangeStep:1.2`, `rangeStepDown:1.6`. `state.range` is the spawn shell's far edge; it
  marches outward (`changeRange` in `maybeAdjust`) on sustained ≥80% accuracy and pulls back ≤45% — the SAME
  signal as the tempo ramp. `spawnTarget` draws from `[max(rangeNear, range-rangeBand) .. range]`. The daily
  stays on fixed `spawnDist` (branch on `state.challenge`). NOTE the `if(up||down) sinceAdjust=0` line in
  `maybeAdjust` is REQUIRED (else range ramps every event once bpm/speed is railed).
- **Pace ghost (daily):** `PACE_STEP:1/6`, tier cutoffs 80/40, fetch `limit:120` (deduped). See the
  Percentile Pace Ghost section above.
- **Beat-quantized target motion (FREE-PLAY RHYTHM only):** `beatQuant:true`, `beatQuantDivs:[2,4,8]`
  (1/2→1/4→1/8 beat), `beatQuantT:[0.40,0.75]`. **Wander SPEED is skill-scaled**: `velCap=lerp(brownianMaxSlow:1.4,
  brownianMax:9, diffT())` (replaced the old fixed `BROWNIAN_MAX2`) so low-tempo orbs barely drift (small,
  sedate steps) and only move fast at high skill — bpm sets the step *cadence*, velCap sets *how far* each
  step travels. The orb HOLDS position+velocity between beat-grid ticks then STEPS, so the
  cursor + target-locked aim guides (lock box, lead, range, floor ring — all read
  `tg.mesh.position`+`tg.vel`) settle instead of fleeing. Phase-locked via `Tone.Transport.ticks/PPQ`;
  subdivision steps by `diffT()` per `beatQuantDivs` (currently 1/2→1/4→1/8). Module state `_quantIdx`/`_quantT` (reset in resetSession).
  On a snap, `scopeAccum`/`arcAccum` are forced so the guides recompute the same frame. Strobe-path wall
  bounce reflects POSITION (large steps); continuous bounce unchanged. **Daily + hunt untouched** (strobe
  gated `mode==='rhythm' && !state.challenge`; continuous modes keep `doSnap=true` every frame → identical).
  NOTE: the **trajectory ribbon is camera/crosshair-driven** (`updateArcPreview`), NOT target-driven — the
  strobe does NOT calm it (it follows your aim by design). If ribbon scatter is ever the complaint, that's
  a separate fix (smooth the crosshair / snap the ribbon's far end to the locked target).
- **Difficulty/sky/spawn/trail:** as before (bpmUp/Down, thresholds, DAY_SLOW/FAST, spawnDist, etc.).

## Codex WebGL perf pass (a9e0cdd) — know this before editing render code
Lazy startup (only Three.js eager), deferred stars/checker/reflection textures, **adaptive DPR**
(`setRenderDpr`/`updateRenderQuality`), throttled reflection/sky/realtime updates, **pooled**
targets/beams/projectiles/explosions/trails, **manual ray-sphere hit-scan** (replaced `THREE.Raycaster`),
cached DOM writes (`setText`/`setClassName`/`setStyle` with `._cache`), realtime work gated on solo frames.
Reviewed clean (0 regressions) except one fixed: deferred checker map recompiled the floor shader and reset
the reflection `uRes` — `setDayFloorTex` now re-marks `reflResDirty`. **Perf gains are unverified at runtime**
(can't profile blind) — a real device FPS capture is the outstanding validation.

## Shipped (recent work)
**Playtest-accepted ("genuinely fun")** — tuning settled, no open round-trips:
1. **Skill-gated spawn distance** (free-play) — starts close (8–11m), marches the spawn shell outward on
   sustained ≥80% accuracy, pulls back when struggling.
2. **Percentile Pace Ghost** (daily) — live "ahead of X% of today's field" bar; works SOLO.
3. **Beat-quantized target motion** (free-play rhythm) — the orb HOLDS then STEPS on the beat; wander SPEED
   tied to skill (sedate at low bpm via `velCap`, fast at high). The big "feel" win.
4. **ARC guide cleanup** — aim-pip retired; trajectory ribbon slimmed to a thin/faint/SOLID arc; lock box +
   landing ring + impact pulses kept.

**Shipped, awaiting the user's eyes** (built + validated, not yet playtested in anger):
5. **Weekly Seasons** board (see its how-it-works section).
6. **FPS/DPR readout** at `…/?fps` — for the user to capture real-device perf.
7. **Global board relabeled "RAILGUN · PEAK BPM"** — resolves the ARC-default-vs-board question by keeping
   the global board hit-scan-pure (the daily/season boards are the real cross-mode comp). Flip to "let ARC
   count" only if the user asks.

All verified via the build-blind loop (node --check + dangling-ref greps; date logic for seasons executed in
node); the larger gameplay features also got multi-agent adversarial reviews before shipping.

## Outstanding / likely next
- **Shareable result card + streak** — the recommended NEXT feature (mostly client-side: render an
  end-of-run card → download / Web Share, + a localStorage daily streak). High retention value for a class.
- **Best-of-3 Duel brackets** — needs a realtime lobby/matchmaking (presence/broadcast only today); big
  lift, hard to verify build-blind. Deferred.
- **Pace ghost + season scaling (if a field gets big):** both client-aggregate; move to a server/Supabase
  aggregate if counts grow. Not needed at current scale.
- **Known pre-existing ARC nuance (not fixed):** a perfectly-aimed point-blank lofted shot can miss because
  `computeShotPlan` solves the eye→crosshair parabola from PLAYER_POS/eye, ignoring the down-right muzzle
  offset (`BLADE_DX/DY`). The scope LOCK accounts for it; only matters if you ignore the firing computer.
  Fixing it means touching `computeShotPlan` (risks the "bullet flies down the ribbon" invariant).
- **Low-value / parked:** railgun θ/range readout (decoration — hit-scan needs no aiming computer) and floor
  HUD ground-vs-slant (slant is the useful number, already shown) — assessed low-value, deliberately skipped.
  Also: optional impact-pulse removal if it ever feels busy; a wiki/memory note (aim-dojo isn't in memory).
