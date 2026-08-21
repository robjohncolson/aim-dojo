# The Breath — Season 2, Wave 11.1 (the enfilade exhales, and the walls hear you)

**Version:** 1.0 · 2026-08-21
**Origin:** the user's post-ship questions on wave 11 — *"I'm a little confused at what the function of the mercy arches are… how do we make this even more?"* — answered by making the architecture itself teach mercy. User picked this wave from a five-item menu ("let's do the breath").
**Files touched:** `index.html` (+ regenerated mirrors). No assets, no server.
**Follows:** Wave 11 (`992e75f` + `1d85919` star-of-one + `5c03c63`/`7dfa1a7` the old code). Everything here is a refinement of the shipped Enfilade; nothing else moves.

## 0. What changes, in one breath

Two couplings between the walls and the music/play they stand in. **THE EXHALE:** the tide already breathes — six bars rising, two at peak, one bar of mercy where nothing new arrives — and now the *walls* breathe with it: the last walls before the mercy gap dissolve progressively more, powder creeping inward bar by bar, so the open sky at mercy arrives as the destination of an exhale the player has watched building, not as a jump-cut. **THE ECHO IN THE CHALK:** the current chamber's walls answer the player — a FLAWLESS kill sends a soft ripple of light across the chalk; a clank dims it for half a beat. The rooms hear you.

## 1. Parcel X — THE EXHALE (walls dissolve toward mercy)

- The wall slots already know the mercy bar (`uK[]`, filled by `roadArchFill`). Extend that per-slot channel (widen `uK`'s encoding or add a small parallel uniform array — implementer's choice, same fill site) so each slot carries its **distance-in-bars to the next mercy bar**.
- **The dissolve law:** the wall **2 bars before** mercy renders with its dissolve radius pulled in to ~**60 %** of `wallDissolve` (powder visibly closer to the door); the wall **1 bar before** to ~**30 %** (heavily crumbled, sky bleeding through everywhere but the doorway bay); the mercy span itself stays exactly as shipped (no wall, one bar before through two after). Walls resuming after mercy come back at full solidity — the inhale is instant, only the exhale is gradual (breath out slow, breath in on the downbeat: the tide's own asymmetry).
- Numbers on named consts (`ML_WALL_EXHALE2`, `ML_WALL_EXHALE1` or similar), flat CFG knob `wallExhale` (0 = shipped wave-11 behaviour byte-identical — the raw-boolean-first escape hatch; 1 = full effect; scales the pull-in).
- The powder edge uses the **existing dissolve machinery** — this parcel changes only the per-slot radius input, not the shader's dissolve law. No new noise, no new pass.
- reduceMotion: the exhale is a per-bar STATE, not motion — it applies unchanged (a standing wall two bars out simply stands more dissolved). LOW: applies within the LOW station cap; no extra cost (same shader, different uniform value).

## 2. Parcel E — THE ECHO IN THE CHALK (walls react to play)

- **One uniform pair** on the wall material family (shared objects, as ever): `uWallHit` = the road-clock time (`uNow` units) of the most recent FLAWLESS arrival, `uWallMiss` = of the most recent clank/whiff. Written from the **existing** grade/clank sites (the same places that already fire `showTiming`/trauma — find them via the grade path; do NOT add a new judgement read). Writing a uniform value is the entire CPU cost.
- **The ripple (FLAWLESS):** in the wall fragment shader, a luminance wave sweeping outward across the current chamber's walls from the door region — radius grows with `(uNow − uWallHit)` at ~1 chamber-length per beat, width ~8 m, additive lift capped at ~**+12 %** luminance, fully decayed by **1.5 beats**. Warm-white, never lane-coloured (the cue system owns lane colour).
- **The dim (clank):** a flat multiplicative dip to ~**−10 %** on the current chamber's walls, attack instant, released by the next half-beat. No spatial structure — a wince, not a show.
- Both effects **only on walls within the current chamber ± 1** (the per-slot data from parcel X gives locality for free), so a distant enfilade never flickers with your play.
- Gating: knob `wallEcho` (0 = never compiled into the emitted shader — the `ML_ARCH_RICH` pattern; default 1). reduceMotion: the ripple's *sweep* is motion — under reduceMotion emit the dim and a **static** 1-beat glow (no travelling wave), the established "pulse in place" variant. LOW: dim only, no ripple (fragment cost stays flat).
- **Never gameplay:** these uniforms are written *from* gameplay events but nothing reads them back; the isolation contract style from wave 10 applies (grade/spawn/aim paths gain a write of two floats, nothing more).

## 3. Contracts

- Kill-switches raw-boolean-first: `wallExhale:1`, `wallEcho:1` as flat CFG keys with decision comments; each at 0 restores the shipped wave-11 emission **byte-identically**, alone and combined — extend the frozen-fixture test, and (the lesson of three waves) test each switch **ALONE** and construct the surviving mutation.
- One clock: everything keys off `uNow`/the shared uniform objects. No new clock reads, no per-frame allocation, no second geometry submission, no new draw calls (both parcels are uniform + shader-text changes on existing materials).
- Lane law untouched (no lane colour enters either effect). The half-space audit applies to any new y-term (there should be none).
- Perf: four-variant measurement (`wallExhale`/`wallEcho` off/on, `?hi`+`?low`) — expected delta ≈ 0; flag anything above ~5 %.

## 4. Playtest questions

Does the exhale make mercy legible without a word of text — does a new player *feel* the release coming? Is +12 % ripple visible at 28 bpm without reading as a lightning flash at 60? Does the clank-dim sting exactly enough to be information?
