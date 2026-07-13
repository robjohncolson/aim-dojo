# Groove Pocket — Rolling Buffer Expectation (v1)

**Version:** 1.0 · 2026-07-13  
**Product:** Moon Chorus / aim-dojo free-play groove  
**Files:** primarily `index.html` (WASD resolve, floor beat-tint, pocket state). Tests under `tests/`.  
**Replaces:** hard phase machine **establish → sample → hold** (`_pocketPhase` establish/sample/hold cycle, LISTENING mode, permanent coach staff / pocket circle targets as *required* UI).  
**Supersedes for gameplay:** parts of `SPEC_GROOVE_POCKET.md` that define 12/4/16 phases. Floor **color** rules in older circle/coach specs that recolor by pocket are **void** — floor hue stays the letter color.

---

## 1. Goals / Non-goals

### Goals

- Continuously learn whether the player prefers **on**, **push** (−¼ beat), or **layback** (+¼) from a rolling window of main WASD taps.
- **Expect** a pocket for the near future and **reward** hits against that expectation with field freeze ∝ accuracy.
- Changing feel costs a **short** period of weaker freeze, then settles into the new pattern without a sacrificial “listening” mode.
- **Floor** communicates expectation **only by peak timing** (phase), **never by recoloring** — wash color remains the in-focus **WASD letter** color.
- UI stays zen: **no** required rings, staff, or permanent ACC panel. Optional toast when expectation **changes**.

### Non-goals

- Do **not** change floor tint hue to mint/pink/pocket colors.
- Do **not** require beat-circle targets or coach staff (`pocketCircleCue` / staff default **off** for this parcel’s free-play feel; may leave code dead or gated off).
- Do **not** move orb open-window / juke / Transport / `grooveFireEarlyBeat` (stays 0 unless already configured).
- Do **not** grade freeze against all three pockets at once — freeze uses **expected** only.
- Trainer / mobile: pocket buffer **off** (same gate spirit as `pocketLive()`: free-play desktop groove only).

---

## 2. Design rule

> **Last N taps teach three clocks. The winning clock is the law for the next bar. Freeze rewards the law. Floor peaks with the law’s phase, in the letter’s color.**

| Absolute (unchanged) | Pocket-relative |
|----------------------|-----------------|
| Transport, click, juke | Intent buffer (3-way acc) |
| Orb open-window center | **Expected** pocket for freeze |
| Floor **hue** = letter (WASD_HEX) | Floor **peak phase** = `I(expected)` |
| Letter glyph | Optional toast on expectation change |

---

## 3. Pocket definitions

Same as before — offsets vs **WASD main-note ideal** (heard timeline: `wasdBeats` − latency):

| Id | Offset (beats) |
|----|----------------|
| `push` | −0.25 |
| `on` | 0 |
| `layback` | +0.25 |

Classifier bins (for display/debug only if needed): edges at ±0.125.  
**Intent scoring does not require bins** — use continuous accuracy vs each ideal.

---

## 4. Per-hit evaluation

On each **resolved correct-key main** note with raw `offBeats` (beats from main center) and accept window `w` (seconds):

```
acc(ideal) = existing accuracy curve on |offBeats - ideal| * bps
  // same shape as _wasdResolve: ~25ms perfect plateau, linear falloff over rest of window

acc_on      = acc(0)
acc_push    = acc(-0.25)   // or CFG.pocketOffsetBeat
acc_layback = acc(+0.25)
```

Wrong-key / silent miss (main left unresolved):

- Append a **miss** sample: all three acc = 0, `best = null`, does not vote for a pocket.
- Freeze: existing spoil / miss path (`_baseMul` wake, combo break).
- Still advances the buffer (so AFK / whiffs dilute confidence toward weak means → stay/return **on**).

**Best-of-three for the hit** (optional vote field):  
`best = argmax(acc_*)` if `max(acc_*) >= weakFloor` (default **0.35**), else `best = null`.

---

## 5. Rolling buffer (intent)

| Knob | Default |
|------|---------|
| `pocketBufferLen` | **16** main events |
| Unit | **Main** notes only (not bonus subdivs) |

Each entry:

```js
{ accOn, accPush, accLay, best, offBeats, expectedAtHit }
```

Push front/back; drop oldest beyond 16.

### Intent estimate from buffer

For each pocket `p ∈ {on, push, layback}`:

```
mean_p = average of acc_p over all entries in buffer
```

(Misses contribute 0.)

**Winner** = `argmax(mean_p)`.

**Tie-break:** `on` > previous `expected` if tied among tops > else `on`.

**Confidence gate** (no flicker):

- Need `buffer.length >= pocketMinSamples` (default **8**) before any switch away from on (cold start).
- Switch to winner only if:
  - `mean_winner - mean_second >= pocketLead` (default **0.06**), **and**
  - optional hysteresis: winner wins for `pocketHysteresisBars` consecutive bar boundaries (default **2**), **or** single-bar switch if lead ≥ `pocketLeadHard` (default **0.12**).

If confidence fails: keep current `expected` (or `on` if still cold).

---

## 6. Expected pocket (forecast / law)

| Knob | Default |
|------|---------|
| `pocketExpectBars` | **1** bar = **4** mains |
| Initial `expected` | **`on`** |

**Law for freeze + floor phase** = `expected`.

### When to recompute

At each **bar boundary** (every 4 main events counted for expectation, including misses):

1. Recompute intent winner from buffer (with gates).
2. If winner passes hysteresis/lead → set `expected = winner`.
3. If `expected` **changed** → one toast (see §9); floor phase follows immediately.

