# Codex prompt — Wave 11: THE ENFILADE (infinite chalk walls · glowing doors · saturated-on-the-beat)

**Working directory:** `/home/mrcolson/repos/aim-dojo` (branch `main`, clean at start).
**Authoritative spec:** `SPEC_MOONLINE_ENFILADE.md` — read IN FULL first; where this brief and the spec disagree, the spec wins.
**Visual reference (the LOCKED look — read the code, reproduce the read):** `/tmp/claude-1001/-home-mrcolson-repos-aim-dojo/3186ce38-c333-4532-a30f-1b13cdeb8b3f/scratchpad/studies7/fresco/index.html` in its CURRENT state (it was iterated five times with the user; its `nf-*.png` renders alongside are the approved frames). It already contains the working laws you must port: the wall silhouette with the door hole (`wallGeo`), the under-door solidity fix (`d=max(d,-y)` below deck), the veduta light (cream lift + next-colour spill), the skirt dissolve (solid 95 → powder 200, two-octave `vn` noise, never `floor`-hash), the below-deck shadow (`grad*=exp(y*0.05)`), and the honey-foot clamp (`exp(-abs(y)*0.5)` — the unclamped form diverged and cost three debugging rounds).

**Do not commit. Do not push. Do not run `gitnexus analyze`. Do not edit `CLAUDE.md`/`AGENTS.md`.** Leave the tree modified.

## Hard rules (each has caught a real shipped-or-nearly-shipped bug in this repo)

1. **Never append code after a `//` comment. Never delete statements with regex/sed.** Swallow-scan contract must stay green.
2. Mirrors are GENERATED — never edit; `node tools/extract-inline.mjs` as your LAST index.html step.
3. **LANE COLOURS:** lane 0 = W cyan #43d9ff · 1 = A green #74e84a · 2 = S gold #ffd36b · 3 = D pink #ff5a7a, derived ONLY from `uL0..uL3` (← `_roadLaneCol[i]` ← `WASD_HEX[i]`). **No new lane-colour literal anywhere — including parcel S's saturated peak.** The `f435805` chain tests guard this; extend them to the peak term.
4. `gitnexus impact <name> --direction upstream` before editing named functions; report callers. Expect: `buildRoadArches`, `buildNaveVault`, `buildNaveVeil`, `roadSync`, `roadHorizonSync`, `roadArchFill`, the road/dust materials, `moonlineVoid` (CRITICAL — do not touch it).
5. House style: dense single lines, WHY-comments, flat CFG literals (no nested `{}`), raw-boolean-first kill-switches, `_roadG()` for GLSL floats, **shared uniform OBJECTS never copies**.
6. `node --test --test-isolation=none tests/*.test.js` green (**204** at baseline) plus your new tests.
7. **Half-space hazard (named in the spec):** every y-dependent term in the wall shader must be audited for both signs of y. The study's `exp(-y)` divergence below the deck saturated a whole region to white and masked three successive fixes. State in your final message that you performed this audit and what you found.

## Parcels

- **W — THE WALLS** (spec §2, every number there). Build them the arch way: parametric stations placed by the vertex shader from the course spline (`uBase/uA/uW/uP`, station beat = bar), riding `cyAt` and the terrain-horizon factor (opaque → discard threshold). One material family; ≤ 2 draw calls for all walls; veils/spill ≤ 1 more. Doorway hole above deck only; below-deck chalk sinking to shadow; dissolve + sparkle band; veduta light; night-seeded palette from `roadCourse()`'s key (private stream — the spawn stream must remain untouched draw-for-draw); gold apex star + jamb nodes kept; NO side walls; NO mirrored wall/veil (delete-the-mirror is part of the look). Mercy: no wall one bar before through two bars after the ring. While `wallsOn`, the white arch/accent geometry is not built (the vault canopy, dust, street, ring all stay).
- **G — CHALK DOES NOT HIDE SPIRITS.** The glow-through pass for occluded Echoes: depth-inverted (`GreaterDepth`) additive shell on the pooled target meshes, built only when `wallsOn`, ≤ +1 draw per live orb. It must never tint an unoccluded orb (verify: with no wall between, the pass contributes zero).
- **S — SATURATED ON THE BEAT** (spec §3). The chevron fill ramps from the wave-10 jewel rest state to the PURE `uL{lane}` colour, peaking exactly as the band-edge crosses the now-line, using the existing `b−uNow` term and the shared curve family — no new clock read. Named consts: ramp width (1.0 beat) and peak lift; `wallSat:0` → wave-10 fill byte-identical. Cap peak luminance so the chevron shape survives at 60 bpm.

## Tests (behavioural; mutate → must-fail → revert → must-pass for each, report both results)

1. **Kill-switch fidelity:** `wallsOn:false` (and `wallSat:0`) → emitted road/arch/wall shader set byte-identical to a frozen wave-10 fixture (extend the fixture pattern; do not disturb the wave-8/9 entries). Drive the PRODUCTION gates, not injected flags.
2. **Palette seeding:** the chamber-colour sequence derives from the same date⊕phase key as `roadCourse()` and consumes a PRIVATE stream — prove the spawn stream is untouched (call-count the shared rng before/after wall building; must be equal).
3. **Saturation timing:** numerically evaluate the mark-fill expression at `b−uNow = {1.0, 0.5, 0.25, 0}` beats and assert monotonic ramp to exactly the pure lane colour at 0 (and back to rest by −0.25 into the wake handoff). Derives from `uL{lane}` — assert no literal.
4. **Glow-through neutrality:** the GreaterDepth pass contributes nothing when unoccluded (evaluate its blend inputs at equal depth).
5. **Door solidity:** the emitted wall fragment shader contains the below-deck door clamp and the `abs(y)` honey clamp (textual is acceptable for these two, they are one-token laws).

