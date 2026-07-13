# Groove Pocket Language — Spec (v1)

**Version:** 1.0 · 2026-07-12  
**Product:** Moon Chorus / aim-dojo free-play groove  
**Files:** primarily `index.html` (single-file client). Optional small contract tests in `tests/`.  
**Depends on:** existing WASD rhythm (`wasdLanePress`, `_wasdResolve`, `wasdMul`), floor beat-tint (`updateFloorBeat`), audio-latency correction (`audioLat` / heard timeline).

---

## 1. Goals / Non-goals

### Goals

- Teach a **groove language** via WASD timing: the player states a preferred **pocket** (push / on / layback), and the game holds them to it.
- Use a clear phase cycle: **establish → sample → hold → resample → hold…** with a **focus reset** when accuracy collapses.
- Make the pocket **felt in gameplay** (freeze quality + combo credit) and **seen** (floor + letter lighting peak phase).
- Keep the **world beat absolute**: metronome, juke, and orb open-window stay on the existing groove timeline.

### Non-goals (v1)

- Do **not** shift orb kill open-window / `grooveFireEarlyBeat` with pocket.
- Do **not** rewrite BPM skill progression formulas beyond gating pocket accuracy / establish reset.
- Do **not** change shot/projectile arrival grading.
- Do **not** add new audio stems, network calls, or save the pocket to the server (local run state only is fine).
- Do **not** require trainer rewrite; trainer may keep current on-center teaching (see §7).

---

## 2. Design rule

> **Pocket changes what the player is rewarded for and how hard the field settles.**  
> **It does not change when the song is.**

| Absolute (unchanged) | Pocket-relative (v1) |
|----------------------|----------------------|
| Tone.Transport / click | WASD hit grading ideal |
| Juke phase | Freeze / combo credit |
| Orb open-window center | Floor + letter cue peak phase |
| Fire quant / spawn grid | Phase machine + accuracy floor |

---

## 3. Pocket definitions

Pockets are measured against the **WASD note ideal** on the **heard timeline** (same base as `wasdLanePress`: `wasdBeats()` then `− audioLat()/bps`).

Signed offset in **beats** relative to the resolved note center:

| Id | Label | Ideal offset (beats) | Player feel |
|----|--------|----------------------|-------------|
| `push` | ¼ early | `−0.25` | anticipates the note |
| `on` | on | `0` | dead center |
| `layback` | ¼ late | `+0.25` | sits behind the note |

### Classification

For a successful key match with raw offset `offBeats` (beat fraction of the WASD grid, i.e. `beats − ci/nd` as today):

- Map `offBeats` into the nearest of `{−0.25, 0, +0.25}` **or** into fixed Voronoi bins (preferred — deterministic):

```
// offBeats in (−0.5, +0.5] relative to note center (wrap if needed)
if (offBeats < −0.125) → push
else if (offBeats > +0.125) → layback
else → on
```

Bin edges at ±⅛ beat sit midway between on and ±¼.

A **miss** (wrong key, no note in window, or outside accept window for the active phase) does **not** vote a pocket; it is an accuracy miss when graded.

### Pocket quality for grading (hold / establish)

When the **expected** pocket is `E` with ideal offset `I(E)`:

- Grade offset for freeze/acc: `offPocket = offBeats − I(E)`  
  (so perfect means “at the pocket,” not “at raw center”).
- Reuse the existing accuracy curve shape from `_wasdResolve` (perfect plateau ~25ms, linear falloff over the remaining window), applied to `|offPocket|` in seconds: `offPocket * bps`.

---

## 4. Phase machine

### Config knobs (single CFG block)

```js
// suggested defaults — tune by ear
groovePocket: true,              // master kill-switch
pocketEstablishBeats: 10,        // on-only focus
pocketSampleBeats: 4,            // listen, no punishment
pocketHoldSets: 4,               // sets per hold
pocketHoldSetBeats: 4,           // beats per set → 16 hold beats
pocketAccFloor: 0.70,            // reset threshold
pocketAccWindow: 12,             // rolling graded hits for hold accuracy (or whole hold — see below)
pocketOffsetBeat: 0.25,          // |push|/|layback| ideal
pocketBinEdge: 0.125,            // classifier boundary from on
```

**Hold length** = `pocketHoldSets * pocketHoldSetBeats` = **16** main-note beats by default.

### Beat unit

Count **main WASD notes only** (the same `main` flag already used in `wasdLanePress` / `_wasdResolve` — the on-grid notes that set `_baseMul`). Bonus/off-main notes may still play and may contribute lightly to combo, but **do not advance** the pocket phase counter and **do not** vote in sample.

If `main` is not available for a press path, fall back to counting each resolved WASD note at the current grid that lands on a whole WASD beat index.

### Phases

