# Codex prompt — Wave 10: THE TERRAIN (carved mark · hills · a real bend)

**Working directory:** `/home/mrcolson/repos/aim-dojo` (branch `main`, clean at start, HEAD `f435805`).
**Authoritative spec:** `SPEC_MOONLINE_TERRAIN.md` — read it IN FULL first; where this brief and the spec disagree, the spec wins.
**Visual references (read the code, copy the *read*, not the code):**
- `<scratchpad>/studies6/glyph/index.html` — parcel A: the chevron carved into the deck (the mark's SDF, the groove, the cut that stops the street's veining).
- `<scratchpad>/studies6/charged/index.html` — parcel A's **dark socket** only: how it kills the gold glass inside a cell so a gold lane still reads on a gold street.
- `<scratchpad>/studies6/elevation/index.html` — parcel B: the re-based height course, everything riding it, the analytic occlusion horizon, reflections about the local deck.
- `<scratchpad>/studies6/curves/index.html` + `course.mjs` — parcel C: the fourth harmonic and the partial re-basing, with the measured statistics.
(`<scratchpad>` = `/tmp/claude-1001/-home-mrcolson-repos-aim-dojo/3186ce38-c333-4532-a30f-1b13cdeb8b3f/scratchpad`)

**Do not commit. Do not push. Do not run `gitnexus analyze`. Do not edit `CLAUDE.md`/`AGENTS.md`.** Leave the tree modified.

## Hard rules (these have each caught a real bug in this repo)

1. **Never append code after a `//` comment. Never delete a statement with regex/sed.** A mechanical edit once turned live statements into comment text (`97b6134`) and shipped. The swallow-scan contract test must stay green.
2. `tools/index-inline.mirror.part*.js` are GENERATED (line N = index.html line N). Never edit them; run `node tools/extract-inline.mjs` as your LAST index.html step.
3. **THE LANE COLOURS.** Wave 9 shipped a bug where the road named the wrong key, because a study invented its own lane hues in the wrong order. Lane 0 = **W = cyan #43d9ff**, 1 = **A = green #74e84a**, 2 = **S = gold #ffd36b**, 3 = **D = pink #ff5a7a**. **Derive every lane colour from the existing `uL0..uL3` uniforms (fed by `WASD_HEX` → `_roadLaneCol[i]`). Introduce NO new lane-colour literal.** The contract tests from `f435805` assert this chain end-to-end — if you touch it and they fail, you broke it.
4. Before editing a named function run `gitnexus impact <name> --direction upstream` and report the callers. Expect: `roadCourse`, `roadCourseX/D`, `roadSync`, `buildRoad`, `buildRoadArches`, `buildNaveVault`, `buildNaveVeil`, `buildRoadDust`, `roadLean`, `moonlineVoid`.
5. House style: dense single-line statements, `//` comments that say WHY, flat CFG literals with decision comments, raw-boolean-first kill-switches, `_roadG()` for GLSL float literals, **shared uniform OBJECTS never copies**.
6. `node --test --test-isolation=none tests/*.test.js` green (**196** at baseline) plus your new tests.

## Parcels — implement all three (spec §1–§3 carries every number)

- **A — THE MARK.** Replace the full-width lane band with the carved chevron (4.67 m outer, 0.99 m stroke, `S=u/7.5` clamped 1…4.5, 0.25 m groove, street veining cut by `(1−0.88·cut)`), **including the dark socket** (kill ≤85 % of the gold glass inside the mark, deepen the dark base) — without it lane S (gold) vanishes on the honey street, which is exactly how the sibling study failed. Direction mapping: W away, S toward, A left, D right. `markGlyph:false` → wave-9 bands byte-identical.
- **B — THE TERRAIN.** The height course, the re-basing, the ribbon of quads displaced in Y only (so `u=−z` and the honey-glass fragment shader are untouched), everything riding `cyAt(−z)`, reflections about the local deck, the analytic occlusion horizon cutting deck/arches/rails/canopy/reflections at the same brow. **Nothing in gameplay may read terrain height** — orbs, projectiles, spawns, the `p.y<2.2` bounce and the camera all stay exactly as they are (verified: spawn Y is clamped around `PLAYER_POS`, road-independent). `terrainOn:false` / `terrainAmp:0` → flat road byte-identical.
- **C — THE BITE.** Fourth harmonic at **7.0 beats / 2.2 m** inside `roadCourse()` (7 not 8, so the bend never locks to the bar — say so in the comment), plus `curveHeading` keeping ~20 % of the tangent, both on knobs, both 0 → today's course exactly. Respect `ROAD_BEND_M`.

