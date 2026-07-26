# Sixty and the Polyrhythm — Season 2, Wave 6 (depth instead of speed)

**Version:** 1.1 · 2026-07-26 (amended in place after the wave-6 review round — every change is marked *1.1 amendment*; see §6 for the log)
**Branch:** `redesign/moon-chorus`
**Files touched:** `index.html` (+ regenerated mirror parts per commit). No assets, no server.
**Origin:** user design directive 2026-07-26: "bpm really shouldn't go any higher than 60 — focus on the polyrhythm night idea instead." The game's skill topology pivots: difficulty stops escalating through tempo and starts escalating through rhythmic complexity. (Tempo Marks is consequently dead — a rank ladder over 20–60 names nothing.)

---

## 0. Parcels

1. **P — THE SIXTY CAP**: `maxBpm` 172 → 60. The `diffT()` law makes this near-total by itself — every skill-scaled system compresses into 20–60 and "the top of the mountain" becomes a real, reachable, sustainable state. P is one constant plus a disciplined audit of everything that assumed the wide range.
2. **Q — POLYRHYTHM PAIRS**: at high skill, at swell peaks, the field occasionally asks a question tempo never could: two Echoes whose beat-quantized flight times sit in 3:2 or 4:3 — landing both on their beats means physically releasing a true polyrhythm. The expert ceiling, built directly on the distance-as-syncopation engine.

## 1. Hard constraints