## Visual self-verification

Harness at `<scratchpad>/harness/` (`make-harness.py`, server port 8771, `nave-shot.mjs`/`terrain-shot.mjs`). If your sandbox refuses sockets/Chrome — it has every time — say so plainly and do NOT claim renders; the dispatcher renders and runs the four-variant perf measurement (`?hi` and `?low`).

## Verification block

```
node --test --test-isolation=none tests/*.test.js
node tools/extract-inline.mjs
git status --short && git diff --stat
```

## Final message format

Per parcel W/G/S: line ranges, one-line summary, deviations. GitNexus impact results. The half-space audit statement. Mutate/revert results per test. Draw-call and triangle deltas vs wave 10. Uncertainties stated plainly — the adversarial reviewer has found something real in every wave so far.

---

# ROUND 2 — adversarial review returned BLOCK (2026-08-21); dispatcher verified findings 1–2 at source

Fix R1–R5; R6 is documentation only. Keep 209/209 + new tests green; mirrors LAST; swallow scans zero.

### R1 — HIGH: `wallsOn:false` alone is not wave-10-exact
`index.html:1931`: `ML_SAT=ML_MARK && wallSat>0` — no `ML_WALLS` term, so the master kill-switch leaves the saturation uniforms/GLSL emitted (same defect for `wallDissolve:0`). **Fix:** `ML_SAT = ML_WALLS && ML_MARK && (+CFG.moonline.wallSat>0)`; audit every wave-11 fork for the same coupling; extend the fixture test to check `wallsOn:false` ALONE and `wallDissolve:0` ALONE against the frozen fingerprint (the reviewer's surviving mutation — kill it).

### R2 — HIGH: saturation peaks half a beat late and never as one shape (this is the USER'S headline request — get it exactly right)
`index.html:2741` keys `markSat` to the per-fragment `b−uNow`: each fragment peaks as IT crosses the now-line, so the glyph centre (at n+0.5) peaks 0.5 beat after the audible edge (band edge at n crossing the now-line — the documented audible-beat moment), and only a thin transverse slice is ever pure. Under reduceMotion (uNow pinned 0) the mark holds a permanent spatial gradient and never beats.
**Fix:** ONE envelope per CELL, keyed to the band edge: phase = `floor(b) − uNow` (constant across the cell), envelope peaking exactly at phase 0; the whole chevron saturates together, at the audible beat, at 28 and at 60 bpm. reduceMotion: feed the envelope from the shared beat authority that already drives the standing pulses (uPulse/uBreath family — the geometry stays pinned, the colour still breathes on the beat, which is the established reduceMotion pattern for the ribbon). Tests: evaluate the EMITTED shader at the band edge, the glyph centre, and both chevron arm extremes at phase {edge, ±0.25} and assert simultaneous pure-lane colour at the edge moment; add the reviewer's missed-verdict regression (a missed band must not die in full lane colour — currently true, keep it true).

### R3 — MEDIUM: wall construction moved the course's lazy-seeding moment
With `terrainOn:false`, wave 10 first called `roadCourse()` at the first live `roadSync`; wave 11 calls it in `buildRoadWalls()` (build time). Cross midnight or a moon-phase boundary between load and graduation and tonight freezes YESTERDAY'S course — a silent tonight-is-tonight regression. **Fix:** defer palette/course initialization to the first live sync, after the existing wave-10 `roadCourse()` call site; walls read the palette lazily. Test: assert `buildRoadWalls()` performs no `roadCourse()` call (instrument the call count at build vs first sync).

### R4 — MEDIUM: rear walls pop while fully visible; reduceMotion slots swap identities
Recycled rear stations drop at −12 beats/324 m — inside the 734 m full-opacity region — so a wall vanishes abruptly when looking back; under reduceMotion, pinned stations get their `uK`/palette data stepwise-replaced each bar (a standing wall can flip wall→ring→suppressed→new colour in place). **Fix:** retire rear slots through a one-bar dissolve (reuse the powder law — a wall CRUMBLES out, on-theme) before recycling; under reduceMotion pin station identities (or crossfade data) so a visible slot never changes kind/colour instantaneously.

### R5 — MEDIUM: bound LOW's p90
The spike source is nested doorway-SDF overdraw across the full station count. **Fix:** LOW-only active-station cap (nearest 5–7 walls; named const, decision comment) — beyond it the wall simply isn't built on LOW (the dissolve horizon covers the absence). Re-measurement is the dispatcher's.

### R6 — documentation only (dispatcher's scale-down decision, do not implement stencil masking)
The GreaterDepth pass fires for ANY closer depth-writer: walls (intended), the mercy ring (harmless), another orb's core (cosmetic — the front orb is unobstructed and the rear glow indicates presence; the spec's law "a wall may never cost a target" is upheld), brief projectile flicker (harmless). Terrain does NOT trigger it (the road writes no depth). Write this scope into the pass's `//` comment and into SPEC_MOONLINE_ENFILADE.md §2 as an accepted property, so a future reader doesn't "fix" it into a stencil system nobody asked for.

Final message: per-item line ranges, the emitted-shader evaluation table for R2 (edge/centre/arms × phases), the call-count proof for R3, and mutate/revert results for every changed test.
