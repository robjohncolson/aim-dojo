# Tides · Quiet Tick · The Bow — Redesign Wave 1 (session shape)

**Version:** 1.1 · 2026-07-24 (amended 2026-07-25 after the Codex review — see the “**1.1 amendment**” notes in place)
**Branch:** `redesign/moon-chorus` (Vercel preview; merge to `main` only after user playtest)
**Files touched:** `index.html` only. No new assets, no build step, no server changes.
**Origin:** 2026-07-24 redesign panel (6 lenses + 3 judges). Wave 1 = session shape, per user greenlight.
**Decisions locked by user:** single mode (no Nightly Piece front door yet) · minimal zero-numbers Mandala inside the Bow · feature branch.

---

## 0. Product intent

The session stops being an endless ratchet and starts breathing. Three parcels, one theme:

1. **TIDES (Parcel A)** — intensity moves in swells with a mercy bar between them; BPM adapts only at swell boundaries.
2. **QUIET TICK (Parcel B)** — sustained accuracy thins the metronome; a miss brings it back softly. Mastery = the game gets quieter.
3. **THE BOW (Parcel C)** — holster to end the session on purpose: the field rises to the real sky, the music resolves, one zero-numbers Mandala glyph, one true line about tomorrow's sky, done.

The sacred loop is untouched: arrival-judged kills, beat-quantized spawn distances, WASD off-beat lane, dolly, 20 BPM start, spatial audio. Everything here is shape and feedback, not physics.

## 1. Hard constraints (all parcels)

