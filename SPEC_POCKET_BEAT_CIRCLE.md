# Pocket Beat-Circle Cue — Spec (v1)

**Version:** 1.0 · 2026-07-13  
**Product:** Moon Chorus / aim-dojo free-play groove  
**Parent:** `SPEC_GROOVE_POCKET.md` (phase machine, push/on/layback, grading — **wins** for gameplay rules)  
**Files:** primarily `index.html` (`drawWasdLane`, optional coach staff, `updateFloorBeat`).  
**Depends on:** pocket phase state (`_pocketPhase`, `_activePocket`, `pocketLive`, `pocketIdeal`, `pocketCueId`), existing WASD hit-line ring (`Rin` / approach circle in `drawWasdLane`).

---

## 1. Goals / Non-goals

### Goals

- After LISTENING locks a pocket, the **beat circle** shows **when** to tap relative to the main WASD note — not only which letter.
- During **HOLD**, a **phase-colored target ring** sits at the diameter that corresponds to **±¼ beat** (or on-center), so the eye aims at the right moment on the approach path.
- The **main beat ring** (center / on-phase) becomes **less visible** for that note when the expected pocket is push or layback — so the pocket target is primary.
- **LISTENING** teaches the three options with faint multi-ghost marks; **establish** stays on-center only.
- Keep **conjunction** with the coach strip (title + count); staff notation is **secondary** and may stay slim.
- Floor peak phase already follows pocket — keep it aligned with the circle cue.

### Non-goals

- Do **not** move orb open-window / `grooveFireEarlyBeat` / juke / Transport.
- Do **not** change pocket grading math (claim mains, silent misses, majority) except as needed to feed cue state.
- Do **not** require trainer mode; `pocketLive()` remains free-play only.
- Do **not** add new network or persistence.
- Do **not** replace the letter glyph (W/A/S/D still shows which key).

---

## 2. Design rule

> **The beat circle’s primary job in HOLD is: “hit when the pocket ring lands,” not “hit when the old main ring lands.”**  
> Main (on-phase) geometry stays in the world for reference but is demoted when the contract is push/layback.

Absolute (unchanged): metronome, juke, open-window.  
Relative: WASD grade ideal, freeze credit, floor peak, **and now beat-circle target phase**.

---

## 3. Color system (color-theory aware)

| Pocket | Offset (beats) | Cue color | Role |
|--------|----------------|-----------|------|
| `push` | −0.25 (early) | **Mint / light green** `#b8f0a0` (CFG `pocketColPush`) | Lean in — cool “go early”; lighter than hit PERFECT green |
| `on` | 0 | **Rail / bone** `#9fd8ff` or existing hit-line bone (CFG `pocketColOn`) | Dead center — no pink/mint |
| `layback` | +0.25 (late) | **Pink / rose** `#ff8ab8` (CFG `pocketColLay`) | Sit back — warm complement to mint |

**Avoid:** blood red (wrong-key spoil), toxic PERFECT green (`#74e84a`) for the pocket mark (reserve for confirmed hits).

---

## 4. Geometry (how ±¼ maps to diameter)

Existing model in `drawWasdLane` (simplified):

- Note **center** (on) when approach offset `off = 0` → circle radius ≈ **`Rin`** (hit-line).
- Approaching: `off < 0` → radius **larger** than `Rin` (shrinks toward `Rin`).
- Receding / late window: `off > 0` → radius grows slightly outward again + fades.

Pocket ideal `I` in beats (push −0.25, on 0, layback +0.25).

**Target ring radius** = the radius the approach circle **would have** when the player’s raw note offset equals `I` (i.e. when they should tap).

Using the same envelope as the main approach path:

```
// half = half-interval in beat-space for the approach span (pocket mode already uses half≈0.5 when pocketLive)
// Approach branch (off ≤ 0): ra = Rin + f * span, f = min(1, -off / half)
// At off = I (I ≤ 0 for push): f = min(1, -I / half) → ra_push = Rin + (-I/half)*span
// For layback I > 0, the “land” is still at Rin in time, but the *cue* is a ring at the
// radius corresponding to “still this far from the beat” on the approach path:
// treat target display offset for radius as min(I, 0) for pure approach, OR map late
// pocket to a radius slightly outside Rin on the late branch for readability.
```

**Adopted v1 mapping (clear, implementable):**

Let `half` = approach half-span in beats (same as drawWasdLane pocket path; default **0.5**).  
Let `span` = `maxR - Rin` as today.

| Pocket | Target radius `R_t` |
|--------|---------------------|
| **on** | `Rin` |
| **push** (I = −0.25) | `Rin + (0.25 / half) * span`  → larger ring, still approaching |
| **layback** (I = +0.25) | `Rin + (0.25 / half) * span * lateScale` with `lateScale` default **0.55** (match existing late-branch outward factor) so pink sits **just outside** the hit-line, reading “a quarter late” |

So: **layback = pink ring at the diameter that says “you’re still ~¼ beat from the main hit-line,”** and **push = mint ring at the larger diameter for ~¼ early.**

Optional polish: animate `R_t` with a soft pulse (opacity only; not size thrash under reduceMotion).

---

## 5. Per-phase behavior

### 5.1 Establish (`ON THE BEAT`)

- **Main approach ring:** full visibility (current behavior).
- **Pocket target ring:** none (or identical to main — do not draw a second).
- Color: rail / bone only.
- Coach: keep title + count; staff optional one ON row.

### 5.2 Sample / LISTENING

