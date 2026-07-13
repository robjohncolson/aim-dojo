# Codex prompt — Pocket beat-circle cue (visual)

Copy everything below the line into Codex.  
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

---

## Mission

Implement the **pocket beat-circle visual cue** for free-play WASD in Moon Chorus (`index.html`).

When the groove pocket machine is in **HOLD** with push or layback, draw a **phase-colored target ring** at the diameter that means “±¼ beat from the main hit-line,” and **dim the main on-phase ring**.  
**LISTENING** shows faint triple ghosts (mint / rail / pink). **ESTABLISH** keeps a single main ring.

Be **literal** to the spec. Small, reviewable diff. Do **not** touch orb open-window, juke, or Transport phase.

## Required reading (first)

1. **Spec (wins):**  
   `/mnt/c/Users/rober/Downloads/Projects/aim-dojo/SPEC_POCKET_BEAT_CIRCLE.md`
2. Parent gameplay (already shipped — do not reimplement unless broken):  
   `/mnt/c/Users/rober/Downloads/Projects/aim-dojo/SPEC_GROOVE_POCKET.md`
3. Anchors in `index.html`:
   - `drawWasdLane` (Rin, approach/recede envelope, `pocketLive`, cueI)
   - `_pocketPhase`, `_activePocket`, `pocketIdeal`, `pocketCueId`
   - `updateFloorBeat` (already phase-shifts floor — keep aligned)
   - `pocketUpdateHud` / `pocketStaffHtml` (staff mode slim/off)
   - CFG groove pocket block near `groovePocket` / `grooveFireEarlyBeat` (must stay **0** for combat open)

## Scope — Parcel C1

| ID | Task |
|----|------|
| C1 | CFG: `pocketCircleCue`, `pocketColPush` / `On` / `Lay`, `pocketMainDim`, `pocketGhostAlpha`, `pocketTargetAlpha`, `pocketLateScale`, `pocketStaffMode` |
| C2 | Helper `radiusForIdeal(I)` matching spec §4 (push larger than Rin; layback just outside via lateScale; on = Rin) |
| C3 | **HOLD · push:** mint target ring primary; main approach ring dimmed to `pocketMainDim` |
| C4 | **HOLD · layback:** pink target ring primary at late diameter; main dimmed |
| C5 | **HOLD · on:** no second ring; main full strength |
| C6 | **LISTENING:** three faint ghosts at push / on / lay radii |
| C7 | **ESTABLISH:** main ring only (no mint/pink targets) |
| C8 | Coach staff respects `pocketStaffMode` (`slim` default; `off` hides staff rows, keep title/count) |
| C9 | reduceMotion: opacity/static radii only; no thrash |
| C10 | Contract or pure tests: radii ordering; CFG + draw path greps; open-window still not pocket-coupled |

## Out of scope

- Changing pocket phase lengths, majority, silent miss, claimWasdNote  
- `grooveFireEarlyBeat` (leave **0**; combat open on audible 1)  
- Sky Listen / combat priority  
- New audio, network, localStorage  

## Colors (defaults)

| Pocket | Hex | Feel |
|--------|-----|------|
| push | `#b8f0a0` | mint / light green — early |
| on | `#9fd8ff` | rail — center |
| layback | `#ff8ab8` | pink — late |

Do not use blood red or PERFECT toxic green for the pocket target.

## Geometry reminder

Existing approach: larger radius → earlier on the path; `Rin` = on-center hit-line.

- **push (−¼):** target radius = `Rin + (0.25/half)*span` with `half≈0.5`  
- **layback (+¼):** target radius = `Rin + (0.25/half)*span*(pocketLateScale||0.55)` — pink ring reads as “quarter beat away / late side of the hit-line”  
- **on:** target = main = `Rin`

## Verification

1. Free-play after trainer graduation (pocket machine on).  
2. Establish: single rail ring.  
3. Listening: three faint mint/rail/pink rings.  
4. Hold push: bright mint outer target; main dim.  
5. Hold layback: bright pink near-outer target; main dim.  
6. Hold on: single full main ring.  
7. Orb glow still peaks on the 1 (not ±¼).  
8. `pocketCircleCue:false` restores pre-parcel ring draw.

## Checklist

- [ ] C1–C10  
- [ ] Spec §9 acceptance  
- [ ] No open-window coupling  
- [ ] Trainer: no cues  
- [ ] Tests pass (`node --test tests/*.test.js`)
