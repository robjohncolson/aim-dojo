# CONTINUATION_PROMPT — Moon Chorus / aim-dojo (resume here, 2026-08-23)

## -11. 2026-08-23: wave 17 — A WORTHY NIGHT (`648c646`) + relay ease (`5301864`), both live
- Worthiness eased user-calibrated: GH_WORTHY_ARRIVALS=8, GH_WORTHY_DUR=45; relay mirror eased FIRST and
  live-smoked (50s→200, 44s→422) — deploy ORDER law: relay before client whenever the mirror moves.
- Legacy Supabase realtime channel fail-quiets on one latch (dead 401 credentials were retry-hammering);
  healthy path byte-preserved. Reviewer 14/14. 298/298.
- STILL OPEN: the user's first real night on the wire (only 4 smokes + 2 ease-probes on the relay). Their
  console showed [0,'9aff99'] = token minted, night unstored (old bar). With 8/45 live a casual minute
  banks. Next: user plays → scan relay (non-2338/2000-ish artifacts = real) → celebrate → friends invited.

## -10. 2026-08-23: wave 16 — THE BRISK LESSON (`b846d7f`) shipped+live
- Trainer gates halved AGAIN (user-locked; they kept the every-night tutorial over a skip gate — 'sometimes
  the tutorial is refreshing'): 3/2/2, TRAIN_NEED_TOTAL 7. Ghost finalize-on-page-departure: pagehide +
  persisted:false ONLY (review blockers, 13/13: visibilitychange finalize would have killed nights on
  tab-switch; unconditional keepalive silently dropped >64KiB uploads even at the bow — envelope
  serialized once, keepalive only under the budget, bow uploads ordinary fetch). 297/297.
- STILL OPEN: the user has NOT yet landed a real night on the relay (only the 4 smoke ghosts, buckets 5-8,
  2338 B each). Next session: after the user plays post-wave-16, query the relay (scan lon 0-23 via
  X-Ghost-Token header; a non-2338-byte artifact = their first real night) and CELEBRATE it; then their
  second night should seat their own ghost + a smoke visitor. Overnight Codex API drops repeatedly wedge
  runs (~02:00 JST) — kill + continuation-dispatch is routine; see the codex-dispatch-procedure memory.

## -9. 2026-08-22 NIGHT: wave 15 — THE VISITOR (`418eec1`) shipped+live. THE CHORUS IS OPEN.
- **Shipped**: ghostShare:1 — worthy nights upload to the Ghost Relay (anon 32-hex token, X-Ghost-Token
  header ONLY; lonBucket from TIMEZONE only); a nearby stranger's night seats at −90 (THE VISITOR — same
  veil/reveal/beacon laws, its own seeded chalk, moon-phase-sigil identity); gifts generalize over both
  seats; visitor catches batch to its mailbox; own mail arrives read-once at the threshold ('N of your
  notes were caught · sigil') and each caught note RETURNS as a road-clocked shooting star at its beat
  (GH_RETURN_MAX 16). RIDER: incantation = W W S S A D A D · L · SPACE (trackpad-true; MB2 arm deleted).
- **THE FIND OF THE ARC (no-mocks e2e through the REAL doors)**: waves 13-14 shipped with the ghost
  system UNREACHABLE — the only entry is beginAs(true) (trainer), graduation flips trainMode mid-session,
  and the recorder/seat armed only at main-play RESET. Fixed: graduation IS main-play session start —
  setTrainPhase(3) → ghostSessionStart() (seat → visitor/mail fetch → recorder), road clock based at
  graduation, lesson still never records. PROVEN through the honest lifecycle on a quiet machine:
  incantation → graduate → 214 s night → 19 arrivals → bow stores 2,962 B → reload → graduate →
  own:true. LESSON FOR ALL FUTURE WAVES: the harness's trainMode=false staging BYPASSES the real
  topology — every acceptance must also walk beginAs(true)→incantation→graduation at least once.
- **Environment laws learned**: localhost harness CANNOT test relay network legs (CORS allows only
  production origins — by design); production-origin e2e = puppeteer on aim-dojo.vercel.app with pure
  input events (no __dbg there). The audio/road clock STARVES under machine load (road-time 0.2×-0.85×
  real when load>5 or >15 zombie Chromes — `pkill -9 -f chrome` + wait before timing-sensitive probes).
  A bad robot player suppresses spawns BY DESIGN (the tide); worthy nights need ~5-8 min blind play.
- **Reviewer 12/12**: wave-15 round closed a real trust hole (bounded relay JSON — abort timer must
  cover BODY consumption; byte ceilings BEFORE validation) + tz half-hour table (India/Newfoundland/
  Kiribati) + isolation oracles + Space-only-at-step-10. Relay: header-only tokens deployed
  (sidereal 313b234, live-smoked: body-token 422, header 200, read-once mail w/ sigil).
- **In flight at handoff**: the production-origin e2e (prod-e2e.mjs — live site, blind 8-min night,
  relay queried after for the fresh upload, night-2 screenshot). If it surfaces production issues,
  fix-forward. NEXT candidates: visitor render polish pass (user judgment on -90 peripheral weight),
  0d (±2 seats + silhouette line + ghost-filled chairs), the perf tuning session (gift LOW remeasure,
  GH_GIFT_LEAD feel), SENSEI_PACK projSpeedFast=72 vs base 60 reconciliation.

## -8. 2026-08-22 LATE: wave 14 — THE GIFT (`ca6348d`) shipped+live · GHOST RELAY on branch · slowdown fixed
- **THE GIFT (six rounds — the deepest wave yet)**: during my mercy the ghost's falling notes are catchable.
  Lock extends to flares (real targets outrank charity); gift shots fly GH_GIFT_SPEED=72 on the ROAD CLOCK,
  connection-graded only, and CAN NEVER HURT (punitive whiff taps suppressed, mutation-enforced); catch =
  star-burst + beacon sigh + mail row; threshold speaks 'you reached back · N notes caught'. ghostGift:0 →
  wave-13 byte-identical (8-combo fixture). LIVE ACCEPTANCE: 5 real catches in a 90 s storm at seat 90 m
  (harness/gift-storm.mjs — the in-page hunter: aim the analytic loft at the led flare, fire whenever the
  honest lock golds).
- **The six lessons (probes + reviewer, now 10/10)**: gifts died at the OLD ±32 m room walls; a 1.5 s window
  cannot fit a 1.4 s flight (GH_GIFT_LEAD=2.6, review-marched at 72); collisions must clamp to arrival;
  rewind resurrected caught slots; 'projSpeedFast' is 60 in base CFG (72 only in SENSEI_PACK) — blessings
  need their own named number; the LOCK must not promise post-arrival connections (honest-lock band test);
  and the ROOT of every near-miss: projectiles integrate on 50 ms-CAPPED render dt while ghosts replay on
  the uncapped road clock — ~11 m shear on slow frames. Gift flight now integrates on the road clock; the
  numeric differential oracle (march vs faithful flight) pins the agreement forever.
- **THE USER'S LIVE SLOWDOWN ('slows down when playing after a bit') — FIXED**: the lazily-built ghost seat
  missed boot warmShaders; first reveal each night compiled ~6 programs mid-beat (3.5–11.8 s single frames
  measured). ghostSeatBuild now schedules an idle renderer.compile re-warm; stall probe worst frame 181 ms.
  Longevity probes (harness/longevity-probe.mjs, mercy-stall-probe.mjs — with KEEP-ALIVE taps/fires or the
  bow ends the session and poisons the data) proved NO leak: heap/scene/draws/Tone timeline all flat.
- **GHOST RELAY (sidereal repo ~/repos/sidereal, branch `ghost-relay` @712d60c, pushed, NOT merged)**: the
  0c transport server — anonymous token upsert, lonBucket 0-23 fetch, mail w/ read-once + sigil-only
  identity; hardened by a security review (8 findings: pre-parse body limits, Railway CIDR proxy trust +
  IPv6 /64, storage quotas + secure_delete in a separate DB, SQL-side reads, tokens→headers + log
  sanitization, mailbox ingress protection, id rotation, UTC date mirror). 96 relay tests; repo
  regression-free (venv .venv-check; baseline = 5 SkyPack fixture fails + 1 env serve fail). MERGE TO MAIN
  = RAILWAY DEPLOY — held for the user's explicit word. Game-side UTC realCivilDate fix shipped in wave 14.
- **Next (0c client, after relay deploys)**: the visitor seat at −90 (multi-seat refactor of the singleton
  _ghost* globals), upload-at-finalize + fetch-at-reset via the relay, gift/mail vs visitors, sigil render.
  Perf note: one degraded-env sample showed gift-on LOW median +8-11 ms at a staged reveal (day's noise
  band was that wide) — REMEASURE in a fresh environment during the tuning session.

## -7. 2026-08-22: wave 13 — NIGHT GHOSTS phase 0a (`378c005`), shipped and live. MULTIPLAYER BEGINS.
- **The chorus design (user-locked over a long brainstorm)**: sovereign parallel railways (own seed/tempo/
  song/tide per player), seat spacing 90 m, Option B THE VEILED CHOIR — my walls byte-identical to solo
  (fixture-enforced), the chorus revealed by MY mercy via the shipped uK bars-to-mercy authority
  (v: 0 → 0.35 @2 bars → 0.7 @1 → 1.0 mercy). Always-visible exception: the lane-coloured lighthouse
  BEACON over the parapet when a ghost drops a note. Behind the inverse pane the ghost renders in
  negative — the spirits law, uniform (all ghost draws precede order 6). Studies: studies8/chorus
  (walls-choice-sheet.png; the rejected "room makes room" narrowing taught us the walls are sacred).
- **Phase 0a shipped**: every main-play night records itself (aimdojo.ghost.v1, localStorage, one slot,
  finalize-if-worthy ≥16 arrivals/≥60 s, invalid can never replace valid) and last-night-you rides beside
  you from your second night. Ghost wears last night's TRUE chalk (prior-night course seed + private
  palette stream re-derived). One road clock (Tone.Transport.seconds − audioLat()) for record AND replay.
  Knobs ghostRecord/ghostSeat, each 0 → solo byte-identical. LOW arm: beacon+road+targets+avatar only.
