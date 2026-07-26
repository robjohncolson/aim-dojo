# The Sky Deals the Night · Sensei's One Question — Redesign Wave 4 (finale)

**Version:** 1.0 · 2026-07-25 · **1.1 amendments** 2026-07-25 (wave-4 review round — marked inline as *1.1 amendment*) · **1.2 amendments** 2026-07-25 (wave-4 review round 2 — marked inline as *1.2 amendment*)
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

  > **1.1 amendment — the stream rule, stated generally.** The discipline's purpose is **kill-switch equivalence**, not stream-freezing, and it now reads as three rules instead of one:
  > 1. **`deal.on:false` is absolute** — byte-identical behaviour AND rnd() stream versus wave 3, with no exception, ever. This is the only invariant the parcel actually owes anyone.
  > 2. **An ACTIVE phase rule MAY alter draw count or order on its own nights.** Free-play has no shared seed (the seeded daily was retired) and no downstream invariant reads the stream, so a night that plays differently is allowed to draw differently. Two rules use this licence: the **New Moon's** widened spawn cone (a wider minimum-angle rejects more rolled directions, so the reroll loop runs more often) and the **Waning Gibbous's** pairs (a roll of its own plus a whole companion spawn). Neither is reachable on any other night. Contorting the code to keep them draw-neutral — pinning the reroll loop to a fixed iteration count, or rotating a rejected direction instead of rerolling it — would rewrite the shipped spawn direction for *every* night, which is a far larger change than the rule is worth.
  > 3. **The planet tilt is strictly weights-only, on every night.** A risen planet may move a threshold an existing roll compares against and nothing else. A planet is never a second rule and never a draw.

  > **1.2 amendment — rule 3 was stated but not kept: two planets were moving GATES.** A *threshold* is a number a roll compares against; a *gate* is the condition that decides whether the roll is taken at all. Jupiter's `+1 patternConcurrency` and Saturn's `tankAny` were gates, so on a beat where the neutral path took no roll, a risen planet took one — a planet acting as a draw. Both are re-cut onto rolls that are spent either way:
  > - **Jupiter → `jupiterDensMul` (1.15).** It multiplies the density probability `p` that the *existing* spawn roll already compares against. Verified at the site: the concurrency gate is now free of every `_deal` read, and once it and the `i%2===0` eligibility pass, `rnd()` is spent unconditionally.
  > - **Saturn → `saturnFillMul` (1.6).** Within the conditions the night has *already* opened (BPM ≤ `tank.maxBpm`, a live fill-only election, `multiHit`, `_specialLive`, `kind===0`), it multiplies the fill's own 3-vs-2 figure threshold (`0.5`, clamped at 1) so the heavy one leans the fill toward the three-note figure. Verified at the site: that roll is unconditional once the gate passes and both of its branches fall straight through, so it costs exactly one draw either way. **Above `tank.maxBpm` there is no tank, Saturn or not.**
  > - **The Full Moon's `tankAny` is explicitly RETAINED** and is now the *only* writer of that field. It opens the same gate — and therefore does spend the figure roll on beats a plain night does not — but it is a **phase rule**, and rule 2 licenses an active phase rule to change its own night's draws. The two cases must never be confused again: a **phase rule** may open a gate on its own night; a **planet** may only move a threshold. The test for any future planet knob is one sentence — *name the roll it moves, and show that roll is taken whether or not the planet is up.*
  > - **Draw-count trace (enumerated, not argued):** across 1920 spawn-scheduler states (cd × active × restSlots × slot × mercy × bow-hold), a Jupiter night and a planet-less night take the same number of `rnd()` calls in every state (old `jupiterConc`: 16 differing states). Across 720 fill-tank states, Saturn matches the planet-less night in every state (old `tankAny`: 12 differing states, all at BPM > `tank.maxBpm`). The Full Moon still differs in those 12 — by licence.