Between boundaries, `expected` is stable (zen: one law per bar).

Alternative allowed if simpler and tested: recompute every main but only **commit** `expected` changes at bar boundaries (same external behavior).

---

## 7. Freeze credit (gameplay reward)

On correct-key main:

```
I = pocketIdeal(expected)   // -0.25 | 0 | +0.25
gradeOffSec = (offBeats - I) * bps
→ feed existing _wasdResolve(gradeOffSec, main, w)
```

- Accurate to **expected** → strong freeze (field settles).  
- Accurate to a *different* pocket while expected hasn’t switched yet → weaker freeze (cost of changing feel).  
- After buffer promotes the new pocket → same physical timing now freezes hard.

Bonus / non-main notes: **unchanged** legacy path (combo only); **do not** write buffer or change expected.

---

## 8. Floor communication (phase only)

`updateFloorBeat`:

- **Color:** keep current behavior — `WASD_HEX[ckey]` for the in-focus letter. **Never** recolor by push/on/layback.
- **Peak phase:** shift evaluation clock by `I(expected)`:

```
peakBeats = wasdBeats() - pocketIdeal(expected)
// envelope vs nearest integer of peakBeats (existing shape)
```

So:

| expected | Floor peaks |
|----------|-------------|
| on | At current WASD ideal (and-grid center) |
| push | ~¼ beat **early** |
| layback | ~¼ beat **late** |

Letter hue still identifies **which key**; timing of the wash identifies **when** the law wants the tap.

---

## 9. UI (zen)

| Element | v1 |
|---------|-----|
| Beat-circle mint/pink targets | **Off** (`pocketCircleCue: false` default) |
| Coach staff / BAR·ACC strip | **Off** or hidden (`pocketStaffMode: 'off'`) |
| Permanent phase HUD | **Off** |
| Toast on `expected` change only | **On** — short: `ON THE BEAT` / `LEAN EARLY` / `SIT BACK` (or existing T() keys) |
| BEAT CIRCLE pause toggle | Unchanged optional training wheel; not required for pocket |

Remove or no-op establish/sample/hold coach panel updates for free-play buffer mode.

---

## 10. CFG knobs

```js
groovePocket: true,
pocketBufferLen: 16,
pocketMinSamples: 8,
pocketExpectBeats: 4,        // bar length in mains
pocketLead: 0.06,
pocketLeadHard: 0.12,        // optional fast switch
pocketHysteresisBars: 2,
pocketWeakFloor: 0.35,       // below → best=null
pocketOffsetBeat: 0.25,
pocketBinEdge: 0.125,        // if still used elsewhere
pocketCircleCue: false,      // zen default
pocketStaffMode: 'off',
// retire or ignore for gameplay: pocketEstablishBeats, pocketSampleBeats, pocketHoldSets, …
```

Kill-switch: `groovePocket: false` → legacy center-only freeze; floor unshifted; no buffer.

---

## 11. State machine (replace phases)

```
expected = 'on'
buffer = []
barCount = 0
hysteresisCandidate = null, hysteresisStreak = 0

onMainResolved(offBeats, …):
  append intent sample (3 accs)
  freeze vs expected
  barCount++
  if barCount % pocketExpectBeats == 0:
    maybeUpdateExpected()

onMainMiss():
  append miss sample
  barCount++  // same bar clock
  if barCount % pocketExpectBeats == 0:
    maybeUpdateExpected()
```

**Delete / bypass:** `_pocketPhase` establish|sample|hold transitions, sample votes majority, hold accuracy → refocus establish (optional soft: if mean acc vs expected over buffer &lt; 0.45 for a full buffer, set expected → on once — not required v1).

---

## 12. Implementation map

| Concern | Anchor |
|---------|--------|
| Main resolve + freeze | `wasdLanePress`, `claimWasdNote`, `_wasdResolve` |
| Silent miss | `pocketSweepMisses` / miss path — write buffer miss |
| Floor phase | `updateFloorBeat` — phase by `expected`, color = letter |
| Remove busy UI | `pocketCircleCue:false`, staff off, strip phase HUD |
| Reset | `resetPocketState` / `startRun` — clear buffer, expected=on |

Keep `claimWasdNote` main-claim at high nd so ±¼ still binds to mains.

---

## 13. Acceptance

1. Cold start: freeze strongest on center; floor peaks on ideal; letter colors floor.  
2. Consistent early taps over ~16 mains → within a few bars expected → push; early taps freeze hard; floor peaks early **same letter hue**.  
3. Switching back to on costs soft freeze briefly, then settles.  
4. No mint/pink floor; no required rings/staff.  
5. Toast only when expected changes (not every bar).  
6. Open-window still on audible 1.  
7. Trainer: buffer off.  
8. `groovePocket:false` restores center-only.

---

## 14. Tests

- Pure: three-way acc ordering (early hit → push mean highest).  
- Buffer length 16 drop-old.  
- expected switches only with min samples + lead/hysteresis.  
- Freeze grade uses expected ideal.  
- Floor: phase shift uses expected; no pocket recolor helpers required.  
- Contract: `pocketBufferLen:16`, `pocketCircleCue:false` (or staff off), `grooveFireEarlyBeat:0`.

---

## 15. Summary

1. Buffer **16** mains with acc vs on/push/layback.  
2. Every **4** mains, refresh **expected** (start **on**, gated).  
3. Freeze ∝ accuracy vs **expected**.  
4. Floor **phase** follows expected; floor **color** = letter.  
5. Rings/staff off; quiet toast on law change only.
