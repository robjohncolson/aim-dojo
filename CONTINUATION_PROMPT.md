# CONTINUATION_PROMPT — Moon Chorus / aim-dojo (resume here, 2026-08-22)

## -4. LATE 2026-08-21 (post-Enfilade): wave 11.1 + the incantation, all shipped and live
- **Wave 11.1 — THE BREATH (`a8a668c`)**: the enfilade exhales toward mercy (the wall 2 bars out renders at
  60 % dissolve; the 1-bar slot stays inside wave-11's absolute no-wall gap; inhale after mercy is instant)
  and the walls hear play (uWallHit/uWallMiss road-clock stamps from the FLAWLESS/clank sites → chamber-local
  warm ripple +12 %/1.5 beats and clank dim −10 %/half-beat). Bars-to-mercy is PACKED into uK as fractional
  hundredths — a truth table test pins the decode for every reader. Review caught: reduced-motion locality
  vs pinned stations (echo died forever after ~1 min), stamps surviving resetSession (phantom ripples), and
  the fixture omitting accent/veil + duplicate switch-alone cases (the coupling-blindness pattern, 4th time).
  Knobs wallExhale/wallEcho, each 0 → wave-11 byte-identical.
- **THE OLD CODE, final form (`e9269e1`; earlier forms `5c03c63`/`7dfa1a7` superseded)**: W W S S A D A D ·
  R-click · L-click, spoken MID-LESSON through live play (taps stay taps; the closing click fires AND
  graduates via setTrainPhase(3)); the advancing right-click swallows its one skyFreeze toggle; honest
  graduation teaches the secret for 2 s (showGhostToast slow variant), code-graduates are not re-taught
  (_konamiGrad). Never persisted — contract-pinned in index-contract.test.js.
- Suite is 219/219. The user's improvement menu (from the wave-11 debrief) still has open items: doorway
  crossings as felt events (bloom+whoosh on bar lines), tide-ordered palette (warm→cool toward mercy), the
  mercy chamber as a place (denser canopy, rose shedding petals).

# CONTINUATION_PROMPT — Moon Chorus / aim-dojo (resume here, 2026-08-21 night (superseded header))

## -3. THE VISUAL REDESIGN ARC (2026-08-20 → 21): waves 9–11, all shipped and live
Three waves in ~36 h, all via the Codex dispatch loop (§-1 below), all user-directed through RENDERED STUDIES
(the loop that works: build 2-3 standalone Three.js studies in the scratchpad, screenshot at the GAME camera
(eye 4 m, FOV 95), let the user pick/refine, only then spec + build). Studies live under scratchpad/studies*/.
- **Wave 9 — THE NAVE (`5802a0f`)**: white lit-stone round coffered arches (SERENE study), gold-star vault
  canopy, honey-glass street behind `naveStreetGold`. The review caught a LANE-SWAP BLOCKER (spec listed hues
  in non-lane order; W painted green). LAW SINCE: lane colours derive ONLY from uL0..uL3 ← _roadLaneCol ←
  WASD_HEX (0=W cyan, 1=A green, 2=S gold, 3=D pink); chain tests in `f435805`; NO lane-colour literal ever.
- **Wave 10 — THE TERRAIN (`047deab`)**: carved chevron marks replace the full-width lane bands (dark socket
  under them — gold-on-gold vanishes without it), re-based elevation (deck always at the feet; only curvature
  reads; crests cost lookahead — user accepted the trade knowingly, `terrainAmp` dials it), 7-beat/2.2 m curve
  harmonic (+20 % tangent kept). `leanBite:0.25` keeps the tracking drill's p90 lean within 1 % of wave 9 —
  the dolly moving the aim is DELIBERATE shipped design; the review misread it as a violation. Perf lesson:
  the dark socket re-submitted the whole ribbon; diagnose by FOUR-VARIANT measurement, never one-variable.
- **Wave 11 — THE ENFILADE (`992e75f`)**: pastel chalk walls the road PIERCES (up/down/sideways, solid ~95 m,
  powder-dissolve by ~200), tall oblate doorways with veduta light, night-seeded chamber palette (private rng
  stream off roadCourse's key, lazily seeded at first live sync), NO side walls (Echoes spawn 360°), glow-
  through pass for walled orbs (GreaterDepth, scope documented as accepted), mercy = no wall one bar before
  → two after the ring, chevrons SATURATE TO PURE LANE COLOUR exactly at the audible band-edge (floor(b)−uNow
  — per-fragment keying peaked half a beat late; review caught it). LOW station cap 7 fixed p90 73→34 ms.
  Kill-switches: `wallsOn:false` → wave-10 byte-identical (frozen fixture, each switch tested ALONE).
- Recurring review lesson: the frozen-fixture test has missed a coupling in EVERY wave (gate not including the
  master switch); test each kill-switch ALONE, and construct the surviving mutation.
- Harness facts: make-harness.py injects __dbg (now exposes CFG/materials/glob eval); server PORT 8771 (8765
  was stolen by another session's server — check what you're actually serving); Codex's sandbox has NEVER been
  able to render or bind ports — the dispatcher renders, Codex must not claim frames it didn't make.
- Debugging law from the study rounds: when patches provably apply but pixels don't change, stop theorizing
  and do PER-OBJECT ELIMINATION (hide scene children, measure pixels). The culprit was exp(-y) diverging below
  the deck — the HALF-SPACE HAZARD is now named in specs and audited per wave.

# (superseded) CONTINUATION_PROMPT — Moon Chorus / aim-dojo (2026-08-19 evening)

> Supersedes the 2026-07-08 handoff (`git show 4e145b8:CONTINUATION_PROMPT.md`). Durable design record: memory `aim-dojo-unified-vision.md`. Deploy facts: memory `aim-dojo-deploy-infra`. HEAD at handoff: **d906ccf** on `main`, working tree clean, live at **aim-dojo.vercel.app** (push to `main` auto-deploys in seconds).

## -1. What the 2026-08-19 evening session shipped (d906ccf) — read §0 next, then this
- **Regression found & fixed:** `97b6134` (the aim-trail deletion) had joined two lines onto the previous lines' `//` comments: `onExpire` lost `removeTarget/streak=0/pushEvent(false)/FADED` (every timed-out orb stayed in the scene with its oscillator running; streak never reset on a miss) and `resolveFlickLock` lost `killTarget` (dormant). Restored + a contract test now scans every inline script for call statements swallowed by `//` (two shapes) + a vm test on `onExpire`. **Lesson (memory `aim-dojo-comment-swallow-hazard`): never delete a statement on a multi-statement line mechanically; run the swallow scans after any such edit.**
- **Snappy RESUME (user report: kid pressed Esc, hard to resume):** Chromium rejects re-lock within 1250 ms of the user's Esc (`kEffectiveUserEscapeDuration`); the old `pointerlockerror` fallback entered the run UNLOCKED (dead mouse). Now `onPointerLockError` + `cancelLockRetry` (index.html ~9754-9775): inside the cooldown the button says ONE MOMENT… and the lock is re-requested when the cooldown lapses (still under the click's transient activation) → enters LOCKED ~1.3 s after the click; genuinely unavailable lock → unlocked run (never stuck), first canvas click relocks once then clicks fire. State: `_lockLostAt/_lockRetryT/_lockRetries/_runNeedsRelock/_relockTries/_lockReqPending` (~:1148). `_lockReqPending` = "a RESUME/PLAY request is in flight": set only by `startRun`'s desktop branch and the cooldown retry, cleared ONLY by `cancelLockRetry` (called from enterRunning/exitRunning/pad start/tab-hide/acquired/hidden-error); the `pointerlockchange` acquired branch releases a lock nobody asked to enter with (`document.hidden || (!running && !pending)`). Harness-verified (cooldown resume 1.4 s locked; fallback <1 s; pad/hidden/late-request races stay paused). The pause card itself was never slow: exitRunning+showPause 2.5 ms, idle frames 98.7 % idle.
- **Audit fixes (from a 6-lens/12-agent workflow, 11 confirmed):** cloud-pref reconcile no longer reload-loops under `?low/?hi/?sky=` (`LOW_FROM_URL`, `SKY_MODE_FROM_URL`); `audioLat()` now reads `listener.context.outputLatency` (Tone 14's wrapper has none — the correction was silently baseLatency-only), finite-positive, clamped 0.35 s, behind `AUDIO_OUT_LATENCY` — **tell the user to press CALIBRATE once** (their stored offset absorbed the missing term); CALIBRATE syncs `offset_ms` to the cloud; first PLAY/pad-first runs build reverb synchronously (fail-soft) instead of staying dry; Vercel root modules now `max-age=0, must-revalidate` (were 7-day cached against a max-age=0 index.html).
- **Not done (deliberately, user's call):** hygiene deletions verified dead — `avgReaction`+`pushReaction`+reaction ring buffer, `classifyPocket`, `showTempleSignArt`, `placeTempleSignArt`, `starLitLevel`, `showListenGhost`/`hideListenGhost`, `eighthSec`, `timingErrorMs`, `setClassName`, `liveCount`; `decoyChance/decoyDistMul` unread (the `:1054` comment claiming decoys are revivable is false); `tg.lifeBeatsEff` write-only. Also downgraded/left: Three.js-CDN-failure shows a greyed PLAY with no message; Tone-failed copy unreachable; two AudioContexts (a Firefox `AudioListener.positionX` polyfill risk if unified); starChorus last-writer-wins across tabs. Full record: this session's workflow journal `…/3186ce38-…/subagents/workflows/wf_69549391-97f/journal.jsonl` and the Codex briefs/reviews in `CODEX_PROMPT_RESUME_SNAP_AND_AUDIT_FIXES.md` (rounds 1-4).
- **Procedure that worked ("standard work procedure"):** audit workflow → brief `CODEX_PROMPT_<TOPIC>.md` (evidence at file:line, exact fix, GitNexus blast radius, acceptance, hard rules) → `codex exec -m gpt-5.6-sol -c model_reasoning_effort=xhigh -s workspace-write -c approval_policy="never" -C <repo> -o <last.md> "<prompt>"` (detach with `setsid nohup … &`; `--approve-for-me` clashes with `-s`; `exec review --uncommitted` cannot take a custom prompt → use plain `exec -s read-only` for the adversarial review) → my own harness probes + tests → Codex adversarial review (read-only) → fix rounds until SHIP → GitNexus `detect_changes` → commit/push. Codex has no GitNexus MCP but the CLI works (`gitnexus impact <sym> --direction upstream`). The reviews were worth it: rounds 2-4 closed a real blocker (relock swallowing every click) and three race conditions.
- **GitNexus on this machine:** TWO repos are indexed (`aim-dojo`, `apstats-live-worksheet`) → every MCP call needs `repo:"aim-dojo"`. Another session's Codex hammers the shared index DB; incremental `gitnexus analyze` has hit `FTS index 'file_fts' is inconsistent` three times → use `GITNEXUS_MAX_FILE_SIZE=4096 gitnexus analyze --force` (≈3-4 min). The PostToolUse hook says "index stale" after every commit until you re-analyze; re-analyze rewrites the counts in CLAUDE.md/AGENTS.md — commit them.
- Harness recipe unchanged (§5); this session's scripts live in the scratchpad (`harness/make-harness.py` injects `window.__dbg`, `resume-probe.mjs`, `r6-probe.mjs`, `expire-probe.mjs`) — regenerate from the recipe if the scratchpad is gone. Headless Chrome cannot reproduce the browser-side Esc cooldown; the probes shim `canvas.requestPointerLock` to reject/defer.

## 0. FIRST THING NEXT SESSION — GitNexus is now wired up
Last session the GitNexus **MCP tools were not callable** (the server had never been registered on this machine), so blast-radius checks were done with grep. That is fixed:
- `gitnexus setup -c claude` was run → MCP server `gitnexus` registered (`claude mcp list` shows it ✔ Connected), 9 skills in `~/.claude/skills/`, Pre/PostToolUse hooks installed. Reversible with `gitnexus uninstall`.
- The repo is indexed at HEAD (`.gitnexus/` — gitignored; 4,003 symbols / 7,615 edges / 300 flows). `gitnexus status` tells you if it's stale; refresh with `GITNEXUS_MAX_FILE_SIZE=4096 gitnexus analyze` (the env var is REQUIRED — index.html is 1 MB; the default 512 KB threshold silently skips it). Bare `npx gitnexus` crashes on npm 11; use the global `gitnexus` binary (`npm i -g gitnexus` if missing).
- MCP tools load at session start, so in a fresh session `impact / context / query / detect_changes` should just be there. **Sanity check at the top of the session:** `context({name:"animate"})` — if it errors, `claude mcp list` and re-run setup.
- Follow CLAUDE.md's rules for real now: `impact({target, direction:"upstream"})` before editing a symbol, `detect_changes()` before committing. Graph line numbers cite `tools/index-inline.mirror.part<N>.js:N` = `index.html:N` (same line). **After ANY index.html edit: `node tools/extract-inline.mjs`** (regenerates the mirror; commit the parts alongside), then re-analyze before trusting graph results again.
- Note: `gitnexus analyze` also rewrites the symbol counts in `CLAUDE.md`/`AGENTS.md` and its skill files — commit that bookkeeping or it sits as noise in `git status`.

## 1. What last session did (2026-08-18 → 19): a Three.js perf/visual audit (`/improve-threejs`), all shipped
Method: headless Chrome (puppeteer-core, SwiftShader) with a **patched harness copy** of index.html in the scratchpad exposing `window.__dbg` (never in the repo) — GL create/delete counters, `renderer.info`, a `getProgramInfoLog` link tracer, CPU profile — plus a 9-finder/39-verifier workflow. Findings that mattered:
- **`3ed60a3`** Shader warm-up: r128 links programs lazily and synchronously; the arc-ribbon shader linked on the PLAY frame, shard `PointsMaterial` on the first hit, a LineBasic variant on first spawn. `warmShaders()` (boot idle) now pre-creates one of each on-demand kind, compiles, releases to pools → **0 links after PLAY** (measured). Reflection pass: mirror camera was det −1 → BackSide sky dome/milky shell were winding-culled out of the floor mirror; now a rigid camera (`REFL_M·M·REFL_FLIP_X`) + x-flipped RT sample in the floor shader (index.html ~1539). `sizeRefl` re-renders immediately. WASD ring canvas backing store 560×dpr → 300×dpr (its real CSS box). Night grid recolours vertex colours in place (no dispose → relink). `_templeDisposeChildren` prunes `_hzFadeMats`. Gamepad no longer forces 60 Hz idle frames. Two `Tone.Transport.ticks` reads in `animate()` → one lazy sample.
- **`97b6134`** Deleted the dead per-orb aim trail (silently dead since e172584 swallowed `tg.trailMesh=…` into a comment) — trail mesh pool + `starFlyStep` remain (returning-voice line). `enhancePlanetTexture` → 256-entry LUT. One `camera.matrixWorldInverse` per frame; `setVar()` change-guarded `--tx/--ty/--lx/--ly`; hoisted per-frame closures; epsilon dirty check in `placeAllSignArt`.
- **`0b55d06`** Audio automation diet (user: random crackle in Chrome at solid 60 fps): r128 `AudioListener`/`PositionalAudio.updateMatrixWorld` pushed 9 / 6 `linearRampToValueAtTime` per call, ~3 walks a frame → ≈1,600 + 1,100·N events/s. `quietAudioMatrixUpdates()` wraps them: listener once per two frames, Echo panner only when its pose changed. **User says it sounds good** — but if crackle recurs, the next suspects are steady-state load: TWO AudioContexts (Tone's + THREE's), an HRTF panner per Echo, a 2.2 s stereo convolver.
- **`c7cbeee`** Stale observer guard: the persisted observer location (Boston) stayed authoritative after moving to Japan → the sun/sky were computed for Boston (checkerboard at 20:47 JST). At boot a non-manual record whose longitude disagrees with the device UTC offset by >4 h is dropped (+ geo-tried latch) so the device is asked again; manual locations kept. `observer-location.js` gained `timezoneDisagrees`/`clearObserver` + tests. **User confirmed: works.**
- Baseline facts worth remembering: GL/three resource counts are FLAT over long play (no leaks); JS main thread ~92 % idle; the codebase is already heavily hand-optimised — look for what survived that care, not for textbook items. Menu/pause runs at 20 fps **on purpose** (`IDLE_FRAME_MS`); user chose to keep it. Colour space is deliberate linear passthrough (comment ~index.html:2988) — not a defect. Tests: `node --test tests/*.test.js` → 183/183.

## 2. Verified-but-deliberately-not-changed (don't re-find these)
Transparent floor layers with no `renderOrder` (ordering is monotonic in y — stable in practice); dome early-z reorder (its FBM branch is already gated `el>0.03`); r128 `PositionalAudio` ramps (now dieted, see above); `enterSkyTemple` rebuilding temple geometry each entry; per-hit double forced layout (`void el.offsetWidth` idiom ×2); `bowGlyphPaint` fillStyle strings per dot during the 4 s Mandala; `broadcastAim` payload every 85 ms even when still. Full finder/verifier record: `~/.claude/projects/-home-mrcolson-repos-aim-dojo/6e6a8ce8-…/subagents/workflows/wf_f0cf1ce8-60a/journal.jsonl`.

## 3. OPEN threads (confirm with the user before starting)
- Audio: watch for crackle recurrence → contexts/HRTF work above.
- Nothing else pending from the user. Candidate hygiene if asked: the disabled flick-bonus block, `tankOpen/tankGlow/tankBeatPhase`, unused records helpers.

## 4. Identity (unchanged — do not regress)
First-person **rhythm shooter under a real sky**: Echoes glow open on the beat, you fire a ballistic arc, the kill is judged at **ARRIVAL**, off-beat = CLANK. WASD on the "and". Aim is always the star — no auto-aim. Every visit starts with Moon Sensei's trainer (checker floor / room), graduation opens the full night (the void, the Star Road, star-tethers). Zen feel prized: tune CFG consts, don't add UI (pause SETTINGS is the sanctioned exception). `prefers-reduced-motion` disables motion effects — check it first if "an effect disappeared". Sky is wall-clock/sun driven (`SKY_TIME='natural'`, observer location → true sun; no location → civil-clock fallback).

## 5. PROCESS
- **Harness for evidence, never guesses**: copy index.html to the scratchpad, inject a `window.__dbg={…}` hook right before `renderPrimary(false,false);\nanimate();`, symlink `*.js`/`assets`/`fixtures`, serve with `python3 -m http.server`, drive with puppeteer-core (`npm i puppeteer-core@25` in the scratchpad; Chrome at `/usr/bin/google-chrome`, flags `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`). SwiftShader auto-detects as LOW → add `?hi` for the full-quality path. `?low` forces LOW. Trainer→full night: `__dbg.setTrainPhase(3)`. Fake the clock with a `Date` shim in `evaluateOnNewDocument`.
- Syntax check = the test suite (`index-contract` parses every inline script). Ship: `git add … && git commit && git push` (auto-deploys). Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + the `Claude-Session:` line.
- Ultracode/workflows for audits; adversarial verify every finding at file:line — verifiers repeatedly downgraded plausible-but-marginal items and refuted "already mitigated" ones.
- Audio/feel is ear/eye-judged: ship a first pass behind a const, let the user react.

## 6. Deploy / repo
Vercel primary (push→live seconds), GH Pages mirror, Railway public-sky API (`sidereal-production.up.railway.app`, CORS-blocked from localhost — expected). Repo github.com/robjohncolson/aim-dojo, branch `main`. Machine: Ubuntu, node 24, npm 11, 4 cores (workflow concurrency = 2 agents — plan for it).