## Tests you must add (behavioural, not token-presence — wave 9's first attempt at these was tautological and passed *with a live bug*)

1. **Re-basing invariant:** extract the height-course + re-basing expression and assert numerically that `cy(0) == 0` and `d(cy)/du |_{u=0} == 0` for a spread of `now` values — i.e. the deck is provably at the player's feet and level under them for any course phase. This is the treadmill law in test form.
2. **Gameplay isolation:** assert no spawn/projectile/bounce path references the terrain function (grep the emitted sources for the terrain symbol inside those code regions and assert absence).
3. **Kill-switch fidelity:** with `markGlyph:false`, `terrainOn:false`, `curveBite:0`, the emitted road/arch shader text must equal a frozen wave-9 fixture (extend the existing `tests/moonline-wave8-arch-shaders.fixture.json` pattern — add a wave-9 capture; do not disturb the existing wave-8 entries, which are byte-verified).
4. **Lane identity:** keep the `f435805` chain tests green and extend them to the mark's fill so the chevron provably takes its colour from `uL{lane}` and not from a literal.
Verify each new test by **mutate → must-fail → revert → must-pass** and report both results per test.

## Visual self-verification

The dispatcher's harness works: `<scratchpad>/harness/`, `make-harness.py` regenerates from the repo with a `__dbg` hook, server on **port 8771**, `nave-shot.mjs <page> <prefix>` renders. If your sandbox refuses sockets or Chrome (it has before), say so plainly and state what you verified statically — **do not claim a render you did not do.**

## Verification block (run all, paste output)

```
node --test --test-isolation=none tests/*.test.js
node tools/extract-inline.mjs
git status --short && git diff --stat
```

## Final message format

Per parcel A/B/C: index.html line ranges, one-line summary, deviations. The `gitnexus impact` results. The mutate/revert result for each new test. Triangle count for the road ribbon and the draw-call delta. Anything you are unsure about, stated plainly — an adversarial reviewer will attack exactly those, and in this repo it has found something real every single time.

---

# ROUND 2 — from the dispatcher's harness renders (2026-08-21)

Round 1 is applied and **works**: the bend is clearly visible (`uBite=[2.2,…]` live), the terrain runs in the vertex shader (`uTerrain=[18.87,1]` live, 1754-vertex ribbon), and the chevron correctly **replaces** the band — verified by A/B renders with each kill-switch flipped (`markGlyph:false` restores wave-9's warm banded deck exactly). Two problems only a render could show. Fix both.

### R1 — the deck lost its warmth (a silent regression of a shipped user decision)
Wave 9's honey-glass street was a decision the user made and liked. In wave 10 the near deck renders **near-black** with only gold leading visible. Cause: the deck's warm glow came largely from the cell's own light — wave 9 had `nave += cell*(ROAD_CELL_INK*fillA*lum*inner*1.35)` covering the whole cell, and round 1 correctly gated that on `markFill` (index.html:~2649), so the deck lost the fill's contribution along with the band. Correct in principle, too far in practice.
**Fix:** restore the deck's honey *stone* warmth independently of the lane cell. Raise the Nave base term (the `vec3(0.115,0.040,0.004)*(…)*inner` ambient at ~2648) and/or add a low, unsaturated honey fill across the cell footprint — something on the order of 12–20 % of wave-9's cell contribution, carrying **no lane hue** (so it cannot be mistaken for the cue). Target: side by side with `markGlyph:false`, the deck should read as the same warm street, just without the saturated band. Put the amount on a named const with a decision comment so it can be dialled.

### R2 — distant marks merge into a solid coloured ribbon
The foreshortening stretch `S=u/7.5` clamped to **1…4.5** is right up close but at grazing angles the stretched chevrons cover most of their cell and blend into a continuous rainbow strip down the far road — which is precisely the "too much colour" the mark was meant to end. It is visible in every render as a solid coloured band running off toward the vanishing point.
**Fix:** cap the mark's **screen-space** coverage rather than its world stretch: taper the stretch back toward 1.0 beyond the near cells (or clamp the mark's along-road extent to a fraction of its cell — no more than ~35 % of the 27 m), and let distant marks shrink to a small bright chevron with clear dark deck between them, as the study's `glyph-far.png` shows. The far road must read as a receding STRING of separate marks, never a continuous ribbon. Verify at the same camera the dispatcher uses (eye 4 m, FOV 95) that cells 4–8 are visually separated.

