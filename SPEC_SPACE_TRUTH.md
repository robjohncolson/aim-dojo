# Space Truth — Wave 12 (the ring stops lying at speed; the arc stops believing in a floor)

**Version:** 1.0 · 2026-08-22
**Origin:** user report, 2026-08-22 — (1) "if I hit a key when [the focus ring] is at its smallest, oftentimes it will snap back to a circle of what seems to be a predetermined radius… feels like a bug"; (2) "back when there was a ground it made sense to have the end point with the radiating circles… in the star road revision this makes no sense as we're shooting into space… gives the impression of an invisible plane existing which works against the space theme." Both diagnosed against the shipped code; the user approved both fixes ("yes yes, please do so").
**Files touched:** `index.html` (+ regenerated mirrors). No assets, no server.
**Follows:** Wave 11.2 (`f1ad43b`). Nothing in the moonline wall/mercy family moves.

## 0. What changes, in one breath

**Parcel R — THE CONFIRM CROSSFADE:** the beat circle's correct-hit confirmation currently vanishes at the note midpoint in the same frame the next note's ring is born at full radius — at main-play densities (up to 4 notes/beat) that discontinuity reads as "my keypress snapped the ring back out." The confirm now lingers and fades while the next ring condenses in from nothing at its birth radius. **Parcel V — THE ARC BELIEVES THE VOID:** the aim parabola still terminates on the deleted dojo floor (`y<=0.04`) and decorates the phantom intersection with a landing ring + beat-pulse rings; a real missed shot radiates a land ring on the same ghost plane. Under `moonlineVoid()` the ribbon now continues past the phantom floor and dissolves into the distance, and every landing decoration stands down — the same authority and the same precedent as the beat rings' own gate (index.html:7559, "THE RINGS BELONG TO THE ROOM").

## 1. Parcel R — THE CONFIRM CROSSFADE (beat circle, `drawWasdLane`)

The shipped machine (index.html:8548-8585), which parcel R refines and MUST NOT restructure:
- `ci=Math.round(beats*nd)` — the ring tracks the note NEAREST to now; `rawOff∈[±half]`, `half=0.5/nd`.
- Approaching (`off<=0`): `f=min(1,-off/half)`, `ra=Rin+f*span`, `al=0.35+0.65*(1-f)`. `f=1` only at the instant "nearest" flips — the ring is born AT `maxR` and shrinks immediately.
- Correct hit (`ci===_hitNote`): the ring freezes at `_hitOff`'s radius, `al=1`, and the `Rin..ra` annulus is shaded in the key colour. This confirm dies the frame `ci` flips (half an interval after the note) — the discontinuity under complaint.

The two changes, both inside the existing `showHud && !reduceMotion` block:
- **The echo:** at the moment a correct hit is drawn frozen, remember it (radius, key, `state.t` — module-scope lets, no allocation). After `ci` flips away from `_hitNote`, keep drawing the frozen ring + its shaded annulus with alpha decaying 1→0 over `ML_RING_ECHO_T` (named const, ~0.30 s, additionally capped at 0.6× the live note interval so a 4-notes/beat summit never shows two confirms). Correct hits only — a spoiled note keeps its shipped grey freeze-and-expire (the X glyph already carries wrong-key feedback; decided, not an oversight).
- **The condense:** in the approaching branch, scale `al` by a birth fade — `clamp((1-f)/ML_RING_IN,0,1)` with `ML_RING_IN`≈0.18 — so the fresh ring materializes from nothing at max radius instead of popping in at 0.35 alpha. The late/receding branch and the spoiled freeze are untouched.
- Net read: tap → confirm annulus in your key's colour, dissolving exactly while the next ring condenses and begins its shrink. Nothing on the canvas ever jumps.
- The echo keys on TIME + stored radius, never on `ci` arithmetic — so `_resolvedNd` remaps (index.html:1270) and difficulty grid crossings cannot resurrect or misplace it. It must also clear on session reset (the resetSession-lifecycle lesson of wave 11.1 — construct the mutant).
- Pocket paths: `pocketCircleCue` remains a default-off developer cue. The condense multiplies `al` in the shared approach branch (uniform law); the pocket TARGET ring (`ARC(rt)`) and `pocketLateScale` recede are byte-identical. The trainer inherits both changes unchanged — at 28 bpm they read as polish, not alteration.
- reduceMotion: the whole ring block is already skipped; no new motion appears anywhere on that arm.

