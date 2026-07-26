# The Star Road — Season 2, Wave 7 (the floor becomes the timeline)

**Version:** 1.0 · 2026-07-26
**Branch:** `redesign/moon-chorus`
**Files touched:** `index.html` (+ regenerated mirror parts per commit). No assets (the road is a shader, like the sky), no server.
**Origin:** user design directive 2026-07-26: reshape the ground into a sky road — Mario Kart star-road flavored — whose colors are the COMING BEATS flowing toward the player: "by the time the color reaches the bottom of the screen is when to click the beat… and this sets up the stage for hold-length information." Racing-game forward motion + the note-lane promoted into the world + a future notation surface, in one structure.
**The worldFloor lesson (2026-07-09, terrain floor reverted same day):** scenery fights the zen. The road survives that veto because it is not scenery — **every pixel encodes timing**. If any part of the road is ever decorative-only, it is wrong.

---

## 0. Parcels

1. **R — THE FORTY FIX**: the WASD press demand doubles at ~40 BPM (diffT tier compression from the sixty cap). Resolution comes from the completed investigation (proven root cause + recommendation); the lane's contract — ONE required key per beat — is restored across the whole 20–60 band.
2. **S — THE STAR ROAD**: the floor becomes a beat-conveyor: a luminous road from the horizon to the player's feet, scrolling one beat-length per beat, its bands pre-announcing the coming beats — required lane colors, the swell's rise, the mercy bar, the fill's gates — with the now-line at the player's feet agreeing exactly with the audio clock.

## 1. Hard constraints

- **THE TREADMILL LAW (absolute):** `PLAYER_POS` never moves; no ballistic, spatial-audio, spawn, or grading quantity changes. The road is painted motion — a river under a still world. State this in the shader block comment and verify by diff (parcel S touches zero gameplay-math sites).
- **Information, never decoration:** every visual element of the road maps to a timing fact (band = beat; band color = required lane; band brightness = tide position; marked band = fill gate; bright wide band = mercy). No stars-for-stars'-sake on the road — the sky above already owns wonder.
- **One clock:** the road renders the SAME transport-derived beat the grading uses, latency-corrected the same way the beat circle is (`audioLat()`), so the band-edge-at-now-line moment IS the audible beat, byte-for-byte the same math. The tap glyph sits mid-band (the "and", `grooveFreezePhase`), the band edge is the "1" — both readable, nothing regraded.
- **Kill-switch:** `CFG.road.on:false` → today's floor, floor-beat flash, and note-lane HUD exactly (raw-boolean-first). With the road ON, the old note-lane HUD and floorBeat flash are hidden (the road subsumes them — two clocks on screen is clutter); the opt-in beat circle (`wasdHud`) is untouched.
- **Post-graduation only this wave** (the trainer keeps its didactic floor; Trainer II — next wave — will teach ON the road).
- **reduceMotion:** no scrolling — the road stands still and the bands PULSE in place at their moments (all information preserved, zero motion). This is a first-class variant, not a degradation.
- **Performance:** ONE plane + ONE shader (the skyDomeMat pattern); the upcoming-beat data reaches the shader as a small uniform array (≤ `road.lookAheadBeats` entries) updated in `onGrid` (per-beat, not per-frame); zero per-frame allocations; LOW-REZ mode respected (flat-shaded fallback like the sky's low path). The old floor mesh/material is hidden, not deleted (kill-switch restores it).
- All inherited wave 1–6 contracts (stream rule for toggles, trainer/temple inertness — the Temple's floor-dissolve is untouched and the road is hidden in the temple — flat CFG with decision comments, zero new text (glyphs are the existing lane glyphs), JA n/a, mirror regen, gitnexus impact, tests green, feasibility/latency math computed not asserted).

## 2. Parcel R — THE FORTY FIX

Implement the investigation's recommended fix (delivered separately; the workflow injects it). Non-negotiable outcome: the required-press cadence is ONE per beat at every BPM 20–60, the lane visual agrees, and whatever old-era tier coupling caused the doubling is either retired with a tombstone comment or moved provably out of the reachable band — per the recommendation. Kill-switch semantics and stream discipline per the toggle rule. Add the crossing math to the fix's comment (the tank lesson: numbers, not adjectives).

## 3. Parcel S — THE STAR ROAD

### Geometry & motion
- A road plane, `road.widthM` (14) wide, running from the player's feet toward the horizon along the player's initial forward axis (the dojo has no locomotion — the road's direction is fixed in world space; the player turns freely above it, like standing on a bridge over a river).
- Scroll: one band-length per beat toward the player (`speed = bandLenM / beatSec` — tempo IS the speed of the world flowing past: the climb to 60 doubles the flow of 30, the racing feel emerging from mastery, free).
- The **now-line**: the road's near edge at the player's feet, latency-corrected; a thin bright rule. A band's leading edge crossing it = the beat, exact to the grading clock.

### The bands (each fact one visual channel)
- **Beat bands:** `road.lookAheadBeats` (8) beats visible ahead. Band base = deep translucent night (the sky palette's floor tones).
- **Required lane color:** each band tinted by its beat's required WASD lane color (the lane's existing colors), with the lane's glyph rendered mid-band (the "and" tap point). This IS the note-lane, in-world, sequenced ahead — the user's core ask.
- **Tide position:** band luminance rides where that beat sits in the swell (rising toward peak); the **mercy bar** renders as one unmistakable wide bright band — you SEE the exhale coming from nine bars out.
- **Fill gates:** when a tank is elected, its figure's gate beats carry an amber edge-mark rolling in — "3, 4, 1" as approaching lights.
- **Hold scaffold (render capability only, NO gameplay):** the band data model supports a `len > 1` sustained band (one color stretched over N beats with a distinct release edge, glyph at the head). Implement the rendering path and prove it with a debug-only CFG flag (`road.holdDemo:false`); no grading, no spawning, no input reads — the notation surface the user asked to stage, staged.
- **Poly pairs' beats** need no special marking — the pair is heard; the road stays about the lane/tide/fill. (Decision: fewer channels, each unmistakable.)

### CFG (flat)
```
road:{ on:true, lookAheadBeats:8, widthM:14, bandGlyphs:true, mercyBoost:1.6, fillMark:true, holdDemo:false }
```

### Acceptance
- `road.on:false` → old floor + lane HUD + floorBeat byte-identical; ON → those surfaces hidden, no double clock.
- The now-line beat moment matches `wasdBeats()`/grading to the millisecond (computed check in a comment: band position formula vs the grading phase formula, same inputs).
- Zero gameplay-math diffs (the treadmill law) — verify by reading every hunk.
- Temple hides the road; trainer unaffected; reduceMotion pulses in place; LOW-REZ ships a cheap path.
- Frame cost: no new per-frame allocations; uniform updates on beat boundaries only.

## 4. Build order & review

R → S sequential (Sonnet verify each, the road verified visually against the clock math), Codex gate, fix rounds to GREEN, push branch. The road lands BEFORE the tuning session — the session should tune the game the player will actually see.

## 5. Playtest questions

- Does the road's flow read as forward motion — and does the tempo-climb's acceleration feel like speed earned?
- Is band-reaches-the-now-line a BETTER tap cue than the old lane HUD was? (It should make the "and" learnable by eye alone.)
- Does seeing the mercy bar nine bars out change how a swell feels?
- Is the road too loud under the sky? (`mercyBoost`, band alpha are the knobs — the sky must stay the star.)
- The hold scaffold: flip `road.holdDemo:true` — does a sustained band read instantly as "press and hold through this"?
