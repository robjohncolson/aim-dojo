# Aim Dojo — Continuation / Handover

Paste-in context for resuming work on **aim-dojo** in a new session.

## What it is
A single-file, browser-based **rhythm + spatial-audio aim trainer** with a full day/night sky,
adaptive difficulty, and a multiplayer stack. Built for the user (high-school math teacher,
robjohncolson) over one long session. Everything lives in **`index.html`** — no build step.

- **Repo:** `github.com/robjohncolson/aim-dojo` (public). `gh` is authed as **robjohncolson** (repo+workflow scopes).
- **Live:** https://robjohncolson.github.io/aim-dojo/ (GitHub Pages, deploys from `main` root).
- **Tech (all CDN, no bundler):** Three.js r128, Tone.js 14.8.49, qrcodejs 1.0.0, @supabase/supabase-js@2.
- **Working dir:** `C:\Users\rober\Downloads\Projects\aim-dojo` (its own git repo, nested in the parent Projects repo).

## ⚠️ Critical working constraints (read first)
1. **BUILDING BLIND.** The browser-harness can't attach — Chrome's `chrome://inspect/#remote-debugging`
   needs a one-time manual **Allow** the user hasn't done. So **every feature was verified by syntax +
   logic only, never seen running.** The user playtests and reports back. If they enable remote-debugging
   and say "go", you can screenshot/verify via `browser-harness`.
2. **Validation pattern** (use after every edit): extract the inline `<script>` to a temp file and
   `node --check` it. Snippet:
   ```bash
   python - <<'PY'
   s=open(r"C:\Users\rober\Downloads\Projects\aim-dojo\index.html",encoding="utf-8").read()
   i=s.index('"use strict"'); a=s.rfind('<script>',0,i)+len('<script>'); b=s.index('</script>',i)
   open(r"C:\Users\rober\AppData\Local\Temp\chk.js","w",encoding="utf-8").write(s[a:b])
   PY
   node --check "C:/Users/rober/AppData/Local/Temp/chk.js"
   ```
3. **Deploy loop:** edit `index.html` → `git add -A && git commit` (end msg with the Co-Authored-By line)
   → `git push origin main` → Pages rebuilds in ~40–90s. Poll:
   ```bash
   for i in $(seq 1 18); do st=$(gh api repos/robjohncolson/aim-dojo/pages/builds/latest --jq .status);
   has=$(curl -s https://robjohncolson.github.io/aim-dojo/ | grep -c 'SOME_NEW_STRING');
   echo "$st $has"; [ "$st" = built ] && [ "$has" -ge 1 ] && break; sleep 8; done
   ```
4. **Edits:** the user iterates fast and visually; match the existing terse code style. Push after each change.

## Files
- `index.html` — the entire game (HTML + CSS + one big IIFE of JS). ~everything.
- `README.md`, `LICENSE` (MIT), `.gitignore`.
- `supabase-leaderboard.sql` — creates `aimdojo_scores` (global peak-BPM board). **Already run by user** (global board works).
- `supabase-daily.sql` — creates `aimdojo_daily` (daily challenge + `replay` column for ghosts). **User must run this** (includes an `ALTER ... add column replay` for the already-created case).
- `server/` — Railway anti-cheat scaffold (`server.js` Express, `package.json`, `.env.example`, `README.md`). **Not deployed.**