## 2. Parcel V — THE ARC BELIEVES THE VOID (`updateArcPreview`, `updateProjectiles`)

- **`computeShotPlan` is READ-ONLY.** Its outputs (`M`, `V`, `T`, `_arcI`, `_planLanded`) are the aim contract — the back-solved muzzle velocity is why the bullet lands where the eye-parabola points. Not one term changes; run `impact` and keep it untouched.
- **The extended ribbon:** in `updateArcPreview`, when `moonlineVoid()`, compute a visual horizon `T_vis ≥ T`: continue the SAME muzzle-path integration (gravity + wind, the `sampleArc` law) past `T` until horizontal camera distance exceeds `ML_ARC_FAR` (named const, ~140 m) or `t ≥ CFG.projLife`. Then `sampleArc(M,V,T_vis,ARC_SAMP,_arcPts)` — the same 30 samples redistributed over the longer path (≈5 m spacing at expert muzzle speed; acceptable, state the number). Outside the void `T_vis===T` and the call is the shipped one.
- **The tail dissolve:** the ribbon must fade into the stars, not end in a razor edge. Build-time arm in `ARC_RAIN_FS` (the `ML_ARCH_RICH` pattern): with the knob on, the fragment gains a tail term driven by one new uniform (`uTail`, 0 outside the void) — `a *= mix(1.0, smoothstep-fade over the last ~28% of vUv.x, uTail)` — so the dojo look through the same build is visually identical (`uTail=0` is an exact ×1.0), and `arcVoid:0` emits the shipped shader string byte-for-byte.
- **Landing decorations stand down:** in the void, `arcLand` is never visible and `arcLanded` stays false (which already silences `animateArcPulse`) — gate the two assignments at index.html:8379-8380, leaving `_planLanded` itself untouched (it is a combat-only plan global; enumerate its readers with GitNexus and state them in the report). `arcApex` stays — a parabola's apex is still true in space.
- **The real missed shot:** at index.html:8259 the ground-death branch keeps its EXACT retirement timing (`onWhiff` feeds streak, trauma, and the wave-11.1 wall-echo clank stamps — that clock is sacred) but skips `spawnLandRing` when `moonlineVoid()`. Mind the swallow hazard: that line is a dense multi-statement line with a trailing comment — restructure nothing, and re-scan after the edit. Accepted limitation, documented: the visible bullet still winks out at the phantom plane; it is small and distant by then, and moving its death would move gameplay.
- Dojo, Temple, trainer lesson (`moonlineVoid()` false): every branch above is the shipped expression — landing data stays honest where a floor exists.

## 3. Contracts

- Kill-switches raw-boolean-first, flat CFG keys with decision comments: `ringEcho:1` (0 → parcel R fully off, the shipped draw path executes verbatim), `arcVoid:1` (0 → parcel V fully off: shipped `ARC_RAIN_FS` byte-identical, ribbon stops at the phantom floor, rings return). Test each ALONE and combined; construct the surviving mutation for every new test (the wave-11.2 standard: seven constructed, seven killed).
- One clock (`state.t` / the transport-derived beats already in scope); no new allocation in any per-frame path; no new draw calls (the ribbon, rings and canvas are existing objects); shared uniform objects for `uTail`.
- Lane law: the echo's colours come from `WASD_COL[ckey]` exactly as the shipped freeze does — no literal enters.
- GitNexus `impact` before editing `drawWasdLane`, `updateArcPreview`, `updateProjectiles`, `animateArcPulse`, `hideArc`; `computeShotPlan`, `moonlineVoid`, `releaseTargetMesh` untouched.
- Perf: knobs off/on × `?hi`/`?low` (dispatcher measures) — expected delta ≈ 0 (canvas arithmetic + one uniform + the same 30-sample loop over a longer T).

## 4. Playtest questions

At 60 bpm on the summit grid, does a perfect tap now visibly ANSWER you before the next ring demands attention? Does the extended ribbon read as "falling away among the stars" rather than "stretched"? Does anything anywhere still imply a floor in the void?
