# Codex prompt — Groove pocket language (WASD)

Copy everything below the line into Codex.  
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

---

## Mission

Implement the **groove pocket language** for free-play WASD rhythm in Moon Chorus (`index.html`):

**establish (10 on) → sample (4) → hold (16 = 4×4) → sample → hold…**  
If hold accuracy **&lt; 70%**, reset to **establish**.

Pocket = where the player likes to sit relative to the **WASD note ideal** (heard timeline):

| Pocket | Offset |
|--------|--------|
| `push` | −¼ beat (early) |
| `on` | 0 |
| `layback` | +¼ beat (late) |

Be **literal** to the spec. Prefer small, reviewable diffs. Do not invent combat systems.

## Required reading (first)

1. **Spec (wins on any conflict):**  
   `/mnt/c/Users/rober/Downloads/Projects/aim-dojo/SPEC_GROOVE_POCKET.md`
2. Existing anchors in `index.html`:
   - CFG groove / WASD (~`wasdRhythm`, `grooveGroove`, `grooveFireEarlyBeat`)
   - `_wasdResolve`, `wasdLanePress`, `wasdMul`
   - `updateFloorBeat` (floor + grid tint)
   - `wasdBeats` / `wasdBeatsHeard` / `audioLat`
   - run reset near `startRun` (combo/wasd state wipe)
3. i18n: existing `T('key', 'EN default')` + `window.JA` pattern for any new player-facing strings.

## Scope — Parcel P1

| ID | Task |
|----|------|
| P1 | Add CFG block: `groovePocket`, establish/sample/hold lengths, `pocketAccFloor` 0.70, offset 0.25, bin edge 0.125, rolling window |
| P2 | Pocket state machine: phase, counters, votes, `activePocket`, rolling accuracy; reset on `startRun` |
| P3 | Classify main-note hits into push/on/layback; sample majority; ties → `on` (then previous) |
| P4 | **Establish:** grade vs `on` only; weak freeze if off-center; advance 10 mains |
| P5 | **Sample:** 4 mains, any bin freezes, votes only; no reset; then enter hold with winner |
| P6 | **Hold:** grade vs `activePocket` using pocket-relative offset; freeze/combo only when good; 16 mains then resample; **&lt;70%** with enough hits → establish |
| P7 | **Floor (+ letter if shared clock):** peak phase shifted by `I(cuePocket)`; establish/sample cue `on`; hold uses `activePocket`. Do not recolor by pocket. |
| P8 | Compact phase readout (HUD/coach): `FOCUS n/10`, `LISTEN n/4`, `HOLD PUSH 78%` etc. Optional one-shot phase toast only on enter. |
| P9 | Kill-switch: `groovePocket:false` → legacy center-only WASD. Trainer: **leave center-only** (machine off in `trainMode`) unless zero-risk. |
| P10 | Smoke notes in commit/PR message; optional pure-function tests or contract grep for `groovePocket` |

## Out of scope (do not touch)

- Orb open-window / `grooveFireEarlyBeat` / juke phase
- Projectile arrival grading, fire quant, spawn grid
- BPM skill formula rewrites (beyond pocket accuracy driving establish reset)
- Server, Supabase, save-my-sky, essay UI
- Persisting pocket to localStorage (not required)
- New audio tracks

## Design rule (do not violate)

> Pocket changes **reward + freeze + floor peak phase**.  
> Pocket does **not** change **when the song is** (Transport, juke, open window).

## Implementation notes

### Phase lengths (defaults)

- Establish: **10** main WASD notes  
- Sample: **4** main notes  
- Hold: **4 sets × 4 beats = 16** main notes  
- Accuracy floor: **0.70**  
- Count **main** notes only for phase progress (existing `main` flag in WASD path)

### Classifier (deterministic)

```
offBeats = beats - ci/nd   // existing signed beat offset vs note center (heard timeline)
if (offBeats < -0.125) push
else if (offBeats >  0.125) layback
else on
```

Ideal offsets: push −0.25, on 0, layback +0.25.  
Hold/establish grade with `offPocketBeats = offBeats - ideal(expected)`; convert to seconds via `bps` for the existing acc curve.

### Freeze contract

| Phase | Full freeze/combo when |
|-------|-------------------------|
| establish | good vs **on** |
| sample | good vs **any** bin |
| hold | good vs **activePocket** |

Wrong key: keep existing spoil.  
Sample: never accuracy-reset.  
Hold reset only after enough graded hits (see spec §4).

### Floor

In `updateFloorBeat`, evaluate the envelope against `beats - ideal(cuePocket)` so the wash **peaks when the player should tap**. Key color stays `WASD_HEX[ckey]`.

### UX copy defaults (EN)

- Establish toast: `FIND THE CENTER`
- Sample toast: `SHOW YOUR POCKET`
- Hold toast: `HOLD · PUSH` / `HOLD · ON` / `HOLD · LAYBACK`
- Reset toast: `REFOCUS`
- Readout: `FOCUS 3/10` · `LISTEN 2/4` · `HOLD PUSH 78%`

Add ja via `T` + `window.JA` if you touch player-facing strings; keep strings short for toast.

## Verification

1. Free-play: FOCUS → after 10 center mains → LISTEN → bias early → HOLD PUSH; floor peaks earlier; freeze strong only when early.  
2. Complete 16 → LISTEN again.  
3. Miss off-pocket until &lt;70% → REFOCUS / FOCUS.  
4. `groovePocket:false` restores legacy feel.  
5. Trainer path unchanged (no pocket machine).  
6. Open-window / juke timing feel identical to before.  
7. No new network calls; no birth/sky feature regressions.

## Checklist

- [ ] P1–P10
- [ ] Spec §10 manual smoke mentally walked
- [ ] Kill-switch works
- [ ] Trainer safe
- [ ] No open-window coupling
- [ ] Run reset clears pocket state
