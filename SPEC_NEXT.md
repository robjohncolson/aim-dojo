# Aim Dojo — Next Features Spec (juice / self-ghost / per-target arc / orbs / wind)

Agreed direction after the session where the ARC daily landed and the game became "genuinely
addicting." User wants **all of it**; build order below. Everything is build-blind (see
CONTINUATION_PROMPT.md constraints) — verify by syntax + logic, user playtests.

## Build order (recommended)
1. **Juice pass** (color lift + clutch flourish) — fast, big feel, low risk. ← START HERE
2. **Self-ghost** (race your own best) — high addiction value, mostly reuse.
3. **Per-target ideal arc** — firing-computer depth (user is curious about this number).
4. **Special orbs** — variety.
5. **Wind** — LAST, free-play prototype first (user is cautious; must move the clouds too).

Do **1 + 2 together** first (both low-risk, immediately felt), then 3, 4, and treat 5 as opt-in.

---

## 1. Juice pass

### Color lift as the combo climbs
- Tie a screen-edge vignette glow + subtle scene color/saturation lift to `state.streak`,
  SMOOTHED (mirror the audio `grooveI` easing: rise fast, fall slow).
- Impl: a fixed full-screen gradient/vignette `<div>` overlay whose opacity/hue rides a new
  smoothed `glowI` (updated in `animate`). Low streak = neutral; high = warm glow from the edges.
- **Gate on `!reduceMotion`.** Pure overlay → low risk.

### Clutch flourish on a big ARC hit
- ⚠️ **RHYTHM-SAFE — do NOT scale `dt`/the master clock.** Tone.Transport drives the beat;
  global slow-mo would desync the music. So the "slow-mo" is a LOCALIZED effect:
  - camera "punch" (quick zoom-in + ease-out) via a `clutch` timer read in `animate` (where the
    camera fov/position is set, ~the `camera.rotation.set`/`camera.position.set` block).
  - bright shockwave ring + bloom/flash at impact.
  - the **kill explosion** plays in slow-mo (scale ONLY the explosion/particle timers, not game/audio).
- Trigger: at the projectile-collision site (`updateProjectiles`, the `if(hit){...}` branch) or in
  `gradeRhythmHit`. Compute range = `tg.mesh.position.distanceTo(PLAYER_POS)`; "last-second" = the
  `beats` value near 3 (late in the window) and/or a big `lead`.
- **OPEN Q (asked user):** trigger = "long-range (>~22m) OR last-second"? or rarer (only the truly
  clutch — far AND late)? Default to the OR unless told otherwise.
- Effort: medium. Risk: low IF kept off the master clock.

---

## 2. Self-ghost — race your own best

- You already record `ghostRec = {a:[aim@20Hz quantized], h:[scoring-hit times, centisec]}` during a
  run (in the `animate` challenge branch + `gradeRhythmHit`). `loadGhost`/`updateGhost` already play
  the TOP-scorer ghost as a purple reticle (`#ghostRet`).
- Add a SECOND ghost slot = YOUR best run, stored in `localStorage`, replayed with a DISTINCT color
  (e.g. green/your-color reticle, a new `#selfGhostRet` el + an `updateSelfGhost` mirroring updateGhost).
- Two flavors:
  - **Daily:** your best on TODAY'S seed → key localStorage by `dayKey()` (resets daily).
  - **Free-play:** all-time best (or best near the same tempo).
- Save on run end if improved: in `endChallenge` (daily) / the free-play run-end path, compare score,
  store `JSON.stringify(ghostRec)` to localStorage. Load it at run start (like `loadGhost`).
- Works fully OFFLINE (no Supabase). Effort: low–medium (reuse the ghost playback). Risk: low.

---

## 3. Per-target ideal arc (firing-computer upgrade)

- TODAY: the target height label gates on `_arcApexY` = the apex of YOUR CURRENT aim's parabola (one
  value vs every target). User is curious about a PER-TARGET ideal arc instead.
- Per target, SOLVE the lob that hits it, show its ideal numbers ("this orb needs a peak of X m / Y°
  loft"). Reuse the **removed aim-pip lead-solve** (in git history — it iterated the launch direction
  to hit a target's lead at `projSpeed`; from that launch, apex = `M.y + vy²/(2g)`).
- Run for the **locked/nearest target first** (cheap; `scopeLockTarget`), optionally a faint readout
  on others (throttled, a few/frame). Show required apex and/or required elevation; the height label
  could read "needs ↑X" vs the target's actual height.
- Effort: medium (ballistic solve per target). Risk: low (read-only HUD).

---

## 4. Special orbs (variety)

- Add `tg.kind` in `spawnTarget` — **seeded via the existing `rng`** so the daily stays deterministic.
  - **Golden bonus orb** — rare, 2–3× score, maybe smaller / faster expiry. Pure upside.
  - **Decoy orb** (don't-hit) — hitting it breaks streak / costs. Adds target SELECTION.
- Hooks: `spawnTarget` (kind + distinct mesh tint), scoring in `gradeRhythmHit`/`onHit`, mark them in
  the floor HUD / scope. Effort: medium. Risk: low–medium (touches scoring + spawn; daily fine as long
  as kind comes from `rng`).

---

## 5. Wind (LAST — cautious; must move clouds too)

Feasible WITH cloud consistency, but the biggest because it must touch four things honestly:
1. **Projectile:** wind accel in `updateProjectiles` (and the prediction below, or arc≠bullet).
2. **Clouds:** the sky already has PROCEDURAL drifting clouds (FBM in `skyDomeMat` frag, the line with
   `vec2 cuv=vDir.xz/el*0.55+vec2(uTime*0.006,uTime*0.004)`). Replace the hardcoded drift with a
   `uWind` uniform × time → clouds drift along the wind. Small shader change.
3. **Firing computer:** `computeShotPlan` / `sampleArc` / `simShotHits` MUST include wind, or the drawn
   ribbon won't match the bullet (breaks the "bullet flies exactly down the ribbon" invariant). ← the real work.
4. **Daily determinism:** wind must be SEEDED (same for everyone) + shown on the HUD (a wind arrow/strength).
- **Recommendation:** prototype FREE-PLAY only first, gentle wind, nail the feel + cloud sync, THEN
  consider the daily. Effort: high. Risk: medium–high.

---

## Notes / decisions captured
- User loved: clutch slow-mo + color lift (juice) and the self-ghost loop ("all of it").
- User cautious on wind; firm that wind MUST reflect in cloud movement.
- User curious specifically about the per-target ideal-arc NUMBER.
- Slow-mo MUST be rhythm-safe (localized, not master-clock) — this is the key gotcha.