### Not to change
The bend (parcel C) and the terrain (parcel B) are landing as intended — do not retune them this round. All four behavioural tests and the 200-test suite must stay green; keep the kill-switch fidelity (`markGlyph:false` → wave-9 byte-identical) intact and re-verify it.

Verification: full suite, mirrors regenerated LAST, swallow scans zero, `git status --short`/`git diff --stat`. Final message: line ranges, what you changed for each, the named consts you introduced, and re-confirmation that `markGlyph:false` still matches the frozen wave-9 fixture.

---

# ROUND 3 — adversarial review returned BLOCK (2026-08-21)

Five findings; the dispatcher independently verified each and **reframed #1** — read that carefully, the review's diagnosis was half wrong in a way that matters. Fix R1–R5.

### R1 — BLOCKER, but NOT "gameplay isolation". The tracking drill's DIFFICULTY changed silently.
The review reported `curveBite → roadCourseD → roadLean → _dollyY → camera yaw → computeShotPlan → spawnProjectile` as a violation of "no gameplay quantity may read the new curve term". **That chain is real, but the dolly moving the aim is the SHIPPED, DELIBERATE design** — index.html:8873 says so outright ("the shot follows the drifted crosshair, so you counter it to hold a target"), and SPEC_STAR_ROAD decision 3 (index.html:1803) made the dolly follow the course on purpose: *the course IS the tracking drill*. So the road bending the aim is not a bug and must not be "fixed" by divorcing the dolly from the course — that would break a shipped contract.
**The actual defect:** the 7-beat harmonic has **3.2× the curvature** of the previous tightest, so `roadLean()` swings harder and faster and **the tracking drill silently got harder** — a gameplay difficulty change riding in on an art change, with no decision behind it and no knob.
**Fix:** give the dolly its own scalar on the bite term — a named const + flat CFG key (e.g. `leanBite`, 0…1) controlling how much of the fourth harmonic `roadLean()` sees, *independent* of how much the road's geometry sees. **Choose its default by measurement, not taste:** compute the p90 of `|roadLean()|` over a swept course for wave 9 and for wave 10 at several `leanBite` values, and pick the value that keeps p90 within ~20 % of wave 9. State the measured numbers in your final message. The road bends fully; the drill's difficulty stays where the user left it, and the knob makes raising it a decision.

### R2 — HIGH: the occlusion horizon ignores the road's lateral displacement
`terrainVis()` (index.html:~1944) tests longitudinal distance and `|localY|` but never whether the occluding crest is actually *on the line of sight*. On a bend it alpha-kills vertices whose camera ray passes well beside the near deck. Proof from the reviewer, reproduced from the emitted GLSL: seed `20260821`, phase `0.103781`, clock `64.875`, far vertex `u=702` → `terrainVis=0`, while the camera-to-vertex ray stays ≥ **10.1 m** from the candidate near centreline — outside the 7 m half-deck, so that crest cannot physically occlude it.
**Fix:** a sample may occlude only if the camera-to-vertex ray lies within `cx(d) ± ROAD_HALF_W` (plus a little rail softness) at that sample distance.

### R3 — HIGH: the dust passes eye-relative height into a deck-local parameter
index.html:~2497 calls `terrainVis(u, P.y - EYE)`. **Every other caller passes deck-local height** (`terrainVis(u,yl)`, `(u,ly)`, `(u,0.0)`) — dispatcher-verified by enumerating all call sites. So a mote at eye height is treated as deck-level and culled, and a mote on the deck gets `−EYE` of false clearance.
**Fix:** pass `terrainVis(u, P.y)` before the `cyAt(u)` lift. One token; add a comment naming the convention so it cannot regress.

### R4 — HIGH: the four new tests have mutation gaps (each proven)
- **Treadmill:** mutate production to `wp.y += cyAt(u)+1.0` → the test's *isolated* rebase math still passes and the token assertion matches. **Test the production emit, numerically, on emitted vertex positions.**
- **Gameplay isolation:** it scans only `spawnTarget`/`updateProjectiles`/`animate` — it missed the entire R1 chain. **Trace `roadLean`, `computeShotPlan`, `updateArcPreview`, the dolly, and the lock path too.**
- **Kill switches:** the harness injects `ML_TERRAIN` directly, bypassing the production gate, so breaking `terrainAmp:0` gating still passes. **Drive the production gate; evaluate each switch alone AND in combination.**
- **Information integrity:** inserting `lc=uL0;` after the asserted expression leaves every regex true while every chevron shows lane 0. **Sample distinct lane/direction/wake states numerically, not by token.**
Re-verify every test with mutate → must-fail → revert → must-pass, using *these* mutations.