```
                    ┌──────────────────────────────┐
                    │                              │
                    ▼                              │
              ESTABLISH (10)                       │
                    │                              │
                    ▼                              │
               SAMPLE (4) ──majority──► HOLD (16) ─┘
                    ▲                      │
                    └──── after hold ──────┘
                    
  HOLD accuracy < 70%  ───────────────────► ESTABLISH
```

| Phase | Length (main notes) | Expected pocket | Accuracy graded? | Sample votes? |
|-------|---------------------|-----------------|------------------|---------------|
| `establish` | 10 | forced `on` | yes (must be `on`) | no |
| `sample` | 4 | any of 3 | **no** (soft — still freeze if in any bin) | yes |
| `hold` | 16 | last sample winner | yes vs active pocket | no |

After a completed hold with accuracy ≥ floor → enter **sample** again (re-measure).  
After sample → set active pocket from majority → **hold**.  
Ties in sample: prefer `on`, then previous pocket if still tied, else `on`.

### Accuracy for reset

During **hold** (and establish, optionally), maintain a rolling accuracy over the last `pocketAccWindow` **graded** main hits (default 12), or if fewer hits exist, over all graded hits so far in the phase.

`accuracy = goodHits / gradedHits` where a hit is **good** if its pocket-relative accuracy ≥ a threshold equivalent to the existing “good enough to freeze meaningfully” band — recommended: `_tapAcc >= 50` after pocket-relative resolve, **or** simply “classified bin matches expected pocket AND inside the accept window.”

**Reset rule:** if `accuracy < pocketAccFloor` **and** at least `min(pocketAccWindow, 8)` graded hits have been collected in the current hold → transition to **establish**, clear active pocket privilege, reset counters.

Do **not** reset on a single miss. Sample phase never triggers reset.

### Run lifecycle

- On `startRun` / run reset: phase = `establish`, counters 0, activePocket = `on`, sample votes cleared.
- When `groovePocket:false` or `wasdRhythm:false` or groove disabled: pocket machine idle; existing WASD behavior only.
- Rail-flick bonus / pause: freeze phase progress while not in normal running input (don’t advance counts offline).

---

## 5. Gameplay influence (WASD only)

### Establish

- Expected: **on** only.
- Correct key + in **on** bin (or pocket-relative grade vs `I(on)=0`): full `_wasdResolve` freeze path.
- Correct key but push/layback bin: treat as **weak or miss for freeze** — recommended: `acc` capped low (`_baseMul` does not fully calm), no combo gain; still advances establish counter so the phase completes (focus practice, not softlock).
- Wrong key: existing spoil behavior; advances counter as graded miss.

### Sample

- Correct key in **any** of the three bins: full normal freeze credit (generous).
- Vote the classified bin once per main note.
- After 4 votes: majority → `activePocket`; enter hold.
- No accuracy punishment; no reset.

### Hold

- Expected: `activePocket`.
- Grade with `offPocket = offBeats − I(activePocket)`.
- Full freeze/combo only when good vs pocket.
- Off-pocket (wrong bin) or outside window: miss for accuracy + weak/no freeze (match establish weak rules).
- After 16 graded main notes with accuracy ≥ floor: go to sample.
- If accuracy &lt; floor (with enough samples): go to establish.

### What must not change

- `wasdBeats()` phase shift onto the “and” (`grooveFreezePhase`) stays.
- Juke, open-window, fire quant, projectile connect — untouched.
- `wasdMul` formula can stay; only the **inputs** (`_baseMul`, `_wasdCombo`) change via pocket-aware resolve.

---

## 6. Floor + letter lighting

### Current behavior (anchor)

`updateFloorBeat()` peaks the floor tint on the nearest WASD grid beat (`wasdBeats` / `wasdBeatsHeard` in trainer), key color = current combo letter. Letter HUD already tracks the hit line.

### v1 change

Shift the **phase of the peak**, not the key color system:

```
peakBeats = wasdBeats() − I(cuePocket)
// then existing nearest-integer + envelope against peakBeats
```

| Phase | `cuePocket` |
|-------|-------------|
| establish | `on` (I=0) — peak on current WASD ideal |
| sample | `on` (neutral listen cue) **or** no shift; keep simple |
| hold | `activePocket` — floor peaks at push/on/layback ideal |

Optional secondary (nice, not required):

- Establish: slightly lower `floorBeatMax` (focus, less chrome).
- Hold: full `floorBeatMax`.
- Sample: mid intensity.

Letter flash / hit-line timing should remain consistent with grading (player taps when the cue says). If letter animation is driven by the same WASD beat index, apply the **same** pocket phase offset so floor and letters agree.

Do **not** change `WASD_HEX` colors for pocket identity; phase is the language. (Optional later: subtle warm/cool bias per pocket — out of scope for v1.)

---

