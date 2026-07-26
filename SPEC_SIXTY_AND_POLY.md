# Sixty and the Polyrhythm — Season 2, Wave 6 (depth instead of speed)

**Version:** 1.0 · 2026-07-26
**Branch:** `redesign/moon-chorus`
**Files touched:** `index.html` (+ regenerated mirror parts per commit). No assets, no server.
**Origin:** user design directive 2026-07-26: "bpm really shouldn't go any higher than 60 — focus on the polyrhythm night idea instead." The game's skill topology pivots: difficulty stops escalating through tempo and starts escalating through rhythmic complexity. (Tempo Marks is consequently dead — a rank ladder over 20–60 names nothing.)

---

## 0. Parcels

1. **P — THE SIXTY CAP**: `maxBpm` 172 → 60. The `diffT()` law makes this near-total by itself — every skill-scaled system compresses into 20–60 and "the top of the mountain" becomes a real, reachable, sustainable state. P is one constant plus a disciplined audit of everything that assumed the wide range.
2. **Q — POLYRHYTHM PAIRS**: at high skill, at swell peaks, the field occasionally asks a question tempo never could: two Echoes whose beat-quantized flight times sit in 3:2 or 4:3 — landing both on their beats means physically releasing a true polyrhythm. The expert ceiling, built directly on the distance-as-syncopation engine.

## 1. Hard constraints

- All inherited wave 1–5 contracts (kill-switches raw-boolean-first, rnd-stream rules per SPEC_SKY_DEAL v1.2's stream rule, trainer/temple inertness, no new UI/toasts/strings — parcel Q has ZERO text: the existing pitch-encodes-k audio already distinguishes the pair — flat CFG, JA n/a, mirror regen, gitnexus impact, tests green).
- **Feasibility math at design time** (the tank lesson): parcel Q's spec includes computed release/arrival timelines; the implementer re-verifies with the shipped constants before committing.
- Records are history: the dojo board's legacy >60 peak-BPM rows persist untouched; new runs simply cap.

## 2. Parcel P — THE SIXTY CAP

### The change
`CFG.maxBpm: 172 → 60` (minBpm/startBpm stay 20; the sacred dead-slow ramp is untouched).

### The audit (each item gets a decision comment at its site)
- `diffT()` (index.html:~5881): unchanged — now spans 20→60. Consequence stated in its comment: expert scaling (tightest `grooveOpenSec[1]`, `projSpeedFast`, deepest `beatQuantDivs`, full dolly) is reached AT the cap. This is intended: 60 is full mastery.
- `projSpeedNow()` / `projSpeedFast`: keep the lerp endpoints for now — at the cap the arc plays at full speed, which is the defined expert state. FLAG for the tuning session (with `grooveOpenSec[1]` and top-k feasibility) in the spec's playtest section; do not pre-tune.
- `tank.maxBpm: 150 → 60` (self-documenting; the gate is now "always, under the cap" and says so).
- `quietTick.minBpm:40`: unchanged — tiers now live in the 40–60 band; comment updated.
- `beatSpawnSixteenths` top entries (k=12,16): verify feasibility at 60 BPM against `rangeMax` with the real solver — infeasible k's already drop out naturally; state the surviving expert k-set in the CFG comment.
- Adaptive law (`upThreshold`/`bpmUp`/tide boundary steps): unchanged — the climb just tops out sooner. Sensei trainer pack: unchanged.
- Grep for any other literal that encodes the old ceiling (172, tier math, HELP text does not mention BPM numbers — verify) and resolve each with a comment.

### Acceptance
- No run can exceed 60; `state.maxBpm` bookkeeping intact; legacy records render untouched.
- All diffT consumers behave continuously (no seams at the new cap).
- The deal's quick night, wind nights, fill election, chorus, Bow: all verified live-correct at exactly 60.

## 3. Parcel Q — POLYRHYTHM PAIRS

### Design
- **When:** post-graduation, `poly.on`, `diffT() ≥ poly.gate` (0.75 ≈ bpm 50 — the last stretch of the mountain), `tideI` at peak (`≥ poly.tideGate`, 0.9), not during the Bow, not on the deal's Waning-Gibbous pairs night (one field grammar per night — deal pairs are same-beat volley practice; poly pairs are cross-rhythm; they never co-occur). At most one poly pair live at once.
- **What:** with probability `poly.chance` (0.22) at an eligible spawn slot, spawn TWO plain Echoes (kind 0 — reuse the deal-pair spawn machinery's pinning pattern) whose beat-quantized k's are drawn from `poly.ratios` = [[4,6],[8,12],[12,16]] (2:3, 2:3, 3:4). Both fully normal otherwise: star-bound, arrival-judged, volley-eligible.
- **Why this is a polyrhythm (computed, verify against shipped constants):** both orbs' arrivals sit on legal subdivisions of the SAME target beat window family, but their release times differ by (k2−k1)/16 beats — e.g. [8,12] at 60 BPM: releases 1 beat apart landing 1 beat apart on a 2:3 flight-ratio; chaining pairs trains the hands to subdivide against each other. The implementer must produce the release/arrival timeline table for all three ratios at bpm 50 and 60 and confirm every release lands ≥ `fireQuant` spacing apart and every arrival is within feasible range (`beatSpawnDist` non-null for both k's at those BPMs; if a ratio's larger k is infeasible at the live range, that ratio simply isn't drawn — silent, like the star fallback).
- **Audio:** nothing new. Pitch-encodes-k (wave 2) already voices the two calls at different degrees — the pair is HEARD as an interval. If both land, the chord-volley system (same-beat case) or consecutive-beat landings pay off as they already do.
- **Stream:** the poly roll consumes draws only when the gate is live (documented per the stream rule).
- **Kill-switch:** `poly.on:false` → byte-identical spawns and stream.

### CFG (flat)
```
poly:{ on:true, gate:0.75, tideGate:0.9, chance:0.22, ratios:[[4,6],[8,12],[12,16]] }
```

### Acceptance
- Below the gate or off-peak: zero poly draws, stream identical.
- Pair members are kind 0, star-bindable, and never elected as the fill tank (one primary grammar per orb).
- The pairs-night deal suppresses poly for that night (verified at the gate).
- Both members' k's always feasible at spawn (no unreachable calls, the tank lesson applied).

## 4. Build order & review

P → Q sequential (Sonnet verify each), Codex gate, fix rounds to GREEN, push branch. THEN the user's tuning session (deliberately after this wave — the cap changes the feel of everything, so tuning before it would be wasted).

## 5. Playtest questions

- P: does 60 feel like a summit (sustainable full-engagement) or a wall? The pre-flagged tuning knobs: `grooveOpenSec[1]` (expert window), `projSpeedFast` (arc flatness at cap), `bpmUp` (climb rate over the shorter mountain).
- Q: when a poly pair calls, do you HEAR it as a question before you see it? Does landing both feel like the new "I did the impossible" — the role the old 172 climb was supposed to play?
- Q: `poly.chance` — rare enough to stay an event, common enough to train?
