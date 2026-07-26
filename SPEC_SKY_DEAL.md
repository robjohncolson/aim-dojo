# The Sky Deals the Night · Sensei's One Question — Redesign Wave 4 (finale)

**Version:** 1.0 · 2026-07-25
**Branch:** `redesign/moon-chorus` (waves 1-3 merged; merge to `main` after user playtest)
**Files touched:** `index.html` (+ regenerated `tools/index-inline.mirror.part<N>.js` per commit). No assets, no build, no server.
**Origin:** 2026-07-24 redesign panel — "The Sky Deals the Night" (retention judge: the only external habit trigger — the crescent you see from your car IS the push notification) + "Sensei's One Question" (training judge's #1: the only closed-loop deliberate-practice engine proposed; retention judge top-3: being-noticed).

---

## 0. Product intent

Two parcels that close the panel's blueprint:

1. **K — THE SKY DEALS THE NIGHT**: the real moon phase sets tonight's ONE rule; the actually-risen planets tilt the orb mix; Moon Sensei names the whole deal in a single line at the threshold. Nothing to configure — the sky already chose.
2. **L — SENSEI'S ONE QUESTION**: the Bow's line becomes a diagnosis when the game has actually noticed something — "your links land early when the Echo is far" — and tomorrow's opening swells silently drill the weakness. Observation, never grade.

## 1. Hard constraints

- **One rule per night, never stacked** (NecroDancer discipline). If a rule needs explanation text beyond its one Sensei line, it is the wrong rule.
- **Text budget (judges' synthesis, enforced in code):** exactly ONE line at the threshold (the deal) and ONE at the Bow (diagnosis > tomorrow-sky fact — the diagnosis replaces the fact, never joins it). No other new text. All new strings through `T()` with `window.JA` keys (this wave HAS strings — full JA coverage required, matching SPEC_MOON_CHORUS_UI mechanism and tone).
- **Deterministic and fail-open:** the deal derives from local date + ephemeris already in the client (Meeus sun/moon always; `_publicSkyPack` movers when valid). No network dependency: API absent → phase rule still deals (Meeus), planet mix falls back to today's neutral weights. Same night + same sky = same deal.
- **rnd() stream discipline:** the deal changes WEIGHTS/THRESHOLDS read by existing rolls (set once at `resetSession`), never the number or order of draws. `deal.on:false` → byte-identical behavior AND stream.
- **Kill-switches:** `CFG.deal.on`, `CFG.sensei.on` — raw-boolean-first at call sites, house style. All wave 1-3 constraints inherit (rhythm-safe, trainer/temple inert — both parcels post-graduation only, no new UI surfaces, flat CFG literals, mirror regen per commit — NOTE: the mirror is now `tools/index-inline.mirror.part<N>.js` parts, `node tools/extract-inline.mjs` handles it — gitnexus impact before edits, tests 133/133).
- **No dark patterns:** the deal line never says what you missed, never counts down, never references yesterday. The diagnosis is an observation with a cooldown — never the same diagnosis two nights running (fall back to the sky fact and keep weighting silently).

## 2. Parcel K — THE SKY DEALS THE NIGHT

### The deal, computed once per run (at `resetSession`, post-graduation)
- **Moon phase** from Meeus sun/moon ecliptic longitudes (elongation → 8 equal buckets). **Planet mix** from `_publicSkyPack` movers' current altitude (> `deal.planetAltDeg`, computed with the existing transform); pack absent/stale → neutral mix.
- The deal writes a small set of effective values (never mutating base CFG — mirror the SENSEI_PACK pattern: compute effective values into a `_deal` object read at the existing sites).

### The eight phase rules (one active; names are Sensei-line fragments, EN + JA)
| Phase | Rule name | Mechanical meaning (existing knobs only) |
|---|---|---|
| New Moon | *the dark listens* | localization night: spawn spread widens (yaw spread ×`dealSpreadMul`, more behind-you bearings) |
| Waxing Crescent | *the wind stirs* | the shipped wind system deals ON, gentle (windMin..windMax ×`dealWindMul`), seeded from the date — clouds + ballistics + HUD as built |
| First Quarter | *the quick ones wake* | speed-orb chance ×`dealQuickMul`; orb life ×`dealQuickLifeMul` (slightly brisker field) |
| Waxing Gibbous | *the wind remembers* | wind ON, fuller strength; mover chance ×`dealMoverMul` |
| Full Moon | *the full chorus* | the generous night: density ×`dealFullDensityMul`, gold chance ×`dealFullGoldMul`, mercy-bar chorus swell ×`dealFullMercyMul`, tank always eligible |
| Waning Gibbous | *the echoes answer in pairs* | paired spawns: when the scheduler spawns, with probability `dealPairChance` it immediately schedules a companion at a distance sharing a landable arrival beat (chord-volley practice, using the existing beat-quantized distance math; still normal orbs, no new kind) |
| Last Quarter | *the far ones call* | long-lead night: spawn distance band biased far (range floor/ceiling ×`dealFarMul`), gold farther |
| Waning Crescent | *the drum rests* | the quiet night: density ×`dealQuietDensityMul` (sparser), quiet-tick riseK ×`dealQuietTickMul` (silence comes sooner), BPM ramp gentler (`bpmUp` ×`dealQuietBpmMul`) |

Planet tilt stacks ON TOP of the phase rule but only as kind weights (Venus risen → gold ×`dealVenusMul`; Mercury → speed ×; Mars → mover ×; Saturn → tank eligibility as today's rules allow; Jupiter → +1 `patternConcurrency` cap nudge). Weights only — a planet never adds a second RULE.

### The threshold line
One line at run start (post-graduation), riding the existing theme-flash moment (`dojoFlash` / `showGhostToast` — pick the one that reads best with the existing chrome, do not add a surface): `✦ <PHASE RULE NAME> · <planet fragment if any> ` — e.g. "✦ WAXING GIBBOUS · MARS IS UP · THE WIND REMEMBERS". JA equivalents for every fragment. If `sensei.on` produced a comeback/diagnosis... no — the threshold line is ALWAYS the deal line (parcel L owns only the Bow line).

### CFG (flat)
```
deal:{ on:true, planetAltDeg:5, spreadMul:1.5, windMul:0.7, quickMul:2.2, quickLifeMul:0.85,
       moverMul:1.8, fullDensityMul:1.2, fullGoldMul:1.8, fullMercyMul:1.3, pairChance:0.35,
       farMul:1.3, quietDensityMul:0.8, quietTickMul:1.6, quietBpmMul:0.6,
       venusMul:1.8, mercuryMul:1.8, marsMul:1.8, jupiterConc:1 }
```

### Acceptance
- `deal.on:false` → byte-identical behavior and rnd stream; no `_deal` reads anywhere hot.
- Exactly one rule active per night; the line names it; nothing else announces anything.
- API-less load: phase rule deals from Meeus alone; planet fragment simply absent from the line.
- Paired spawns (Waning Gibbous) preserve all distance/timing laws — the companion is a normal beat-quantized spawn whose k is chosen so both share a landable beat; draw-count changes are confined to that phase's nights (document the stream implication in the CFG comment — acceptable because free-play has no shared seed).
- Wind deals only on the two waxing phases; `?wind` opt-in behavior for other nights unchanged.

## 3. Parcel L — SENSEI'S ONE QUESTION

### Telemetry (run-local, then persisted)
Per scoring arrival, the game already knows signed error ms and k (wave-1 Bow ledger `_bowHits`). Bin by lead: NEAR (k ≤ 4), MID (5-8), FAR (≥ 9). At the Bow (session boundary), compute per-bin mean signed error and count. A **diagnosis** exists when some bin has `n ≥ sensei.minSamples` and `|mean| ≥ sensei.biasMs` (pick the worst such bin).

### The Bow line (priority: diagnosis > sky fact)
When a diagnosis exists AND it differs from the previous stored diagnosis (bin+direction), the Bow's one line is the observation instead of the sky fact: e.g. EARLY+FAR → "your links reach the far ones early — let them breathe" (write ~6 template pairs: {early,late} × {near,mid,far}, EN + JA, observation-toned per the story voice, never a number, never a grade). Same diagnosis as last time → show the sky fact instead (silent weighting continues). No diagnosis → sky fact as today.

### Tomorrow's opening drills it (silently)
Persist `localStorage['aimdojo.sensei'] = {v:1, day, bin, dir, n}`. At `resetSession`, if fresh (< `sensei.freshHours`), the FIRST `sensei.weightSwells` tide swells bias the beat-quantized k selection toward the weak bin (weight the existing feasible-k choice — same draws, shifted weights; the law "distance = k sixteenths" untouched). Never announced, never visible. Expires silently.

### CFG (flat)
```
sensei:{ on:true, minSamples:8, biasMs:25, freshHours:48, weightSwells:2, weightMul:2.5 }
```

### Acceptance
- `sensei.on:false` → no telemetry persisted, Bow line always the sky fact, no spawn weighting.
- The Bow still shows exactly ONE line; the diagnosis never stacks with the fact.
- Weighting alters k-choice WEIGHTS only (draw count/order unchanged); trainer/temple/pre-graduation untouched.
- Repeat-diagnosis cooldown works (same bin+dir two sessions running → fact shown, weighting continues).
- Corrupt/missing `aimdojo.sensei` degrades silently.

## 4. Build order & review

Sequential K → L (one commit each, Sonnet verify between, gitnexus impact before edits), then Codex read-only review, fix rounds to GREEN, push branch for user playtest. All magnitudes are first guesses — tuned by ear/eye after play.

## 5. Playtest questions (post-build)

- K: does the one-line deal read instantly ("ah, windy Mars night") or does it need the HELP tab? Do dealt nights FEEL different at the current multipliers?
- K: pairs night — did you find yourself firing volleys on purpose?
- L: did Sensei's first observation land as "the game noticed me" or as nagging? Is the silent next-morning drill perceptible (it shouldn't be)?
- The finale question: after a week under the dealt sky, does checking the actual moon on the drive home change whether you play?