- **Kill-switches:** `CFG.deal.on`, `CFG.sensei.on` — raw-boolean-first at call sites, house style. All wave 1-3 constraints inherit (rhythm-safe, trainer/temple inert — both parcels post-graduation only, no new UI surfaces, flat CFG literals, mirror regen per commit — NOTE: the mirror is now `tools/index-inline.mirror.part<N>.js` parts, `node tools/extract-inline.mjs` handles it — gitnexus impact before edits, tests 133/133).
- **No dark patterns:** the deal line never says what you missed, never counts down, never references yesterday. The diagnosis is an observation with a cooldown — never the same diagnosis two nights running (fall back to the sky fact and keep weighting silently).

## 2. Parcel K — THE SKY DEALS THE NIGHT

### The deal, computed once per run (at `resetSession`, post-graduation)
- **Moon phase** from Meeus sun/moon ecliptic longitudes (elongation → 8 equal buckets). **Planet mix** from `_publicSkyPack` movers' current altitude (> `deal.planetAltDeg`, computed with the existing transform); pack absent/stale → neutral mix.

  > **1.1 amendment — "stale" is a DATE test, and it is deal-only.** `skydayValid()` answers *"is this a well-formed public day pack"*, which a pack cached overnight still is — so the deal was tilting today's mix with yesterday's risen planets. `dealPlanets()` now additionally requires the pack to be **today's**: the pipeline caches under `tz:cache_date` where `cache_date` is the civil date in the requested tz, and the client always asks with the device's own tz, so the honest comparison is against the **device's local calendar date** (the same local clock `dealWind` and the chorus salt turn over on). A missing, malformed, or mismatched `cache_date` reads **exactly like an absent pack** — neutral planet mix, no planet fragment, phase rule still deals. The sky **rendering** pipeline's own validity rules are untouched: a stale pack still draws the sphere it always drew; only the deal declines to read it.
- The deal writes a small set of effective values (never mutating base CFG — mirror the SENSEI_PACK pattern: compute effective values into a `_deal` object read at the existing sites).