## Architecture of `index.html` (mental map)
One IIFE. Major systems, roughly in order:
- **Seeded RNG:** `rng`/`rnd()`, `mulberry32`, `strHash`, `dayKey`. Gameplay randomness goes through `rnd()`; reseeded for the daily challenge so everyone gets the same run. `Math.random` otherwise.
- **CFG** object — all tunables (see below).
- **Scene/renderer/camera**, `PLAYER_POS=(0,4,0)` (player only rotates via `yaw`/`pitch`; `PITCH_LIMIT`).
- **Sky dome** (`skyDomeMat`, ShaderMaterial, BackSide, radius 480): elevation gradient horizon→zenith `pow(dir.y,0.30)` + a horizon **haze** band + **procedural FBM clouds** (4-octave noise projected by `vDir.xz/el`, drift via `uTime`, fade with `uCloud=day`). On layer 1 (reflected).
- **Day/night:** `updateSky(dt)`. `dayPhase` advances eased — `tSpeed = DAY_SLOW(0.32) + (DAY_FAST(4.2)-..)*|sunY|^2.5` → **~50% of the cycle in dawn/dusk**, period preserved (`dayCycleSec=200`). Colors `SKY_*` (lights), `HOR_*`/`ZEN_*` (dome) for night/day/dusk; `_haze` (horizon, scales with `day` so night is dark). `scene.background = _hor` each frame (fixes the black horizon seam). Fog color = `_hor`.
- **Sun + moon** sprites on a tilted circular orbit 180° apart, carried by `skyGroup` rotation (which also spins the **starfield**, 560 full-sphere twinkling points).
- **Planar reflection:** `renderReflection()` renders the sky (layer 1) from a mirror camera (`REFL_M` reflect about y=0) into `reflRT` (half-res); the **day checker floor** shader samples it (`uRefl` at `gl_FragCoord/uRes`) so the **actual sun disc reflects** at the horizon (omega effect). `uMirN=18 / uMirF=140` (band thickness).
- **Floor:** base dark plane + **day checker** (`dayFloor`, alternates B/W ↔ pink/brown each day via `TILE_SETS`, max-anisotropy + mips to kill moiré, mirage+reflection in its `onBeforeCompile` shader) + **night grid** (`nightGrid`, GridHelper, cycles green/amber/red each night, never repeating). Crossfade by `day`.
- **Targets:** `spawnTarget` (uniform 360° azimuth + pitch band, min-angle-from-aim cone via rejection [skipped in challenge], cube-root distance, drift `vel`). `onGrid` (Tone.Transport `8n` beat-locked spawn probability). **Brownian** wander in the animate move loop (off in challenge). Expanding square ground-ring beat pulse.
- **Aim trail (3D):** per-orb tube (`buildTube`) painted along your aim on a sphere, white→red by timing (`INK_OPT=3` beats), detaches into a **bloom-fading ghost** on death. **Path-efficiency score** `pathScoreOf` (great-circle ÷ angle travelled) → grade DIRECT/CLEAN/STEADY/LOOSE shown in the timing popup.
- **Adaptive engine:** `maybeAdjust` → `changeBpm` (rhythm) / `changeSpeed` (hunt). Softened: `bpmUp:2, bpmDown:3, downThreshold:0.45`. **Skipped during the daily challenge.**
- **Audio:** Tone synths + a `chordSynth` (PolySynth) that plays a rising major chord ¼-beat after each hit.
- **Leaderboards (Supabase, raw fetch, anon key embedded):** global `aimdojo_scores` (peak BPM, `submitScore`/`loadBoard`) + daily `aimdojo_daily` (kills, `submitDaily`/`loadDailyBoard`). `clientId()` (localStorage uuid), `playerName()` (editable name field), `esc()` (XSS-safe render).
- **Daily challenge:** `startChallenge` (seed from `dayKey`), fixed **ease-in** tempo ramp in the animate running block (`f=min(1,t/dur)^challengeEase`, 42→150 over 90s), `endChallenge` (submit + exit). Flags `state.challenge/challengeOver/needsReset`.
- **Ghosts:** record aim @20Hz (`qYaw/qPit` → uint16) + hit times into `ghostRec`; submit as JSON `replay`. `loadGhost` fetches the top scorer's replay; `updateGhost` draws a purple `#ghostRet` reticle at their aim (`projectDir`), flashing on their hits. `#ghostName` banner.
- **Realtime (Supabase Realtime, ephemeral, no SQL):** `initRealtime` → `aimdojo-room` channel. Presence → `#presence` "N in the dojo". `broadcastAim` (throttled ~12Hz when running) + `updateRemotes` → up to 10 green `.liveRet` opponent reticles. Graceful no-op if unavailable.
- **UI:** simplified start card = **ENTER / 🏆 DAILY CHALLENGE / ⚙ ADVANCED (modal) / ⧉ SHARE (modal w/ QR)** + history chart (`#histBox`) + two boards (`#boardBox`, `#dailyBox`) + name input. **Mobile touch controls** (`#touch`: drag-look, FIRE, PAUSE; `MOBILE`/`HAS_TOUCH` detection; pointer-lock skipped on touch). Reduced-motion respected for flashy bits.
- **Defaults baked in:** start tempo **35 bpm**, sensitivity **3×** (`radPerPx=baseRadPerPx*3`), assist arrows **ON**.