### R5 — HIGH (upgraded from MEDIUM: the dispatcher measured it)
The review called the horizon cost "unbudgeted". It is worse: measured in the harness at 1280×720 on SwiftShader, median frame time is **89.8 ms with `terrainOn:false` vs 252.2 ms with terrain on — 2.8× the cost** (p90 107 → 272 ms). SwiftShader's absolute numbers mean nothing, but a 2.8× vertex-cost multiplier does, and this game explicitly supports weak GPUs (LOW exists for a 2014 Mac Mini).
**Fix:** cut the horizon's per-vertex work hard. Options, cheapest first: hoist the harmonic evaluation out of the sample loop; reduce the sample count and increase the step (the brow does not need 1 m resolution at 700 m); precompute the horizon profile once per frame into a small uniform array or lookup and sample *that* in the vertex shader; skip the horizon entirely on LOW. **Re-measure with the same method afterwards and report before/after — the target is within ~20 % of the flat-road cost.**

Unchanged this round: the bend's geometry, the terrain's shape and amplitude, the mark's taper and honey-stone (all verified good). Keep 200/200 + your new tests green, mirrors regenerated LAST, swallow scans zero. Final message: per item, what changed, the measured numbers for R1 and R5, and the mutate/revert result for each test.

---

# ROUND 4 — the perf fix targeted the wrong thing (dispatcher measurement, 2026-08-21)

R1–R4 of round 3 are **verified good** (the `leanBite:0.25` measurement is exactly what was asked for — p90 lean 0.990 vs wave 9's 1.000). **R5 did not work**, and the dispatcher's round-3 brief is to blame for pointing you at the trigonometry. Re-measured after your caching, same method (harness, 1280×720, SwiftShader, median of 160 frames):

| build | median | p90 |
|---|---|---|
| `terrainOn:false` (flat, wave-9 road) | **86.4 ms** | 103.2 |
| `terrainOn:true, terrainAmp:0` (ribbon geometry, zero displacement, mark ON) | **97.9 ms** | 109.9 |
| `terrainOn:true, markGlyph:false` (terrain displaced, no mark) | **147.1 ms** | 178.3 |
| shipping config (terrain + mark) | **233.6 ms** | 272.5 |

Read those four numbers carefully — they say something your 222× trig reduction could not fix:
- The **ribbon geometry is nearly free**: +11.5 ms over the flat plane.
- **Terrain displacement alone** costs ~49 ms (98 → 147 with the mark off).
- **The mark costs ~87 ms *only when terrain is displaced*** (147 → 234), yet costs ~12 ms when it is not (86 → 98).
- So neither feature is individually expensive. **They interact super-linearly**, and that interaction is the whole regression.

**Your task this round is diagnosis first, then fix — do not guess.** Find *why* the mark's fragment work explodes once `terrainAmp≠0`. Strong hypotheses to test and discard on evidence, not intuition:
1. The occlusion/horizon term is being evaluated **per-fragment** (or forced into the fragment path) once terrain is live, so every mark fragment pays for it — it belongs in the vertex shader, interpolated.
2. Terrain displacement breaks a compiler fast path (e.g. a previously uniform-constant expression becomes varying), so the mark's SDF/socket/taper work is no longer hoisted or is executed on fragments that previously early-outed.
3. An early-out `discard`/branch that used to reject most deck fragments cheaply no longer triggers with a displaced deck, so the expensive mark path runs across the whole ribbon.
4. Overdraw: the displaced ribbon draws far more overlapping fragments (reflections? the second/third planes? the socket pass?) than the flat plane did.

Method: instrument by elimination in the harness the way the dispatcher did — build variants with individual terms stubbed out and measure. **State which hypothesis the evidence supports and which you ruled out**, with numbers.

**Target:** shipping config within ~20 % of the flat baseline (≈104 ms median at this camera/rasterizer), with the mark and terrain both fully on. If that proves impossible without losing a feature, say so explicitly and propose the cheapest honest degradation (e.g. horizon off on LOW *and* a coarser mark path beyond N cells) rather than quietly missing the target.

**You cannot render in your sandbox.** So: make the change, state precisely what you changed and why, and **the dispatcher will re-measure with the same four-variant method**. Do not claim a frame time you did not measure — an unmeasured claim here is worse than none, because the last one cost a round.

Unchanged: `leanBite`, the bend, terrain shape/amplitude, the mark's geometry and taper, all R1–R4 fixes. Keep 204/204 green, mirrors last, swallow scans zero.