## 7. Modes

| Mode | Behavior |
|------|----------|
| Free-play + `grooveGroove` + `wasdRhythm` + `groovePocket` | Full machine |
| `groovePocket:false` | Legacy WASD (center grade only) |
| Trainer (`trainMode`) | **Default:** leave trainer on center-only teaching (no pocket machine), unless a one-line enable is trivial. Prefer zero trainer risk in v1. |
| Mobile / no WASD | Machine idle (existing mobile paths) |
| Reduced motion | Floor may stay discrete; phase machine still runs for grading |

---

## 8. Player-facing feedback

Minimal, non-spammy:

1. **Compact phase readout** (HUD or coach line), e.g.  
   - `FOCUS 3/10`  
   - `LISTEN 2/4`  
   - `HOLD PUSH 78%`  
   - `HOLD ON 64%` → then after reset `FOCUS 1/10`

2. **Optional one-shot toast** on phase enter only (not every beat):  
   - establish: `FIND THE CENTER`  
   - sample: `SHOW YOUR POCKET`  
   - hold: `HOLD · PUSH` / `HOLD · ON` / `HOLD · LAYBACK`  
   - reset: `REFOCUS`

3. Reuse existing tap timing text if enabled (`wasdTapText`): show pocket-relative AHEAD/BEHIND when useful.

Japanese: add `T(...)` keys in the existing i18n pattern; EN strings inline at call sites.

---

## 9. Implementation map (code anchors)

All in `index.html` unless noted.

| Concern | Anchor |
|---------|--------|
| CFG | near `wasdRhythm` / groove block (~563–585) |
| Resolve + freeze | `_wasdResolve`, `wasdLanePress` (~725, ~2564) |
| Floor tint | `updateFloorBeat` (~3015) |
| Run reset | `startRun` state wipe (~4190 area) |
| WASD grid / latency | `wasdBeats`, `wasdBeatsHeard`, `audioLat` |
| Multiplier | `wasdMul` (consume pocket-aware `_baseMul`) |

### Suggested state

```js
let _pocketPhase = 'establish'; // establish | sample | hold
let _pocketCount = 0;           // main notes in current phase
let _activePocket = 'on';       // push | on | layback
let _sampleVotes = { push:0, on:0, layback:0 };
let _pocketHits = [];           // rolling {good:boolean} for hold acc
```

### Integration sketch

In `_wasdResolve` or immediately after correct-key path in `wasdLanePress` when `main`:

1. Classify pocket bin from `offBeats`.
2. Switch on `_pocketPhase` → grade, vote, advance, maybe transition.
3. Pass pocket-relative `offSec` into freeze math.

In `updateFloorBeat`:

1. `const I = pocketIdeal(_cuePocket)`  
2. Peak envelope on `beats - I`.

---

## 10. Acceptance tests

### Manual smoke

1. Start free-play with WASD on. Readout shows **FOCUS 0/10** (or 1 after first main).
2. Tap center for 10 mains → **LISTEN**; floor peaks on ideal center.
3. Deliberately tap ~¼ early for 4 mains → **HOLD · PUSH**; floor peak moves earlier; freeze strong only when early.
4. Stay in push for 16 → returns to **LISTEN**.
5. Spam off-pocket until rolling accuracy &lt; 70% → **FOCUS** again; freeze strict on-center.
6. `CFG.groovePocket = false` (or kill-switch) → legacy feel restored.
7. Orb open timing and juke feel unchanged vs pre-change.

### Automated (if easy)

- Pure functions: `classifyPocket(offBeats)`, `pocketIdeal(id)`, `majorityVotes(votes)`, phase transition table — unit-testable without Three/Tone if extracted to tiny helpers or tested via node-extractable pure block.
- Optional contract: `tests/index-contract.test.js` greps for `groovePocket` / phase ids present.

---

## 11. Tuning notes (post-ship)

- If hold feels too long: drop `pocketHoldSets` to 3 (12 beats).
- If reset feels hair-trigger: raise `pocketAccWindow` or require 12 hits before reset can fire.
- If sample is noisy: require ≥2 votes for a bin to win, else default `on`.
- If push/layback bins steal center: tighten `pocketBinEdge` from 0.125 → 0.10.

---

## 12. Future (explicitly not v1)

- Shift open-window center by pocket (shared dialect with shots).
- Persist preferred pocket per song in localStorage.
- Distinct SFX per pocket.
- Sensei-pack overrides for pocket lengths.

---

## 13. Summary cycle (canonical)

1. **10** main notes — establish **on** (focus).  
2. **4** main notes — sample pocket (push / on / layback).  
3. **4 × 4 = 16** main notes — hold that pocket (freeze + floor phase).  
4. Repeat sample → hold.  
5. If hold accuracy **&lt; 70%** → back to step 1.