- **Main ring:** visible but slightly softened (e.g. 70% opacity).
- **Triple ghost targets** (faint, non-interactive):
  - mint at push radius  
  - rail/on at `Rin`  
  - pink at layback radius  
- Opacity ~0.28–0.40 each; no “now” emphasis stealing focus from the letter.
- Coach: `LISTENING` + help; staff may show three rows **or** be hidden if circle ghosts are enough (`CFG.pocketStaffMode`: `'full' | 'slim' | 'off'`, default `'slim'`).

### 5.3 Hold (locked pocket) — **primary case**

| Active pocket | Main (on-phase) ring | Pocket target ring |
|---------------|----------------------|--------------------|
| **on** | Full visibility at `Rin` | None extra (main *is* the target) |
| **push** | **Dimmed** (~0.22–0.35 opacity) | **Mint** solid/stroke at push radius — **primary** |
| **layback** | **Dimmed** (~0.22–0.35 opacity) | **Pink** solid/stroke at layback radius — **primary** |

- Target ring stroke weight **≥** main ring when dimmed (e.g. main 2px dim, target 3.5–4.5px bright).
- Letter color may stay WASD lane color; optional subtle tint of letter toward pocket hue (not required v1).
- Hit flash (green/red) still applies to the **pocket** timing, not the demoted main ring.

### 5.4 Reset → establish

- Clear pink/mint targets; restore full main ring.

---

## 6. Conjunction with coach / notes

| Layer | Role | HOLD | LISTENING | ESTABLISH |
|-------|------|------|-----------|-----------|
| **Beat-circle pocket ring** | *When* to press | **Primary** | Triple ghost | Off |
| **Letter glyph** | *Which* key | On | On | On |
| **Coach title + count** | Phase / ACC | On | On | On |
| **Staff notation** | Legend / bar | Slim or off | Slim optional | Slim optional |
| **Floor tint peak** | Peripheral when | Phase-shifted (existing) | On / neutral | On |

Default: **`pocketStaffMode: 'slim'`** — keep phase title + one-row staff max; circle does the teaching.

---

## 7. CFG knobs

```js
// extend existing groove pocket block
pocketCircleCue: true,           // kill-switch for this visual parcel
pocketColPush: 0xb8f0a0,         // mint
pocketColOn: 0x9fd8ff,           // rail-ish
pocketColLay: 0xff8ab8,          // pink
pocketMainDim: 0.28,             // main ring opacity when pocket ≠ on during hold
pocketGhostAlpha: 0.34,          // listening triple ghosts
pocketTargetAlpha: 0.92,         // hold target ring
pocketLateScale: 0.55,           // layback radius factor (match late branch)
pocketStaffMode: 'slim',         // 'full' | 'slim' | 'off'
```

---

## 8. Implementation map

| Concern | Anchor |
|---------|--------|
| Draw target + dim main | `drawWasdLane` (~approach ring block) |
| Phase / active pocket | `_pocketPhase`, `_activePocket`, `pocketLive()`, `pocketIdeal()` |
| Floor alignment | `updateFloorBeat` (already shifts by `pocketCueId`) — verify hold push/lay match circle |
| Coach staff | `pocketStaffHtml` / `pocketUpdateHud` — respect `pocketStaffMode` |
| Reduce motion | Prefer static radii + opacity; no thrash |

### Draw sketch

```js
// inside drawWasdLane when showHud && pocketLive() && pocketCircleCue
const I = pocketIdeal(pocketCueId()); // establish/sample cue on; hold = active
const half = 0.5, span = maxR - Rin;
function radiusForIdeal(ideal){
  if(ideal <= 0) return Rin + Math.min(1, (-ideal)/half) * span;
  return Rin + Math.min(1, ideal/half) * span * (CFG.pocketLateScale||0.55);
}
if(_pocketPhase === 'sample'){
  // stroke three ghosts at radiusForIdeal(-o), Rin, radiusForIdeal(+o)
} else if(_pocketPhase === 'hold' && _activePocket !== 'on'){
  // dim main approach stroke alpha *= pocketMainDim
  // stroke target at radiusForIdeal(I) with pocket color, higher alpha
} // establish / hold-on: existing main only
```

---

## 9. Acceptance

1. **Establish:** one rail approach ring; no pink/mint targets.  
2. **LISTENING:** three faint rings (mint / rail / pink) at early / center / late diameters; coach says LISTENING.  
3. **HOLD · PUSH:** mint ring larger than `Rin`; main ring clearly dimmer; freeze grades early.  
4. **HOLD · LAYBACK:** pink ring just outside / late diameter; main dimmer; freeze grades late.  
5. **HOLD · ON:** no second ring; main full strength.  
6. Open-window / juke / fire still peak on absolute 1 (`grooveFireEarlyBeat` untouched by this parcel).  
7. Trainer: no pocket circle cues (`!pocketLive()`).  
8. `pocketCircleCue:false` → legacy single-ring draw.

---

## 10. Tests

- Contract: CFG colors / `pocketCircleCue` / `drawWasdLane` references to push/lay radii present.  
- Optional pure: `radiusForIdeal(-0.25) > Rin`, `radiusForIdeal(0.25) > Rin`, `radiusForIdeal(0) === Rin`.

---

## 11. Summary (canonical)

1. **HOLD** expects a pocket → draw **mint** (early) or **pink** (late) **target ring** at the ±¼ diameter; **dim the main on-ring**.  
2. **LISTENING** → faint triple ghosts.  
3. **ESTABLISH** → main ring only.  
4. Coach stays; staff slim/optional. Floor stays phase-aligned.  
5. Combat beat / open-window stay absolute.
