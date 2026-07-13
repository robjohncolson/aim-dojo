# Codex prompt — Rolling pocket buffer (16) + expected freeze + floor phase

Copy everything below the line into Codex.  
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

---

## Mission

Replace the hard **establish → sample → hold** pocket phase machine with a **rolling intent buffer** and an **expected pocket** that drives freeze credit and floor **peak timing**.

**Zen UI:** floor hue stays the **letter color** (do not recolor by pocket). Rings + staff **off** by default. Toast only when expectation changes.

Be **literal** to the spec. Prefer deleting/bypassing phase UI over leaving dead busy HUD on.

## Required reading (first)

1. **Spec (wins):**  
   `/mnt/c/Users/rober/Downloads/Projects/aim-dojo/SPEC_POCKET_BUFFER.md`
2. Current code: `index.html` — `pocketOnMain`, `pocketOnMainMiss`, `claimWasdNote`, `_wasdResolve`, `updateFloorBeat`, `drawWasdLane` pocket circle, `pocketUpdateHud`
3. Parent context: `SPEC_GROOVE_POCKET.md` (offsets, main-only, heard timeline) — **buffer spec wins** on phase machine conflicts

## Scope — Parcel B1

| ID | Task |
|----|------|
| B1 | CFG: `pocketBufferLen:16`, `pocketMinSamples:8`, `pocketExpectBeats:4`, lead/hysteresis/weakFloor; **`pocketCircleCue:false`**, **`pocketStaffMode:'off'`**; keep `grooveFireEarlyBeat:0` |
| B2 | Per main hit: compute `accOn` / `accPush` / `accLay` with existing acc curve; append to buffer (cap 16); misses append zeros |
| B3 | `expected` starts `on`; every 4 mains recompute winner; switch only with min samples + lead + hysteresis (spec §5–6) |
| B4 | **Freeze:** `_wasdResolve` graded with `offBeats - ideal(expected)` — reward the law, not “always on” |
| B5 | **Floor:** peak phase `wasdBeats - ideal(expected)`; **color remains WASD letter hex** — no pocket recolor |
| B6 | Remove/disable establish·sample·hold coach panel, staff, and pocket circle as default free-play surface; toast only on `expected` change (`ON THE BEAT` / `LEAN EARLY` / `SIT BACK` or T keys) |
| B7 | Keep `claimWasdNote` main-binding for ±¼ at high nd; `pocketSweepMisses` still feeds buffer misses |
| B8 | `resetPocketState` / run reset: clear buffer, `expected=on`, bar counters |
| B9 | Trainer/mobile: buffer idle (`pocketLive` false) |
| B10 | Tests: intent ordering, buffer cap, expected gates, freeze uses expected, floor not recolored by pocket; suite green |

## Out of scope

- Orb open-window / juke / fire quant changes  
- Mint/pink floor or mandatory beat-circle targets  
- Server persistence of pocket  
- Rewriting letter combo generation  

## Critical product rules

1. **No sacrificial listening mode** — every main can freeze if it matches **current expected**.  
2. Changing feel → temporary weak freeze → after ~16 taps + bar gates, expected moves → freeze + floor phase settle.  
3. **Floor color = letter. Floor timing = expected phase.**  
4. **Rings/staff off** unless player opts into BEAT CIRCLE for training (circle cue stays false by default).

## Verification

1. Cold start: on-center freezes hard; early taps softer.  
2. Stay early for ~16+ mains across a few bars → toast LEAN EARLY; early freezes hard; floor peaks early, **same key color**.  
3. Return to center → soft then settle ON THE BEAT.  
4. No permanent top staff / no mint-pink fixed rings in default free-play.  
5. Open-window still on the 1.  
6. `node --test tests/*.test.js` passes (update/remove obsolete establish-sample-hold tests).

## Checklist

- [ ] B1–B10  
- [ ] Spec §13 acceptance  
- [ ] No floor pocket-recolor  
- [ ] No open-window coupling  
- [ ] Phase machine gameplay retired
