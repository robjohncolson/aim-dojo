# Night Ghosts — Wave 13, phase 0a (the echo seat: last night rides beside you)

**Version:** 1.0 · 2026-08-22
**Origin:** the multiplayer brainstorm (2026-08-22). User's vision: parallel sovereign railways, helping as a gift, ghosts of recorded nights filling the chorus. User locked: **Option B, the Veiled Choir** — *my walls never change*; the chorus is revealed by my own mercy; seat spacing **90 m**. Rendered studies: `scratchpad/studies8/chorus` (walls-choice-sheet, o2-fwd, o2-reveal).
**Files touched:** `index.html` (+ regenerated mirrors). **No server work in this wave** — the first ghost is the player's own previous night via localStorage. Phase 0b (named in §5, NOT this wave) adds transport, other players' ghosts, gift archery, mail.
**Follows:** Wave 12 (`5962b82`). The moonline wall/mercy/arc families are law; nothing in them may change emission.

## 0. What ships, in one breath

Every completed night quietly records itself — targets, taps, fires, tempo — as one small local artifact, overwritten nightly (ephemeral by design: the sky is the permanent record, the ghost is just last night's echo). From the second night a player ever plays, a **ghost railway** rides 90 m to their right: last-night-them, paler, moon-lit, replaying exactly. During work bars the player's own world is **byte-identical to solo** — the only signs of the neighbor are a beacon-tip above the parapet when the ghost drops a note, and nothing else. When the player's **own mercy** approaches and their walls exhale away (shipped behaviour, untouched), the ghost world stands revealed — road, seam-clipped walls in its own night's palette, avatar, targets, its hits blooming — and closes again with the inhale. THE SKY REMEMBERS YOU gets a body.

## 1. Parcel G — THE RECORDING (`ghostRecord:1`)

- **Format `aimdojo.ghost.v1`** (lock it — 0b transport and live phase 2 reuse it verbatim): `{v:1, date, moonBucket, bpm0, dur, bpmCurve:[[t,bpm]…], targets:[[spawnT,lane,slot,arrivalT,outcome,hitT]…], taps:[[t,lane,grade]…], fires:[[t,yaw,pitch,hit]…]}` — all times in seconds of the session's road clock. Caps (hard, drop-oldest beyond): bpmCurve 200, targets 1200, taps 2400, fires 1200 — ≤ ~100 KB serialized.
- **Write sites are taps into EXISTING events only** — the spawn site, the grade/clank sites, the fire site, the bpm-change site. The isolation contract of waves 10–12 applies with teeth: gameplay writes INTO the recorder; **nothing ever reads back**. No recorder state may be read by grading, spawning, aim, or spawn RNG. Construct that mutant.
- Lifecycle: recording arms at session start (main play only — never trainer lessons, never Temple), finalizes at session end into `localStorage['aimdojo.ghost']` **only if** the night held ≥ 16 target arrivals and ≥ 60 s (a false start never overwrites a real night). One slot, overwritten — yesterday's ghost is simply gone, like the night card.
- `ghostRecord:0` → no listener wired, no object allocated, localStorage never touched (the `remember.on` pattern).

## 2. Parcel S — THE ECHO SEAT (`ghostSeat:1`)

- **Geometry (locked by study):** seat at `GH_SEAT_X = +90` (one seat, this wave). Ghost road: deck strip half-width 7, gold edges + beat rulings + the two balustrade rails (eye-level presence, from study r4). Ghost walls: transverse at their bar stations, **seam-clipped** — solid chalk to ±24 m of their centre, powder-dissolving to ±38 m (the shipped dissolve LANGUAGE: dithered crumble, never a hard edge). Their palette derives from THEIR night (date/moonBucket recorded) — the ghost's chalk is last night's colours, ghost-paled.
- **THE VEILED-CHOIR LAW (the user's core requirement):** the player's own wall family — geometry, shaders, uniforms, draw order — is **byte-identical with the seat on and off**. The ghost seat is entirely separate objects. Fixture-test my wall/road emission across ghostSeat 0/1 (and ghostRecord 0/1, alone and combined) — the frozen-fixture pattern, mutation-verified.
- **The reveal coupling:** seat visibility rides MY shipped mercy machinery, one clock, no new state: `v = 0` at ≥ 3 bars to my mercy · `0.35` at 2 (exhale has begun) · `0.7` at 1 · `1.0` through my mercy span · back to 0 on the first full wall after. The packed bars-to-mercy already lives in `uK` hundredths (wave 11.1) — read the same authority, never a second computation. `v` scales the seat's opacities; at `v=0` the seat objects are `.visible=false` (zero draws during work bars).
- **The exception that is always visible: THE BEACON.** When a ghost target is in its final approach un-hit (`outcome` says it will expire), its lane-coloured light column (1.6 m wide, 40 m tall — the tip clears my 21 m parapet) burns at its position, with the white ring at the note. The beacon ignores `v` — it is the one signal that crosses the veil. Ghost tell: the beacon breathes slowly and its colour is pulled toward moon-blue (never a pure lane hue — the lane law stays clean: derive by mixing the WASD colour toward `#9fc2ec`, computed from `WASD_COL`, no new literal).
- **Ghost rendering:** palette through the study's ghostify curve (desaturate toward moon-blue, ~0.55 opacity walls); avatar = small luminous translucent figure abreast at their origin, halo, bow-aim yawing to the recorded `fires`; targets animate the standard approach from `spawnT` to `arrivalT` in their lane's (ghosted) colour; a hit target dies with a small pale flock-burst at `hitT` (reuse the pooled flock with a ghost tint and a hard cap — never new mesh classes); an expired target's beacon extinguishes like a candle (fade, no drama — their loss already happened).
- **Their clock is theirs:** the replay runs on the recording's own timeline (aligned to my session start) at THEIR recorded bpm. No quantization to my grid, no audio from the ghost — sovereign railways, silent neighbours.
- **LOW:** beacon + road edges/rulings + targets + avatar only — no ghost walls, no burst (`GH_LOW_*` consts). **reduceMotion:** the seat renders, bursts and beacon-breathing become standing states (the established pulse-in-place doctrine).
- Treadmill law: the seat is world geometry at fixed lateral offset; PLAYER_POS never moves; the ghost's scroll is its own rulings/stations animating — my course, my curves, my everything untouched.

## 3. Contracts

- Flat CFG, raw-boolean-first, decision comments: `ghostRecord:1`, `ghostSeat:1`. Each at 0 → shipped solo behaviour byte-identical (emission fixtures for MY families; zero allocations; no localStorage touch for record:0; zero draw calls for seat:0). Test each ALONE and combined; construct surviving mutants (the wave-12 standard — the reviewer has been 8/8; assume they will construct what you don't).
- Isolation both directions: gameplay→recorder is write-only; recording→seat renderer is read-only; **no seat/recorder value may flow into grading, spawning, difficulty, aim, or any RNG stream** (the private-stream law of wave 11). Construct the cross-wire mutant.
- One clock: session road clock for recording; replay offset arithmetic only. No `Date.now()` in the frame path (date only at finalize, existing pattern).
- Lane colours only ever derived from `WASD_COL`/`uL` (ghost tints computed from them). Comment-swallow law; mirrors regenerated LAST; no lane literal in any new GLSL or JS.
- Perf: four-variant (ghostSeat off/on × hi/low) **with the reveal staged** (mercy forced, seat at v=1) — the dispatcher measures; expected cost = a handful of draws only during reveals, +0 during work bars.
- GitNexus impact before touching any named function; `moonlineVoid`, `releaseTargetMesh`, `computeShotPlan`, the wall family emitters are read-only context.

## 4. What phase 0a deliberately does NOT do (phase 0b, next wave)

Transport (Railway POST/GET of ghost artifacts, longitude seating, ±2 seats), other players' ghosts, gift archery at ghost flares, mail delivery ("a star came from…"), sigil identity, live phase 2. The format in §1 is the contract that makes all of it a transport problem.

## 5. Playtest questions

The second night a player ever plays: does the moment land — *someone is beside me, and it's me*? Does the reveal read as mercy's gift (look who's here) or as clutter exactly when the player finally has rest? Is one beacon over the parapet during work bars intriguing, or does even that need to wait for the veil?