## Supabase / Railway
- **Project:** `hgvnytaqmuybzbotosyj` (the user's *browser-side* project). Anon key is embedded in `index.html` (public by design; protected by RLS). Do **not** use the other project's service-role key client-side.
- `aimdojo_scores`: **created** (global board live).
- `aimdojo_daily`: **user must run `supabase-daily.sql`** (else daily board + ghosts show "offline").
- **Realtime:** presence/broadcast need Realtime enabled on the project (default on).
- **Railway:** `RAILWAY_URL=''` in `index.html` (empty → submits straight to Supabase). To enable anti-cheat: deploy `server/` (root dir `server`, env from `.env.example` incl. the **service_role** key), set `RAILWAY_URL`, then run the RLS lockdown SQL in `server/README.md`. The server validates each submission's replay (score≤hits, hit-rate≤8/s, etc.) before writing.

## Outstanding USER action items
1. **Run `supabase-daily.sql`** in Supabase SQL editor → lights up the daily board + ghosts.
2. **Enable Realtime** for the project if presence/reticles don't show.
3. **(Optional) Deploy `server/` to Railway** + set `RAILWAY_URL` + run the RLS lockdown → trustworthy daily board.
4. **Playtest the blind-built features** and report: daily-challenge end flow, ghost reticle, realtime presence/reticles, planar sun reflection at sunrise.

## Multiplayer roadmap status
leaderboard ✅ → daily seeded challenge ✅ → ghost replays ✅ → Railway-verified scores ✅ (scaffold; needs deploy) → realtime presence + live reticles ✅. **All built.** Remaining is hardening/tuning after playtest, and (if wanted) true server-side re-simulation anti-cheat and live head-to-head racing.

## Key tunables (in `CFG` unless noted)
- Difficulty: `bpmUp/bpmDown` (2/3), `upThreshold/downThreshold` (0.80/0.45), `windowSize`.
- Challenge: `challengeDur(90)/challengeStartBpm(42)/challengeMaxBpm(150)/challengeEase(1.4)`.
- Sky time: `DAY_SLOW/DAY_FAST` + `|sunY|^2.5` exponent (in `updateSky`), `dayCycleSec(200)`.
- Sky look: dome `pow(...,0.30)` steepness, haze (`exp(-|el|/0.05)*0.55` + `_haze` lerp `0.03+0.25*day`), `HOR_*`/`ZEN_*` colors, cloud FBM (`smoothstep(0.50,0.72,n)`, `vDir.xz/el*0.55`, drift `0.006/0.004`).
- Reflection band: `uMirN(18)/uMirF(140)`.
- Brownian: `brownian(7)/brownianMax(9)/brownianDamp(0.35)`.
- Spawn: `spawnMinDeg(16)/spawnMinHiDeg(40)`, `spawnDist([12,26])`, `pitchSpreadDeg(16)`.
- Trail: `TRAIL_R(12)/TRAIL_TUBE(0.16)/TRAIL_MAX(90)`, `INK_OPT(3)`.

## Likely next requests (from the session's trajectory)
Tuning after playtest (cloud look, reflection brightness, ghost smoothness — can interpolate remote/ghost between samples); challenge progress bar + result-vs-rank screen; sphere-size/precision tweaks; possibly a wiki/memory note (aim-dojo isn't in the workspace memory yet).
