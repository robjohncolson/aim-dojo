# The Star Road â€” Season 2, Wave 7 (the floor becomes the timeline)

**Version:** 1.0 Â· 2026-07-26
**Branch:** `redesign/moon-chorus`
**Files touched:** `index.html` (+ regenerated mirror parts per commit). No assets (the road is a shader, like the sky), no server.
**Origin:** user design directive 2026-07-26: reshape the ground into a sky road â€” Mario Kart star-road flavored â€” whose colors are the COMING BEATS flowing toward the player: "by the time the color reaches the bottom of the screen is when to click the beatâ€¦ and this sets up the stage for hold-length information." Racing-game forward motion + the note-lane promoted into the world + a future notation surface, in one structure.
**The worldFloor lesson (2026-07-09, terrain floor reverted same day):** scenery fights the zen. The road survives that veto because it is not scenery â€” **every pixel encodes timing**. If any part of the road is ever decorative-only, it is wrong.

---

## 0. Parcels

1. **R â€” THE FORTY FIX**: the WASD press demand doubles at ~40 BPM (diffT tier compression from the sixty cap). Resolution comes from the completed investigation (proven root cause + recommendation); the lane's contract â€” ONE required key per beat â€” is restored across the whole 20â€“60 band.
2. **S â€” THE STAR ROAD**: the floor becomes a beat-conveyor: a luminous road from the horizon to the player's feet, scrolling one beat-length per beat, its bands pre-announcing the coming beats â€” required lane colors, the swell's rise, the mercy bar, the fill's gates â€” with the now-line at the player's feet agreeing exactly with the audio clock.

## 1. Hard constraints