- All inherited wave 1–5 contracts (kill-switches raw-boolean-first, rnd-stream rules per SPEC_SKY_DEAL v1.2's stream rule, trainer/temple inertness, no new UI/toasts/strings — parcel Q has ZERO text: the existing pitch-encodes-k audio already distinguishes the pair — flat CFG, JA n/a, mirror regen, gitnexus impact, tests green).
- **1.1 amendment (F1) — THE STREAM RULE GOVERNS TOGGLES, NOT CONSTANTS.** 1.0's constraint language promised that P would leave the rnd() stream unchanged below 60. That promise was impossible and is withdrawn: `maxBpm` feeds `diffT()`, `diffT()` feeds `spawnMinDeg` and `projSpeedNow()`, and those feed a rejection loop and a feasible-set test — so a retuned cap changes draw counts at **every** tempo, not just above the old ceiling. Re-mapping the skill curve *is* the feature. The rule, stated correctly: (a) a **toggle** (any `*.on` kill-switch) must restore the pre-switch stream **exactly** — `poly.on:false` obeys this byte for byte, as does `beatSpawn:false` after F5; (b) a **retuned constant** is an ordinary CFG tune, promises only continuity of behaviour plus its **audited consequences**, and is restored exactly by restoring the constant. P's audited consequences are unchanged from 1.0 (the reroll loop's `E[rnd()/spawn]` 2.19 → 2.57 at bpm 60, and the cube-root fallback's extra draw going from 36/11109 grid cells to 0). **No code change** — the misleading comment at `index.html:~944` was rewritten to say this plainly.
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

**1.1 amendment (F2) — THE QUESTION IS ASKED ACROSS TWO BEATS.** 1.0 wrote the pair as a same-beat volley: both members landed on one beat, releases `(k2−k1)/16` apart. Recomputed against the shipped constants, that is 0.125 beat for `[4,6]` — the only ratio the sixty cap leaves drawable — against a `fireQuant` grid of 0.25 beat. It is *legal* (the mechanic is a grid index, and the two ideal releases sit in cells −1 and −2) but with **zero early slack**: the k=4 release sits exactly on the −0.25 cell boundary, so a slightly-early shot falls into its partner's cell and `fire()` silently drops it. The contract therefore moves to **consecutive arrival beats** — one member on beat *B*, the other on *B+1* — which puts the releases 0.875 beat apart for `[4,6]` (0.750 for the wider ratios), three grid cells clear, with a full quarter-beat of slack on each side. Either assignment is legal (long-flight member arriving first is roomier still, 1.125 beat) and **no code changes**: nothing in the engine schedules an arrival beat — an Echo is open on every beat until it expires — so both members spawn in the same slot exactly as before and the player chooses the reading. **The cross-rhythm lives in the releases' off-grid relation and the 2:3 flights, not in a shared beat.** The same-beat volley line remains possible for experts when quantization permits, and the chord-volley system still pays it — as a bonus, not as the contract.

**1.1 amendment (F3) — the pair must be an INTERVAL, so `singDegree` maps by index.** Wave 2's `k → degree` map was linear in k over the full 2..16 list; with the capped feasible set `{2,3,4,6}` it sent k=4 and k=6 to the same degree, making the one drawable ratio a **pitch unison at two release times**. `singDegree` now ranks k inside the **ordered live feasible k-set** (the set `beatSpawnDist` would find at this tempo, reach and night, its LAST-QUARTER retry mirrored) and spreads that index across the degree window from the top down — far = low preserved, distinctness by construction. `CFG.sing.degSpan` is unchanged in value and becomes the **span cap** over the index map; **no new knob**. Verified over the whole live domain (bpm 20..60 × range 11..28 × farMul 1 and 1.3, 109802 cells): the feasible set never exceeds four k's, zero degree collisions, and across the 6530 cells where the pair is drawable (bpm 50..60) k=4 and k=6 are distinct in every one. The trade, stated: a degree now names an orb's **rank in the live vocabulary**, not an absolute k, so the same k can sing a different degree as the shell marches out.

**1.1 amendment (F4) — the poly pin excludes ALL tank election, not just the kind roll.** 1.0 pinned `kind 0` and reasoned that a poly member could never meet a tank. That holds only on the shipped config: with `tank.fillOnly:false` **or** `tide.on:false` the legacy `multiHitChance` roll runs on every plain orb (~56% of pairs catch a member at SENSEI's 0.34), and the tank's distance re-draw — `beatSpawnDist(maxLeadSixteenths)`, which the pin deliberately ignores — would move that member off the lead the ratio chose. Both election paths are now gated on the pairing flag; both rolls are **spent and discarded** (kind stays 0, hp stays 1), so a pinned member's spawn costs exactly what an ordinary one does. Every path that can mutate `kind`/`hp`/`distance` after the pin is enumerated at the site and closed.

**1.1 amendment (F5) — `polyLive()` additionally requires `CFG.beatSpawn`.** With beat-quantized spawns off, `spawnTarget` never calls `beatSpawnDist`, every orb takes the cube-root fallback with `bowK 0`, and a "pair" would be two ordinary Echoes with no ratio and no pin — a nominal pair that also blocks the one-pair-at-a-time gate. The poly path is now never entered; the slot falls through to one ordinary spawn, **stream-silent per the toggle rule**.

- **When:** post-graduation, `poly.on`, `CFG.beatSpawn` (1.1 amendment F5), `diffT() ≥ poly.gate` (0.75 ≈ bpm 50 — the last stretch of the mountain), `tideI` at peak (`≥ poly.tideGate`, 0.9), not during the Bow, not on the deal's Waning-Gibbous pairs night (one field grammar per night — deal pairs are same-beat volley practice; poly pairs are cross-rhythm; they never co-occur). At most one poly pair live at once.
- **What:** with probability `poly.chance` (0.22) at an eligible spawn slot, spawn TWO plain Echoes (kind 0 — reuse the deal-pair spawn machinery's pinning pattern) whose beat-quantized k's are drawn from `poly.ratios` = [[4,6],[8,12],[12,16]] (2:3, 2:3, 3:4). Both fully normal otherwise: star-bound, arrival-judged, volley-eligible.
- **Why this is a polyrhythm (computed, verified against shipped constants — table recomputed under 1.1 amendment F2):** the two orbs' flights are a 2:3 (or 3:4) ratio, and landing each on its own beat means releasing them in a relation that is off every grid the other one uses. Consecutive-beat contract, releases relative to the first arrival beat *B*:

  | ratio | bpm | flights (s) | distances (m) | releases (consecutive beats) | gap | fireQuant cells |
  |---|---|---|---|---|---|---|
  | [4,6] | 50 | 0.300 / 0.450 | 18.29 / 27.40 | B−0.250, B+0.625 | 0.875 beat (1050 ms) | −1, +2 — PASS |
  | [4,6] | 60 | 0.250 / 0.375 | 17.99 / 26.98 | B−0.250, B+0.625 | 0.875 beat (875 ms) | −1, +2 — PASS |
  | [8,12] | 50 / 60 | 0.600/0.900 · 0.500/0.750 | 36.49/54.52 · 35.94/53.81 | B−0.500, B+0.250 | 0.750 beat (900 / 750 ms) | −2, +1 — PASS |
  | [12,16] | 50 / 60 | 0.900/1.200 · 0.750/1.000 | 54.52/72.29 · 53.81/71.55 | B−0.750, B+0.000 | 0.750 beat (900 / 750 ms) | −3, 0 — PASS |

  Long-flight-first is the same table shifted one beat: 1.125 beat for `[4,6]`, 1.250 for the others, 4–5 cells apart. Same-beat (the demoted 1.0 reading): `[4,6]` 0.125 beat, cells −1/−2, legal with zero early slack on k=4; `[8,12]`/`[12,16]` 0.250 beat, cells 2 and 3 apart, comfortable. Feasibility is unchanged from 1.0: under the cap only `[4,6]` is ever drawable (k=12 needs 53.8 m and k=16 71.6 m against `rangeMax` 28; k=8 speaks only on a LAST QUARTER, where its partner does not), and an infeasible ratio is silently never drawn — like the star fallback.
- **Audio:** no new sound, but one map corrected — see 1.1 amendment F3. Pitch-encodes-k voices the two calls, and after the index map they are genuinely different degrees (a step on a plain night, a third on a LAST QUARTER) instead of the unison the linear map produced. If both land, the chord-volley system (same-beat case) or consecutive-beat landings pay off as they already do.
- **Stream:** the poly roll consumes draws only when the gate is live (documented per the stream rule). Both pinned rolls — kind, and the legacy tank pair (1.1 amendment F4) — are spent and discarded, so a member costs exactly what an ordinary spawn costs.
- **Kill-switch:** `poly.on:false` → byte-identical spawns and stream. `beatSpawn:false` likewise (1.1 amendment F5).

### CFG (flat)
```
poly:{ on:true, gate:0.75, tideGate:0.9, chance:0.22, ratios:[[4,6],[8,12],[12,16]] }
```

### Acceptance
- Below the gate or off-peak: zero poly draws, stream identical.
- Pair members are kind 0, star-bindable, and never elected as **any** tank — fill or legacy — at any `tank.fillOnly` / `tide.on` combination (1.1 amendment F4).
- The pairs-night deal suppresses poly for that night (verified at the gate).
- Both members' k's always feasible at spawn (no unreachable calls, the tank lesson applied).
- The two members always sing **different** PENTA degrees wherever the pair can be drawn (1.1 amendment F3).
- With `beatSpawn:false` the parcel is silent and spends nothing (1.1 amendment F5).

## 4. Build order & review

P → Q sequential (Sonnet verify each), Codex gate, fix rounds to GREEN, push branch. THEN the user's tuning session (deliberately after this wave — the cap changes the feel of everything, so tuning before it would be wasted).

## 5. Playtest questions

- P: does 60 feel like a summit (sustainable full-engagement) or a wall? The pre-flagged tuning knobs: `grooveOpenSec[1]` (expert window), `projSpeedFast` (arc flatness at cap), `bpmUp` (climb rate over the shorter mountain).
- Q: when a poly pair calls, do you HEAR it as a question before you see it? Does landing both feel like the new "I did the impossible" — the role the old 172 climb was supposed to play?
- Q: `poly.chance` — rare enough to stay an event, common enough to train?
- Q (new, 1.1): the pair now spans two beats by contract. Does the two-beat reading *feel* like the question, or does the ear still want both inside one beat?

## 6. Amendment log — 1.1 (wave-6 fix round, 2026-07-26)

| # | Severity | Finding | Resolution | Where |
|---|---|---|---|---|
| F1 | HIGH | 1.0 promised stream identity below 60; the cap changes `diffT()` and therefore draw counts at every tempo | Contract correction, **no code change**: the stream rule governs toggles; a retuned constant promises continuity + audited consequences | §1 · comment `index.html:~944` |
| F2 | HIGH | `[4,6]`'s same-beat releases are 0.125 beat apart against a 0.25-beat `fireQuant` grid — zero early slack on k=4, so slightly-early releases are dropped | Arrivals move to **consecutive beats** (0.875 beat apart, 3 grid cells clear); same-beat stays as an expert bonus. **No code change** — the engine never scheduled an arrival beat | §3 + recomputed table · comment `index.html:~1065` |
| F3 | MEDIUM | With the capped set `{2,3,4,6}`, `singDegree` sent k=4 and k=6 to the same degree — the pair was a pitch unison | `singDegree` ranks k in the **ordered live feasible set** and spreads the index over `degSpan` (now the span cap). Verified 0 collisions / 0 unisons over the live domain | §3 · `singDegree`/`singRank`, `index.html:~4710` |
| F4 | HIGH | Under `tank.fillOnly:false` or `tide.on:false` the legacy `multiHitChance` roll could turn a pinned member into a tank and re-draw its distance | The pin excludes **all** tank election; both rolls spent and discarded; every post-pin mutation path enumerated and gated | §3, Acceptance · `spawnTarget`, `index.html:~6055` |
| F5 | MEDIUM | With `CFG.beatSpawn:false` a pair had no k's and no ratio — a nominal pair spending real draws | `polyLive()` requires `CFG.beatSpawn`; the slot falls through to one ordinary spawn, stream-silent | §3 · `polyLive`, `index.html:~5980` |
| polish | — | `rhythmLevel()`'s 90/115/140 tiers were 172-era and unreachable under the cap (0 callers) | Deleted, with the reason at the site. `server/server.js`'s `peak_bpm > 180` bound and `supabase-dojo.sql`'s "engine max 172" comment are **out of parcel** and deliberately untouched (stored legacy rows must still validate) | `index.html:~4752` |