- **Rhythm-safe:** never scale `dt` or `Tone.Transport` for an *effect*. (Exception: the Bow's closing ritardando is a real musical tempo change AFTER play has ended — spawns stopped, no grading active.)
- **Kill-switches:** each parcel has a single boolean in CFG (`tide.on`, `quietTick.on`, `bow.on`). With all three `false`, runtime behavior must be equivalent to today's (every added term multiplies by 1 / adds 0 / early-returns). **1.1 amendment:** on the *hot* paths (`animate()`, `onGrid()`, `updateSky()`) the raw CFG boolean is read **at the call site, before the call** — `CFG.tide.on ? tideMul(…) : 1`, `if(CFG.bow.on) bowClock(dt)` — so an off parcel costs one boolean per frame and performs no call and no tide read. The functions keep their own guards as defense in depth.
- **Zen contract:** no new settings UI, no HUD counters, no meters. All tunables are CFG consts with inline decision comments (house style). New player-facing strings go through `T()` with `window.JA` keys (see SPEC_MOON_CHORUS_UI mechanism) — EN baked, JA in the flat override object.
- **Trainer untouched:** SENSEI trainer phases (pre-graduation) keep their didactic pacing. Tides + Quiet Tick activate only after full graduation (`applySenseiFull` state). The Bow is also post-graduation only.
- **Sky Temple untouched:** none of the three systems run while `templeActive`. **1.1 amendment:** this includes the tides' *followers*, not just their read-sites — `tideLive()` itself carries `!templeActive`, so `_tideTint` freezes for the Temple's duration and resumes from the exact value the last dojo frame drew (frozen, not decayed: that is the only variant with no first-frame jump on exit).
- **reduceMotion:** Bow animations degrade to static fades; tides' *visual* breathing (floor tint, vignette coupling) gates on `!reduceMotion`; audio behavior unaffected.
- **Verification:** `node --check` equivalents for touched JS (the inline script can be smoke-checked by extracting or by careful review), `node --test tests/*.test.js` still green, and the CFG contract test regex must keep parsing (keep new CFG sub-objects FLAT literals, same as `skyMaps`).
- **Text budget:** the Bow line is THE one session-boundary line. No other new toasts.

## 2. Parcel A — TIDES

### Design
An intensity envelope `tideI ∈ [0..1]` derived from Transport bar position, cycling: **rise `tideRiseBars` (6) → peak `tidePeakBars` (2) → mercy `tideMercyBars` (1)**. During mercy: no new spawns; existing orbs live out; the arrangement blooms (pad swell); the floor tint exhales.

What breathes with `tideI` (multipliers read at existing read-sites, never new state machines):
- **Density:** effective `densityScale × lerp(tideDensityLo, 1, tideI)` (mercy forces 0 via the spawn gate, not the multiplier).
- **Dolly:** effective `dollyStrength × lerp(tideDollyLo, 1, tideI)`.
- **Wander/juke sharpness:** `brownianMax` and juke amplitude scaled the same way.
- **Juice gating:** clutch flourish eligible only at `tideI ≥ tideClutchGate` (peaks feel like peaks).
- **Audio:** pad/arp velocity gets a `tideI`-shaped lift at peaks; mercy bar triggers the pad bloom (reuse the existing tier/pad machinery in `onGrid`, do not add a new synth).

### BPM at boundaries only
Move the per-event `changeBpm` application (currently in the accuracy-window block near `windowAccuracy()`/`changeBpm()`, ~line 4152) to fire **once, at the mercy→rise boundary**, using the same `windowAccuracy()` law (`upThreshold`/`downThreshold` unchanged; `bpmUp` may need retuning upward since it now applies ~per-9-bars instead of per-event — expose as `tideBpmUpMul`, first guess 2.0). Mid-swell the tempo never lurches. `tide.on:false` restores the per-event path exactly.

### CFG (flat literal, house style)
```
tide:{ on:true, riseBars:6, peakBars:2, mercyBars:1, densityLo:0.45, dollyLo:0.5,
       brownianLo:0.55, clutchGate:0.75, padPeakVel:0.12, bpmUpMul:2.0, tintExhale:0.35 }
```

### Integration anchors
- Spawn scheduler (beat-pattern block reading `densityScale` / `minGap` / `patternConcurrency`): add the mercy-bar spawn gate + density multiplier.
- `animate()` camera dolly block (~5236): dolly multiplier.
- `onGrid` (~3989): compute bar phase → `tideI`; boundary detection for BPM step; pad bloom on mercy downbeat.
- Floor tint / mood lerp (~1539, 1571): mercy exhale, `!reduceMotion` gated.

### Acceptance
- `tide.on:false` → per-event BPM law byte-path identical; no tide reads anywhere hot.
- Mercy bar: zero new spawns for exactly `mercyBars`; in-flight orbs and grading unaffected.
- BPM changes only at boundaries; `state.maxBpm` bookkeeping unchanged.
- No `dt` / Transport scaling anywhere in the parcel.

## 3. Parcel B — QUIET TICK

### Design
A smoothed mastery signal `tickI` (rise SLOW on sustained accuracy, fall FAST on a miss — deliberately the inverse easing of `grooveI`) drives metronome thinning tiers:
- **Tier 0** (`tickI < t1`): tick every beat (today's behavior).
- **Tier 1** (`tickI ≥ t1`): tick on beats 1 & 3 only.
- **Tier 2** (`tickI ≥ t2`): tick on beat 1 of each bar only.

A miss doesn't slam the tick back: the tick's own `Tone.Volume` ramps up over ~1 beat (mercy, not klaxon). Thinning likewise fades the skipped ticks out over a bar rather than hard-gating (implement as per-tick velocity shaping in `onGrid`, plus the volume node for the return ramp).

Mercy-bar handoff (integration with Parcel A): at Tier ≥ 1, the LAST TWO beats of a mercy bar are tick-silent regardless of tier — the player carries the count into the next swell.

Trainer: disabled (trainer keeps loud didactic ticks). Also hard-disabled below `quietTick.minBpm` (first guess 40 — at the 20 BPM floor the tick is load-bearing).

### CFG
```
quietTick:{ on:true, t1:0.55, t2:0.85, riseK:0.06, fallK:0.6, returnBeats:1, minBpm:40, mercyCarryBeats:2 }
```

### Integration anchors
- `onGrid` (~3989): tick trigger site — tier gate + velocity shaping. The tick synth (~3752) gains a dedicated `Tone.Volume` for the soft-return ramp.
- Miss paths (`gradeRhythmHit` bad-arrival branch, whiff/expire paths): drop `tickI` via `fallK`.
- Hit path: raise `tickI` via `riseK` per on-arrival kill.
- `resetSession` (~6344): `tickI=0`.

### Acceptance
- `quietTick.on:false` → tick behavior identical to today.
- Tick never fully disappears at Tier 2 (beat 1 always sounds) except the mercy-carry beats.
- The WASD lane's audible cues and `shotCue` are untouched — only the metronome tick thins.
- No tier announcement of any kind (no toast, no HUD): the thinning IS the information.

## 4. Parcel C — THE BOW (+ minimal Mandala)

### Trigger
Post-graduation, running, not in temple, not paused: **no fire AND no WASD tap** for `max(bow.holsterBeats beats, bow.holsterMinSec seconds)`. During the first `bow.cancelGraceSec` of the sequence, any fire/tap cancels the Bow and play resumes seamlessly (spawns re-enable; nothing was destroyed yet). After grace, it plays out (~10–12 s) and lands on the start/pause overlay via the existing exit path.

**1.1 amendment (trigger is unconditional):** the trigger does NOT depend on the run having scored. A hitless holster still ends the session — it simply **skips the Mandala stage** (see Sequence). Gating the trigger on “has dots” made a hitless night unbowable, which contradicts this contract.

**1.1 amendment (a completed Bow is a session boundary):** when the sequence runs to `bowFinish`, it sets `state.needsReset` — the SAME flag the fresh-start path in `enterRunning()` reads — so the next entry runs `resetSession()` and the night starts over at `CFG.startBpm`. The overlay's primary button and eyebrow read the same flag, so a finished night offers “A NEW NIGHT”, never “RESUME”. An ESC-pause or a grace-cancel goes through `bowReset()` alone and never sets it: pause and Bow remain distinct exits.

### Sequence (all timings CFG)
1. **Spawns stop.** New-spawn gate closes (reuse the tide mercy gate mechanism).
2. **Last Light.** Remaining live orbs stop being targets (no grading) and rise — one per beat, spawn-order — lerping outward along their azimuth toward the sky shell, fading to points of light. `reduceMotion`: they simply fade in place.
   **1.1 amendment (the fade is real):** opacity lives on the *shared* orb materials, so each rising orb gets a **cloned core + shell material** at the stage transition (a one-shot allocation at a transition is within the perf rule; nothing is cloned per frame) and its opacity is animated to 0 across the rise. Normal path = travel outward **+ fade**; `reduceMotion` = **no position and no scale animation at all**, a pure in-place opacity fade. **Mesh scale is never animated in either path** (an animated shrink read as a pop). `bowDropMats` puts the shared materials back on the mesh *before* `removeTarget`, then disposes the clones — the mesh pool must never receive a clone.
3. **Ritardando.** Over ~2 bars, `Tone.Transport` bpm eases toward `startBpm`, the arrangement thins (drop hat/snare, keep pad + bass root), and the theme resolves to its tonic — reuse the existing chord/theme machinery; end on one held pad note. This is the ONE sanctioned Transport tempo change (play has ended).
4. **The Mandala.** *(Skipped entirely when the run scored nothing — no canvas, no per-frame draw; the sequence becomes rise → ritardando → line → finish. 1.1 amendment.)* A center-screen canvas glyph fades in (~4 s): one dot per scoring hit this run (cap `bow.mandalaMaxDots`, most recent), **angle** = signed beat-phase arrival error mapped across `±bow.mandalaArcDeg` around vertical, **radius** = that shot's subdivision k normalized to the run's k-range. Moonlight monochrome, alpha per recency. **NO axes, NO labels, NO numbers, NO comparison to any previous run.** Then it drifts upward and dissolves (static fade under `reduceMotion`). Data source: push `{errMs, k}` per scoring hit into a capped run-local array (`gradeRhythmHit` good path; k is known at spawn — carry on the target).
5. **The line.** One `showGhostToast` — *with the `holdSec` argument, which swaps in the `#ghostToast.show-slow` variant (same look, long hold plateau, `animation-duration` driven from `lineHoldSec+1`). The default toast animation fades at 1.5 s, so `lineHoldSec:4` was invisible. Only the Bow line uses it; every other toast is untouched. (1.1 amendment.)* — with a TRUE next-night sky fact computed client-side from the existing ephemeris (moon phase tomorrow / moonrise direction / a bright mover above the horizon tomorrow evening — implementer picks the cheapest reliable fact from the local sky code already in `index.html` + `local-sky.js`; NO network dependency; fallback line if sky data is unavailable). EN baked + `JA` keys. Template pool, pick deterministically by date.
6. **Sensei bows.** The ✦ glyph pulses once (reuse `trainCoach`/overlay chrome, no new UI surface), pointer unlocks to the existing start/pause overlay. Session over.

### CFG
**1.1 amendment:** the shipped literal carries five knobs the 1.0 list omitted (`riseBeats`, `beatCapSec`, `ritMaxSec`, `lineAtMandala`, `senseiSec`). Spec and code now agree:

```
bow:{ on:true, holsterBeats:8, holsterMinSec:12, cancelGraceSec:1.5, riseBeatsPerOrb:1, riseBeats:2,
      ritBars:2, beatCapSec:0.75, ritMaxSec:8, mandalaSec:4, mandalaMaxDots:60, mandalaArcDeg:90,
      lineAtMandala:0.6, lineHoldSec:4, senseiSec:1.0 }
```

- `riseBeats` — each orb's own flight time to the shell (in stagger beats), separate from `riseBeatsPerOrb`, which is only the gap *between* orbs.
- `beatCapSec` — **seconds** cap on the Last Light stagger beat: `stagger = min(one real beat, beatCapSec)`. Scoped to the *visual* rise cadence only, so it cannot silently rewrite a beat-named musical timing. (1.0 applied this cap to every ceremony timing, which turned `ritBars:2` into 6 s regardless of tempo — dishonest.)
- `ritMaxSec` — the ritardando is measured in **real Transport bars** (`ritBars × 4 real beats`) and then clamped by this: 2 bars is ~6 s at 80 BPM but would be 24 s at the 20 BPM floor, which is a wait rather than an exhale.
- `lineAtMandala` — fraction into the glyph at which THE line speaks (0 when the Mandala is skipped, i.e. the line opens the stage).
- `senseiSec` — how long the ✦ holds before the pointer unlocks.

### Acceptance
- `bow.on:false` → holstering does nothing (today's behavior).
- The Bow can NEVER fire mid-engagement: any fire/tap resets the holster clock; grace-cancel restores play with zero state loss.
- ESC-pause path unchanged; Bow and pause are distinct exits.
- Transport bpm is restored (via `resetSession`'s normal start path) on the next run — no bleed.
- Mandala renders from run-local data only; nothing persisted (persistence is a later wave).
- Exactly ONE toast line fires per Bow.

## 5. Build order & review loop

Sequential (one file, shared regions): **A → B → C**, each parcel a separate commit on `redesign/moon-chorus` with a syntax/logic verify pass before the next starts. Then a Codex cross-agent review (read-only) of the full branch diff; findings → fix pass → re-review, until green. Then push for Vercel preview and hand to user for playtest + CFG tuning by ear/eye (tide feel, tick thresholds, bow timing are all first guesses — tuning is the user's, per house rule).

## 6. Playtest questions for the user (post-build)

- Tides: does the mercy bar feel like breathing or waiting? (`mercyBars`, `densityLo`)
- Tides: is the boundary-only BPM step legible as "the next wave is taller"? (`bpmUpMul`)
- Quiet Tick: do the thresholds earn silence at the right pace? (`t1`/`t2`/`riseK`)
- Bow: is `holsterBeats:8` + `holsterMinSec:12` ever accidental? Does the grace-cancel feel seamless?
- Mandala: does it read as a glyph (good) or a chart (bad)? If chart — shrink, blur, or cut.