- **THE TREADMILL LAW (absolute):** `PLAYER_POS` never moves; no ballistic, spatial-audio, spawn, or grading quantity changes. The road is painted motion â€” a river under a still world. State this in the shader block comment and verify by diff (parcel S touches zero gameplay-math sites).
- **Information, never decoration:** every visual element of the road maps to a timing fact (band = beat; band color = required lane; band brightness = tide position; marked band = fill gate; bright wide band = mercy). No stars-for-stars'-sake on the road â€” the sky above already owns wonder.
- **One clock:** the road renders the SAME transport-derived beat the grading uses, latency-corrected the same way the beat circle is (`audioLat()`), so the band-edge-at-now-line moment IS the audible beat, byte-for-byte the same math. The tap glyph sits mid-band (the "and", `grooveFreezePhase`), the band edge is the "1" â€” both readable, nothing regraded.
- **Kill-switch:** `CFG.road.on:false` â†’ today's floor, floor-beat flash, and note-lane HUD exactly (raw-boolean-first). With the road ON, the old note-lane HUD and floorBeat flash are hidden (the road subsumes them â€” two clocks on screen is clutter); the opt-in beat circle (`wasdHud`) is untouched.
- **Post-graduation only this wave** (the trainer keeps its didactic floor; Trainer II â€” next wave â€” will teach ON the road).
- **reduceMotion:** no scrolling â€” the road stands still and the bands PULSE in place at their moments (all information preserved, zero motion). This is a first-class variant, not a degradation.
- **Performance:** ONE plane + ONE shader (the skyDomeMat pattern); the upcoming-beat data reaches the shader as a small uniform array (â‰¤ `road.lookAheadBeats` entries) updated in `onGrid` (per-beat, not per-frame); zero per-frame allocations; LOW-REZ mode respected (flat-shaded fallback like the sky's low path). The old floor mesh/material is hidden, not deleted (kill-switch restores it).
- All inherited wave 1â€“6 contracts (stream rule for toggles, trainer/temple inertness â€” the Temple's floor-dissolve is untouched and the road is hidden in the temple â€” flat CFG with decision comments, zero new text (glyphs are the existing lane glyphs), JA n/a, mirror regen, gitnexus impact, tests green, feasibility/latency math computed not asserted).

## 2. Parcel R â€” THE FORTY FIX

**1.1: resolution decided from the completed investigation (proven).** Root cause: the lane's note density `nd = max(1, spb/2)` is derived from the ORB-STROBE tier (`beatQuantT [0.40,0.75]`) at six duplicated sites (index.html:1334, 6318, 6708, 6864, 7065, 7328) â€” an intentional 2026-06-23 design ("no separate difficulty system") built when those tiers sat at bpm 80.8/134.0; the sixty cap moved them to 36.0/50.0, the added notes land on the RAW DOWNBEAT (colliding with shot arrival), and missing them pins `_wasdCombo` at 0 (forfeiting field damping and the groove tier). The fix is the investigator's Option A + Option D combined:

- **A â€” decouple:** new `CFG.wasdNoteDivs:[2,4,8]` + `CFG.wasdNoteT:[0.75,1.01]` and one pure helper `wasdNoteDiv()`; the six inline computations all call it. The ORB STROBE keeps parcel P's audited 36/50 deepening untouched; the LANE is one-per-beat across bpm 20â€“50 and reaches at most 2/beat in the 50â€“60 summit, never 4 (240 presses/min is a mash test, not a rhythm game).
- **D â€” de-coerce the summit:** in the 50â€“60 band the in-between notes render as DIM GHOSTS and are claimable for `_wasdCombo` credit, but only MAINS can break the combo (`animate`'s `_wasdCombo=0` gates on `_curMain`). Pressing once per beat remains fully valid at every tempo; the bonus notes are an invitation, never a demand. (This also revives the combo/FLOCK system honestly â€” under the old cap its food supply only existed above bpm 80.8, so it was effectively unreachable anyway.)
- The `syncWasdResolutionGrid` / `updatePocketMisses` CRITICAL flags from impact analysis are dead-path (groovePocket permanently false) â€” verify, don't fear them. The crossing math (36.0/50.0, the 33-rung ladder) goes in the helper's comment.

## 3. Parcel S â€” THE STAR ROAD

### Geometry & motion â€” **1.1: the four design decisions (user-locked 2026-07-26)**

1. **NIGHT-SEEDED COURSE.** The course's shape â€” its curvature profile over time â€” is a deterministic function of the local date + the ephemeris the deal already reads (same seed authority, no new sources). Everyone under tonight's sky rides the same river; tomorrow's is new because the sky moved. Endless (generated ahead as needed), never chosen, never repeating within a night's practical play.
2. **THE COURSE FLOWS THROUGH YOU.** The road is a full RIBBON, not a forward plane: it curves in from the horizon ahead, passes under your feet at the now-line, and recedes behind you to the horizon. Turn around mid-run and the road is there, going away. The ribbon is a centerline curve (the course function) swept to `road.widthM`; the scroll advances the course parameter one band-length per beat (`speed = bandLenM/beatSec` â€” tempo IS flow speed; the climb to 60 doubles the flow of 30, racing feel earned by mastery, free).
3. **COURSE-DRIVEN BANKING = THE TRACKING DRILL.** When `road.on` (post-graduation), the dolly's noise wander is REPLACED by the course: camera bank (roll) and drift (yaw) follow the curvature at the now-line, applied at the existing dolly site with the existing strength/ramp laws (`dollyStrength`, skill ramp, reduceMotionâ†’off all inherited). You counter-steer the river's bends â€” and unlike the old noise, the bend is READABLE eight beats ahead on the road. Curvature intensity scales with the existing dolly skill ramp; the night seed sets the SHAPE (where it bends), skill sets how hard it leans. `road.on:false` â†’ the noise dolly returns exactly.
4. **THE WAKE.** Behind the now-line, passed bands carry your performance: a band whose beat you landed stays lit in its lane color; a missed beat's band goes dark. The wake persists to the visible horizon (a small ring buffer of past-beat results â€” the run's recent history, not the whole session). Turning around shows you your run. reduceMotion: the wake renders identically (it's static history â€” no motion involved).

- The **now-line**: the road's under-feet crossing, latency-corrected; a thin bright rule. A band's leading edge crossing it = the beat, exact to the grading clock.

### The bands (each fact one visual channel)
- **Beat bands:** `road.lookAheadBeats` (8) beats visible ahead. Band base = deep translucent night (the sky palette's floor tones).
- **Required lane color:** each band tinted by its beat's required WASD lane color (the lane's existing colors), with the lane's glyph rendered mid-band (the "and" tap point). This IS the note-lane, in-world, sequenced ahead â€” the user's core ask.
- **Tide position:** band luminance rides where that beat sits in the swell (rising toward peak); the **mercy bar** renders as one unmistakable wide bright band â€” you SEE the exhale coming from nine bars out.
- **Fill gates:** when a tank is elected, its figure's gate beats carry an amber edge-mark rolling in â€” "3, 4, 1" as approaching lights.
- **Hold scaffold (render capability only, NO gameplay):** the band data model supports a `len > 1` sustained band (one color stretched over N beats with a distinct release edge, glyph at the head). Implement the rendering path and prove it with a debug-only CFG flag (`road.holdDemo:false`); no grading, no spawning, no input reads â€” the notation surface the user asked to stage, staged.
- **Poly pairs' beats** need no special marking â€” the pair is heard; the road stays about the lane/tide/fill. (Decision: fewer channels, each unmistakable.)

### CFG (flat)
```
road:{ on:true, lookAheadBeats:8, widthM:14, bandGlyphs:true, mercyBoost:1.6, fillMark:true, holdDemo:false }
```

### Acceptance
- `road.on:false` â†’ old floor + lane HUD + floorBeat byte-identical; ON â†’ those surfaces hidden, no double clock.
- The now-line beat moment matches `wasdBeats()`/grading to the millisecond (computed check in a comment: band position formula vs the grading phase formula, same inputs).
- Zero gameplay-math diffs (the treadmill law) â€” verify by reading every hunk.
- Temple hides the road; trainer unaffected; reduceMotion pulses in place; LOW-REZ ships a cheap path.
- Frame cost: no new per-frame allocations; uniform updates on beat boundaries only.

## 4. Build order & review

R â†’ S sequential (Sonnet verify each, the road verified visually against the clock math), Codex gate, fix rounds to GREEN, push branch. The road lands BEFORE the tuning session â€” the session should tune the game the player will actually see.

## 5. Playtest questions

- Does the road's flow read as forward motion â€” and does the tempo-climb's acceleration feel like speed earned?
- Is band-reaches-the-now-line a BETTER tap cue than the old lane HUD was? (It should make the "and" learnable by eye alone.)
- Does seeing the mercy bar nine bars out change how a swell feels?
- Is the road too loud under the sky? (`mercyBoost`, band alpha are the knobs â€” the sky must stay the star.)
- The hold scaffold: flip `road.holdDemo:true` â€” does a sustained band read instantly as "press and hold through this"?


