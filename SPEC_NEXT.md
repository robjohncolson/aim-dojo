# Aim Dojo — Next Features Spec (juice / self-ghost / per-target arc / orbs / wind)

Agreed direction after the session where the ARC daily landed and the game became "genuinely
addicting." User wants **all of it**; build order below. Everything is build-blind (see
CONTINUATION_PROMPT.md constraints) — verify by syntax + logic, user playtests.

## Build order — ALL FIVE SHIPPED ✅ (awaiting playtest + tuning)
1. ✅ **Juice pass** (color lift + clutch flourish) — `368bd4f` (clutch burst color fixed in `503e9b6`).
2. ✅ **Self-ghost** (race your own best, DAILY only) — `368bd4f`.
3. ✅ **Per-target ideal arc** (scope HUD "IDEAL loft · peak") — `a5819f6`.
4. ✅ **Special orbs** (gold bonus + don't-hit decoy) — `fa42b21`.
5. ✅ **Wind** (free-play prototype, opt-in `?wind`) — `b517d4b`.

**ALL ROADMAP FEATURES BUILT.** Every one is build-blind (verified by syntax + logic + numeric checks +
multi-lens adversarial reviews; 0 confirmed findings each) — **the user playtests + tunes by ear/eye.**
**START HERE next session:** ask the user how each feature FEELS and tune the CFG values (see each §). Then the
remaining open work is the **promotions / deferrals** below — none are roadmap-blocking.

### Open follow-ups (post-playtest, not roadmap-blocking)
- **Tune by playtest:** clutch (freq/zoom/slow), combo glow, decoy/gold rates, wind feel — all CFG.
- **Promote wind to the daily?** (currently free-play-only, opt-in). Needs SEEDED wind + a HUD strength shown to
  all — same clean-cutover pattern as special orbs (a future `specialDailyTs`-style gate). User must greenlight.
- **Free-play self-ghost** (deferred — free-play records no ghost + has no shared seed; see §2).
- **Documented prototype gaps (low, accepted):** (a) the §3 IDEAL scope readout is WIND-NAIVE — only matters under
  opt-in free-play wind; the ribbon + LOCK are wind-correct. (b) menu clouds keep the last free-play run's wind
  drift until the next run resets it (cosmetic, opt-in, self-correcting; daily unaffected). (c) reduceMotion + `?wind`:
  the arc ribbon is suppressed (pre-existing reduceMotion behavior) but wind is active + the wind HUD still shows.

---

## 1. Juice pass

> ✅ **SHIPPED (368bd4f) — as built (build-blind; tune by eye/playtest):**
> - **Color lift:** a fixed warm vignette `#comboGlow` (CSS radial-gradient, NORMAL alpha, pointer-events:none,
>   z-index:2) whose opacity rides a smoothed module var `glowI`. `glowI` eases toward `min(1, streak/glowStreakFull)`
>   rise-fast/fall-slow via `1-exp(-dt*K)` (K=`glowRiseK`/`glowFallK`). Updated every frame in `animate` (always-run
>   section), `!reduceMotion` gated, throttled style write (Δ>0.004). Tunables: `comboGlow`, `glowMax:0.40`,
>   `glowStreakFull:16`, `glowRiseK:10`, `glowFallK:2.6`. NO WebGL-canvas CSS filter (perf/DPR risk) — overlay only.
> - **Clutch flourish:** trigger = **long-range OR last-second** (user's pick; `CFG.clutchAnd:false` → flip true for
>   far AND late). Detected in `gradeRhythmHit` (good hit; `far=range>clutchRange || late=beats>=clutchLateBeats`)
>   and `onHit` (range-only, hunt has no beat). `triggerClutch(tg)` fires a **localized camera FOV punch**
>   (`clutchT`/`clutchDur` timer read in the camera block: `camera.fov = camFovBase - clutchZoom*env`, short attack
>   then ease-out, restored EXACTLY to `camFovBase` on end; `camFovBase` synced in `applySettings`), a camera-facing
>   **shockwave ring** (`clutchRing`, one reused LineLoop), and routes the kill through `killTarget(tg, true)` →
>   `explodeAt(pos, radius*clutchBurst, CLUTCH_COLOR, clutchSlow)`. **Explosion-only slow-mo:** `rec.slow` →
>   `edt = dt*(e.slow||1)` in the explosion loop ONLY. **RHYTHM-SAFE proof:** `dt` is never reassigned; `state.t+=dt`,
>   `Tone.Transport`, and the spawn scheduler all use real `dt`. Cooldown `_clutchLast` vs `clutchCooldown:1.1`.
>   Tunables: `clutch`, `clutchAnd:false`, `clutchRange:22`, `clutchLateBeats:2.4`, `clutchCooldown:1.1`,
>   `clutchTime:0.34`, `clutchZoom:9`(°), `clutchSlow:0.42`, `clutchBurst:1.7`, `clutchRingTime:0.5`.
> - **Reduce-motion:** the clutch flag itself is `!reduceMotion`-gated in BOTH kill paths (so no punch/ring/slow/bigger
>   burst) and the glow block is gated — reduced-motion runs are fully neutral.
> - **Note:** the FOV punch briefly (~0.34s) re-projects HUD (ghost/scope/arc) since they read the projection matrix —
>   coherent zoom, not a bug; never affects aim/grading (shot dir = camera world dir, sens is FOV-independent).
> - **Playtest Qs for user:** clutch frequency (cooldown/OR feel), zoom intensity (`clutchZoom`), slow-mo amount
>   (`clutchSlow`), glow intensity/ramp (`glowMax`/`glowStreakFull`).

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

> ✅ **SHIPPED (368bd4f) — DAILY flavor only (as built):**
> - Cyan reticle `#selfGhostRet` + label `#selfGhostName` ("◆ your best · N kills"), distinct from the purple
>   opponent ghost + green live opponents. `updateSelfGhost(dt)` mirrors `updateGhost` (same quant/dequant, same
>   centisecond `h` flash), called in the `animate` daily branch; gated to `state.challenge && state.running`.
> - Stored OFFLINE in `localStorage['aimdojo.selfghost'] = {day, score, rec:ghostRec}`, **daily-keyed** (`o.day===dayKey()`
>   → resets each UTC day; a worse run never overwrites a better same-day best). `loadSelfGhost()` (sync) at
>   `startChallenge`; `saveSelfGhost()` at `endChallenge` while `ghostRec` is still valid; cursor `selfGhost.hi` reset
>   in `resetSession`; reticle+label hidden on endChallenge/exitChallenge/resetSession-else.
> - **DEFERRED: free-play flavor.** Free-play records NO `ghostRec` (gated to `state.challenge`) and has no shared
>   seed, so a free-play "race" isn't apples-to-apples. To add later: turn on recording in free-play rhythm
>   (resetSession + the animate aim-record branch), a non-challenge `updateSelfGhost` gate, and a tempo/all-time key.
> - **Playtest Q for user:** is the cyan-vs-purple reticle distinction clear? Want a free-play version next?

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

> ✅ **SHIPPED (`a5819f6`) — as built:** in `updateScope`, for the LOCKED target, lead-iterate the intercept point
> (`Q = Tt + vel*t`, 4×) then **closed-form solve the lofted launch ANGLE at the fixed `projSpeed`** (high-arc
> root of the projectile-range discriminant) → `#scopeHud` shows `IDEAL <loft>° loft · peak <apex>` (or `out of
> range` past `s²/g ≈ 36 m`). Read-only HUD; no rng/clock/scoring → daily deterministic. Solve verified numerically
> (the parabola passes through the target at the solved angle). **Gap:** wind-naive (see §5 / follow-ups) — only
> matters under opt-in free-play wind.

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

> ✅ **SHIPPED (`fa42b21`) — as built:** `tg.kind` 0=normal / 1=GOLD / 2=DECOY. Per-kind SHARED materials
> (gold/decoy core+shell) swapped onto the pooled mesh each spawn; kind-colored bursts (`KIND_COLOR` hex →
> `explodeAt`). **GOLD** = worth `goldScore` (2) kills; pushes `goldScore` matching `ghostRec.h` entries so
> **`score === h.length` holds** (server-safe; verified against `server/server.js` `score≤h.length` + `h≤8/s`).
> **DECOY** = hitting breaks streak + costs a shot (never scores; `gradeRhythmHit`/`onHit` short-circuit);
> **dodging (expiry) is free** (`onExpire` neutral for kind 2); the firing computer (`scopeLockTarget`) ignores
> decoys. **Determinism:** the kind roll consumes `rng` ONLY when special orbs are LIVE, **latched once per run**
> in `resetSession` (`_specialLive`) → today's seeded daily stream is byte-identical; the daily gets special orbs
> from the next UTC midnight (`specialDailyTs = Date.UTC(2026,5,22)` → fresh seed, clean cutover). Free-play: live
> now. CFG: `specialOrbs`, `goldChance:.06`, `decoyChance:.10`, `goldScore:2`. **Playtest:** gold/decoy RATES + the
> ×2 value; gold is same-size for now (could add smaller/faster per the original spec).

- Add `tg.kind` in `spawnTarget` — **seeded via the existing `rng`** so the daily stays deterministic.
  - **Golden bonus orb** — rare, 2–3× score, maybe smaller / faster expiry. Pure upside.
  - **Decoy orb** (don't-hit) — hitting it breaks streak / costs. Adds target SELECTION.
- Hooks: `spawnTarget` (kind + distinct mesh tint), scoring in `gradeRhythmHit`/`onHit`, mark them in
  the floor HUD / scope. Effort: medium. Risk: low–medium (touches scoring + spawn; daily fine as long
  as kind comes from `rng`).

---

## 5. Wind (LAST — cautious; must move clouds too)

> ✅ **SHIPPED (`b517d4b`) — FREE-PLAY PROTOTYPE, OPT-IN** (`?wind`/`#wind` URL flag, or `CFG.wind:true`). A gentle
> constant per-run horizontal wind (`windX/windZ`, `windMin:0.4`–`windMax:0.9` m/s²), set in `resetSession` for
> free-play only. **The daily + any non-opted-in run keep `windX=windZ=0` → ballistics + clouds bit-identical**
> (every added term is `+0`; verified). All four spec requirements done:
> 1. **Projectile:** wind accel in `updateProjectiles`.
> 2. **Clouds:** new `uWind` vec2 uniform in `skyDomeMat` (`uTime*uWind`); default `(0.006,0.004)` == the old
>    hardcoded drift; `updateSky` sets it to `wind*windCloudK` when active → clouds drift along the wind.
> 3. **Firing computer:** wind is in `computeShotPlan` (drifts the eye→crosshair impact `_arcI` so wind is FELT,
>    AND compensates the muzzle back-solve `V.xz -= 0.5*wind*T`), `sampleArc` (ribbon), `simShotHits` (LOCK) →
>    **the bullet still flies exactly down the ribbon** (numerically verified: wind adds ZERO ribbon-vs-bullet error
>    vs the existing gravity discretization).
> 4. **HUD:** `#windHud` — an arrow rotated to the wind direction relative to your view + the strength.
>
> **NOT in the daily yet** (the spec's recommendation: prototype free-play first). To promote to the daily: SEED the
> wind (per-day, not `Math.random`), show the strength to everyone, and gate the cutover (a `specialDailyTs`-style
> future-day gate) so today's board stays clean. **Playtest:** wind STRENGTH (`windMin/Max`), cloud drift speed
> (`windCloudK`) + DIRECTION SIGN (flip `windCloudK` sign if clouds drift the wrong way), and whether the firing
> computer makes it learnable. **Known gaps:** the §3 IDEAL readout is wind-naive; menu clouds keep the last run's
> drift until reset (both low/cosmetic, opt-in).

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