- **FOUR review rounds (reviewer 9/9)**: R2 BLOCK×8 (two-clock, rewind/bpm0, palette drift, validation
  gaps incl. invalid-overwrites-valid, tank-chip fires as misses, two surviving mutants, beacon/avatar);
  R3 FIX×3 (divergent-clock hits voided the whole night via hitT>arrivalT — recompute arrival at
  resolution; equal-time fire stamps credit wrong projectile — opaque row token; bow yaw MIRRORED —
  GH_AVATAR_YAW_SIGN=+1 with an aim-direction oracle vs gameplay's x=−sin(yaw)). 262/262, 34 mutants.
- **Ops lessons (memory updated)**: Codex's sandboxed gitnexus CLI HANGS indefinitely (8 h stall) — ban it
  in briefs, dispatcher does impact via MCP; Monitors need log-size stall detection (15 min); one round
  died on a Codex API network drop — just re-dispatch. Probe kit: ghost-probe2/ghost-beacon/ghost-yaw-
  probe (staging: trainMode=false + ghostSeatReset() via glob, uK pin drives the reveal; artifact rule:
  expired targets need hitT null; slots strictly increasing).
- **Phase 0b (NEXT, designed and user-approved)**: Railway transport (the sidereal app at index.html:1044)
  for other players' ghosts, longitude SEATING (sort key only — spacing stays 90 m), ±2 full seats +
  silhouette line, ghost-filled empty seats ("live is a ghost with zero delay"), gift archery at the
  flares (graded on CONNECTION not rhythm; only droppable notes giftable; mercy lends expert muzzle
  speed), the MAIL (assists delivered into the recipient's next session), stranger identity = zodiac
  sigil only. Perf note: reveal-open LOW +2.7 ms median (mercy-only); revisit if 0b widens the seat count.

## -6. 2026-08-22: wave 12 — SPACE TRUTH (`5962b82`), shipped and live
- **Parcel R — THE CONFIRM CROSSFADE**: the beat circle's correct-hit confirm used to vanish at the note
  midpoint in the same frame the next ring was born at full radius (user: "snaps back to a predetermined
  radius"). Now the confirm ECHOES past the flip (0.30 s capped at 0.6× interval, keyed on time + stored
  radius — nd-remap- and reset-proof) while the fresh ring condenses in over its first 18 % (ML_RING_IN).
  Frame-captured proof in harness/hud-{on,off}-sheet.png. ringEcho:0 → shipped draw path verbatim.
- **Parcel V — THE ARC BELIEVES THE VOID**: computeShotPlan still ended the aim parabola at the deleted
  floor (y<=0.04) and decorated the phantom point. Under moonlineVoid() the ribbon now continues to
  ML_ARC_FAR (140 m) with a 28 % tail dissolve (build-time uTail arm), landing ring + pulse rings stand
  down, uBands scales with the extension so the ROYGBIV period stays shipped, and the ribbon draws at
  renderOrder −41 in the void so the falling tail sits BENEATH live road cues. computeShotPlan byte-
  identical (SHA-pinned test) — aim/bullets/whiff timing untouched. Dojo/Temple/trainer-lesson keep
  their honest ground. arcVoid:0 → shipped shader byte-for-byte.
- **Review lessons (reviewer now 8/8)**: round 1 broke the SHIPPED in-void suppression inside
  spawnLandRing by rewiring its gate (restored — real missed shots already had no void ring: check HEAD
  before "adding" a suppression); implementer's "7 constructed, 7 killed" was FALSE — the review
  constructed 8 more survivors (frozen-solver hash, reduceMotion arm, spoiled-echo, pocket ring,
  allocation, pause/Temple lifecycle, uBands period, named-const inlining). Verify mutation claims.
- 242/242 tests. Probes: harness/ring-probe4.mjs (in-page HUD canvas frame recorder — full screenshots
  are too slow on SwiftShader to resolve sub-second HUD behaviour; record every rAF into canvas copies
  and pick nearest-to-target frames), arc-probe.mjs (state flags + full frame).

## -5. 2026-08-21 EVENING: wave 11.2 — THE INVERSE (`f1ad43b`), shipped and live
- **The mercy wall is now a colour-inversion pane**: ring/rose/veil retire behind flat knob `mercyInverse:1`;
  one non-depth-writing draw reuses the sibling walls' exact doorway silhouette, face = pure `1-dst` via
  CustomBlending (OneMinusDstColorFactor/ZeroFactor, white fragment, binary discard edges ONLY — inversion
  cannot alpha-fade). Night → paper-white with black stars; the next chamber's chalk shows as its own
  negative (green→plum); the doorway is the only true-colour view, wearing a crimson corona (the mint door
  glow inverting around it). Crown star stays true gold at order 6.5 over the pane's 6; dust promoted to 7.
- **The round-2 lesson (reviewer 6/6)**: my renders caught the pane inverting the FOREGROUND (road/cues
  nearer than it — road never writes depth, pane draws later) — a Lane Law breach during the final peak
  bar. Fix: a depth-only road-deck guard (child of roadMesh, exact road vertex shader + shared
  roadMat.uniforms, colorWrite:false depthWrite:true, order 5.5, built AND visible only with a live mercy
  pane). Foreground true, everything genuinely behind the filter inverted. Target CORES were already safe
  by law (opaque MeshBasicMaterial writes depth); their additive fringe is guarded by the same prepass.
- 227/227 tests; 7 constructed mutants killed (all-reader uK table, one-object pane lifecycle true→false,
  numeric crown apex, representation-independent lane-literal scan across all changed GLSL, target-depth
  contract, prepass structure, footprint spelling-sync). `mercyInverse:0` → wave-11.1 byte-identical
  (new frozen fixture moonline-wave11-1-shaders.fixture.json, verified against shipped `e9269e1`), and
  wallsOn:false still → wave 10. LOW perf, pane staged visible: median +0.5 ms, p90 +3.6 ms (mercy window
  only; +0 submissions otherwise). Probe: `harness/inverse-probe.mjs` (uK pin + forced pane visibility).
- Improvement menu still open: doorway crossings as felt events (bloom+whoosh on bar lines), tide-ordered
  palette (warm→cool toward mercy). The mercy-chamber-as-place item is PARTLY superseded by the pane.

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