### The eight phase rules (one active; names are Sensei-line fragments, EN + JA)
| Phase | Rule name | Mechanical meaning (existing knobs only) |
|---|---|---|
| New Moon | *the dark listens* | localization night: spawn spread widens (yaw spread ×`dealSpreadMul`, more behind-you bearings) |
| Waxing Crescent | *the wind stirs* | the shipped wind system deals ON, gentle (windMin..windMax ×`dealWindMul`), seeded from the date — clouds + ballistics + HUD as built |
| First Quarter | *the quick ones wake* | speed-orb chance ×`dealQuickMul`; orb life ×`dealQuickLifeMul` (slightly brisker field) |
| Waxing Gibbous | *the wind remembers* | wind ON, fuller strength; mover chance ×`dealMoverMul` |
| Full Moon | *the full chorus* | the generous night: density ×`dealFullDensityMul`, gold chance ×`dealFullGoldMul`, mercy-bar chorus swell ×`dealFullMercyMul`, tank always eligible (`tankAny`) — **1.2 amendment: this rule OPENS A GATE** (the fill's tank-eligibility test above `tank.maxBpm`) and therefore spends the fill's figure roll on beats a plain night does not. That is permitted here and *only* here, under the active-phase-rule licence of stream rule 2; the Full Moon is now the sole writer of `tankAny`. No planet may open this gate — see the 1.2 amendment to rule 3. |
| Waning Gibbous | *the echoes answer in pairs* | paired spawns: when the scheduler spawns, with probability `dealPairChance` it immediately schedules a companion at a distance sharing a landable arrival beat (chord-volley practice, using the existing beat-quantized distance math; still normal orbs, no new kind) — **1.1 amendment: pairs are pure volley material — both members are pinned kind 0, no kind overrides that mutate position or expiry.** Gold's `goldDistMul` moves an orb *after* its distance is drawn, divorcing its real flight time from the `k` it was chosen for and destroying the one thing the rule promises; speed's shortened life and the mover's faster drift break the same promise more gently. The pair is therefore decided **before** the primary is built (a kind cannot be taken back once it has moved an orb). The rest of the field's kind rolls are untouched. Implementation note: the kind roll is still *spent* and discarded for pair members, so a pair member's spawn costs exactly what every other spawn costs and the phase's extra draws stay confined to the pair roll plus the companion's own spawn. |
| Last Quarter | *the far ones call* | long-lead night: spawn distance band biased far (range floor/ceiling ×`dealFarMul`), gold farther |
| Waning Crescent | *the drum rests* | the quiet night: density ×`dealQuietDensityMul` (sparser), quiet-tick riseK ×`dealQuietTickMul` (silence comes sooner), BPM ramp gentler (`bpmUp` ×`dealQuietBpmMul`) — **1.1 amendment: the BPM multiplier applies to the effective UP-step at BOTH tempo paths**, `tideStepBpm` (tides on) *and* `maybeAdjust`'s per-event path (tides off), one `_deal` read each, raw-boolean-first. "The drum rests" is a named rule about the NIGHT, not about one tempo path: no inherited kill-switch combination may quietly cancel a rule the threshold line already promised. The DOWN step stays untouched — the drum rests, it does not stall. |

### The five planet tilts (stack on top of the phase rule; weights only, never a second RULE)

**1.2 amendment — the table now carries the proof, not just the effect.** Every row must name the roll it moves and show that roll is taken whether or not the planet is up.

| Planet | Knob | The roll it moves | Is that roll spent on a planet-less night? |
|---|---|---|---|
| Venus | `venusMul` 1.8 | the single kind roll's gold threshold | yes — one `kr` decides the kind every spawn |
| Mercury | `mercuryMul` 1.8 | the same kind roll's speed threshold | yes — same single draw |
| Mars | `marsMul` 1.8 | the same kind roll's mover threshold | yes — same single draw |
| Jupiter | `jupiterDensMul` 1.15 | the density probability `p` the spawn roll compares against | yes — once the (planet-free) concurrency gate and `i%2===0` pass, `rnd()` is unconditional. **1.2: this replaced a `+1 patternConcurrency` cap nudge, which was a GATE, not a threshold** |
| Saturn | `saturnFillMul` 1.6 | the drum fill's own 3-vs-2 figure threshold (`0.5`, clamped at 1) — the heavy one leans the fill to the three-note figure | yes — inside conditions the night already opened, that roll is unconditional and both branches fall through. **1.2: this replaced `tankAny` (tank eligibility above `tank.maxBpm`), which was a GATE. Above `tank.maxBpm` there is now no tank, Saturn or not** |

### The threshold line
One line at run start (post-graduation), riding the existing theme-flash moment (`dojoFlash` / `showGhostToast` — pick the one that reads best with the existing chrome, do not add a surface): `✦ <PHASE RULE NAME> · <planet fragment if any> ` — e.g. "✦ WAXING GIBBOUS · MARS IS UP · THE WIND REMEMBERS". JA equivalents for every fragment. If `sensei.on` produced a comeback/diagnosis... no — the threshold line is ALWAYS the deal line (parcel L owns only the Bow line).

> **1.1 amendment — ONE surface, ONE line, and the surface is `#dojoFlash`.** Shipping the deal as a ghost-toast alongside `flashTheme()` put two lines on screen in the same instant (the song name *and* the deal) and left the toast open to a late `announceSkyDay` overwriting it mid-animation. Resolved:
> - On a **post-graduation run with `deal.on`**, the existing theme-flash moment shows the **deal line INSTEAD of the song name** — same element, same animation, same song colour, same opening breath. A replacement, never an addition.
> - **Pre-graduation** (the trainer, which never reaches that call and keeps its own toast), **`deal.on:false`**, and **any night the ephemeris could not be read** (`dealLine()` returns `''`) keep the song name exactly as today. JA both ways.
> - The **ghost-toast is not used at the threshold at all**, so nothing can race or overwrite the line.
> - **`announceSkyDay` never toasts over a running field.** A day pack that lands mid-run is parked and spoken at the next menu/pause surface. This is also what cures the race.

  > **1.2 amendment — the deferral is SCOPED TO THE DEAL, because the race is.** As shipped, the `state.running` park ran unconditionally, so a `deal.on:false` build stopped showing the wave-3 mid-run sky toast — a behaviour change on the off path, which violates the parcel's one absolute promise. The park is now `CFG.deal.on && state.running` (raw kill-switch first): the only thing a mid-run toast could collide with is the deal line that owns the threshold flash, and that line does not exist with the deal off. With `deal.on:false` the pack is announced on arrival, wave-3 verbatim; `_skyDayPending` is never written, so `flushSkyDayAnnounce()` is a permanent no-op on that build. The flush path is unchanged for the parked (dealing) case.

### CFG (flat)
```
deal:{ on:true, planetAltDeg:5, spreadMul:1.5, windMul:0.7, quickMul:2.2, quickLifeMul:0.85,
       moverMul:1.8, fullDensityMul:1.2, fullGoldMul:1.8, fullMercyMul:1.3, pairChance:0.35,
       farMul:1.3, quietDensityMul:0.8, quietTickMul:1.6, quietBpmMul:0.6,
       venusMul:1.8, mercuryMul:1.8, marsMul:1.8, jupiterDensMul:1.15, saturnFillMul:1.6 }
```
> **1.2 amendment:** `jupiterConc:1` is **deleted** (it moved a gate). `jupiterDensMul` and `saturnFillMul` replace it and Saturn's gate-opening `tankAny`; both are first guesses, tuned by ear.

### Acceptance
- `deal.on:false` → byte-identical behavior and rnd stream; no `_deal` reads anywhere hot.
- Exactly one rule active per night; the line names it; nothing else announces anything.
- API-less load: phase rule deals from Meeus alone; planet fragment simply absent from the line.
- Paired spawns (Waning Gibbous) preserve all distance/timing laws — the companion is a normal beat-quantized spawn whose k is chosen so both share a landable beat; draw-count changes are confined to that phase's nights (document the stream implication in the CFG comment — acceptable because free-play has no shared seed). **1.1: both members are kind 0** (see the phase table).
- Wind deals only on the two waxing phases; `?wind` opt-in behavior for other nights unchanged.

  > **1.1 amendment — the cloud drift vector is part of the wind STATE.** The dome's `uWind` uniform is written through one writer (`applyCloudWind()`) that is called **unconditionally**, from the per-frame sky update *and* from `resetSession` at the moment the wind is re-decided — so a tab that plays a waxing night and then a wind-less one gets its still sky back at the same instant `windX/windZ` are cleared, rather than inheriting last night's drift until something else notices. The wind-less branch is the baseline gentle drift verbatim: nights that were never dealt wind are unchanged.

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

  > **1.1 amendment — strict envelope.** `senseiLoad()` validates **every** field it reads, not only the ones it returns: `n` must be a finite integer ≥ 1 (coerce-and-check, the wave-3 storage lesson), alongside the existing bin/dir whitelists and the freshness window. Any failure rejects the **whole record**, silently. A record whose `n` is a fraction, zero, negative, `NaN`, `Infinity` or not a number at all was not written by this build, and a half-trusted record is worse than none.

  > **1.2 amendment — coercion is not validation: the gate is a TYPE test first.** `+o.n` said `1` to `true`, to `[1]` and to `["2"]`, so three values `senseiSave` could never have written passed every check behind it. One helper (`senseiNum`) now guards **every** numeric field in the envelope: a **number** is admitted only when finite; a **string** only when the trimmed text is a pure decimal integer (`/^-?[0-9]+$/`, then a finite re-check so a 400-digit string cannot arrive as `Infinity`). Booleans, arrays, objects, `null`, `undefined`, `'1e3'`, `'0x10'`, `'1.0'`, `'+1'` and `''` all reject the **whole record**, silently. The value checks are unchanged on top of it — `n` must be an integer ≥ 1, `day` an integer > 0 and not in the future — and `day` now gets exactly the same strictness as `n`.

## 4. Build order & review

Sequential K → L (one commit each, Sonnet verify between, gitnexus impact before edits), then Codex read-only review, fix rounds to GREEN, push branch for user playtest. All magnitudes are first guesses — tuned by ear/eye after play.

## 5. Playtest questions (post-build)

- K: does the one-line deal read instantly ("ah, windy Mars night") or does it need the HELP tab? Do dealt nights FEEL different at the current multipliers?
- K: pairs night — did you find yourself firing volleys on purpose?
- L: did Sensei's first observation land as "the game noticed me" or as nagging? Is the silent next-morning drill perceptible (it shouldn't be)?
- The finale question: after a week under the dealt sky, does checking the actual moon on the drive home change whether you play?
