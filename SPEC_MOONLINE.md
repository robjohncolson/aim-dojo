# The Moonline — Season 2, Wave 8 (the rebuild: void, ribbon, arches, tethers)

**Version:** 1.2 · 2026-07-27 (§1.2 amendment added after the Moonline playtest; §1.1 added after first light; §§0-7 are v1.0, unchanged)
**Branch:** `redesign/moon-chorus` (builds on unmerged waves 6-7; supersedes wave 7's road PRESENTATION while keeping its machinery — course seed, clock sync, wake epochs, banking, kill-switch discipline)
**Files touched:** `index.html` (+ regenerated mirror parts per commit). No new assets (everything is shader/line/particle work; the milky way texture already ships), no server.
**Origin:** two user brainstorm sessions 2026-07-26/27 after first light on wave 7 ("does not give a sense of a road"). Every decision below is user-locked; the arches are imagery from the user's own dreams. Honor that.

---

## 0. The vision, one paragraph

Post-graduation play no longer happens in a room. The floor is gone; the Temple's full celestial shell wraps the player above AND below; the only structure in the universe is the Moonline itself — a wireframe ribbon of light carrying tonight's beats to your feet at highway speed, golden astral arches marking the measures, the mercy bar arriving as a complete golden ring, your wake glowing behind you, every Echo hanging from its origin star by a thread of light. The trainer keeps the old room (Sensei's sheltered arc); graduation dissolves the floor from under you onto the road. Permanent. One world.

## 1. Hard constraints

- **Master kill-switch:** `CFG.moonline.on:false` → wave-7 behavior exactly (flat road + old floor + old drop-lines + wave-7 band glyphs). Raw-boolean-first everywhere. All wave-7 road switches/laws inherit (treadmill law, one clock, playability-epoch wake, banking replacement of dolly, temple/trainer hiding).
- **Nothing beside the road but space.** No side objects, no sonar marks, no roadside anything. The arches arc OVER the road, grown FROM it. The skybox gets full glory.
- **Information, never decoration**, with one named exception: arch/ring REFLECTIONS below the road plane are compositional grounding of information-bearing structures (tunable to 0, `moonline.reflectAlpha`). Everything else maps to a fact: cells = beats, colors = lanes, crossbars = sixteenths, arches = bar lines, ring = mercy, dust rate = the sixteenth grid, tether brightness = the open window.
- **Sky honesty:** the shell renders real star positions as the Temple already does; tethers draw to the TRUE current position of the orb's bound star.
- **Cue contract (user regression report, non-negotiable):** the required LETTER lives at the CROSSHAIR with the pre-wave-7 pulsating-glow timing cue restored exactly (wave 7's 55bc45c moved it — read that commit and restore the old behavior); road bands are COLOR-ONLY (no glyphs on the road).
- **Performance is a design pillar this wave:** state a frame budget in the spec-comment (draw calls added, particle counts, line segments at drawBeats:32), pay for the dust by halving the hit-flock particle budget (CFG `shards` and kin — behavior unchanged, counts down), LOW-REZ path mandatory (dust off, arches simplified to plain arcs, impostor always, shell at reduced res as the temple LOW path already does). No per-frame allocations anywhere new.
- All inherited process: flat CFG with decision comments, zero new text (JA n/a), gitnexus impact before edits, mirror parts regenerated per commit, tests green (extend the road suite for new laws), feasibility numbers computed not asserted.

## 1.1 amendment — THE BREATH (wave 8.1)

**Origin:** user first light on wave 8, 2026-07-27, unprompted and specific: *"before, the playing field was the color and it had a mesmerizing increase in saturation up until the correct fire time, and that helped gauge timing — without it, it's hard."*

**What was lost.** Before wave 7 the whole field carried a beat cue: `CFG.floorBeat` / `floorBeatMax` washed the checker (by day) and the night lattice (by night) with a swell that rose into each beat and released after it (`e4faf65`, "WASD-rhythm: floor beat-tint"). Wave 7 hid the surfaces it painted under the road; wave 8 removed the room those surfaces lived in. Parcel W restored the cue's *hue* half at the crosshair (the letter's bloom) — but a letter is not a field, and the ambient, peripheral, unread "the beat is coming" signal went with the floor. This amendment gives it back.

**The law.** Post-graduation Moonline play only.

- **Surface:** the RIBBON — rails, crossbars and cell fills together, as one body. It is the largest surface in a floorless world and it is already the beat made visible, so the swell and the thing it describes cannot disagree. Implementation is one multiply on the fragment `ink` every element is already summed into (`ink*=1.0+uBreath`), never on `col` and never on the alpha: **hue keeps meaning LANE and fade keeps meaning DISTANCE.**
- **Curve:** recovered, not reinvented — `beatSwell(maxAmt, off) = maxAmt·max(0, 1−2·off)²`, lifted verbatim out of `wasdBeatGlow` into the single copy all three renderers now read (trainer floor · crosshair letter · ribbon). Provenance: `e4faf65` (2026-06-24), preserved through wave 8's parcel W.
- **Clock:** the road's own `roadBeatNow()`, which expands to `ticks/PPQ − audioLat()/bps` — the raw heard beat, latency-corrected. That is character-for-character the clock the pre-wave-7 wash used (`Tone.Transport.ticks/PPQ`, before `grooveFreezePhase` existed) plus the one correction every cue now carries. Two identities follow and both must be stated in code: `round(r)` is the instant the ribbon's own cell boundary crosses the now-line (the shader's `b = uNow + u/ROAD_MPB` is integral at `u=0` exactly when `r` is), and `round(r)` is the centre of the ARRIVAL window — **the correct fire time the user is asking to see.**
- **Not a second clock for one event:** the crosshair's letter keeps peaking on the "and" (`wasdBeats()` carries `grooveFreezePhase`), where the WASD *tap* is due; the ribbon peaks on the "one", where the *shot* must land. Two cues, two actions, one envelope.
- **Amplitude:** `CFG.moonline.breathMax`, default **0.45 — which is `CFG.floorBeatMax`**, the amount the floor swelled by. Flat, decision-commented, live-tunable. `0` rests the ribbon at its shipped brightness.
- **The arches ride it** at `ML_ARCH_BREATH` (0.45) of the ribbon's amplitude, on the ribbon's *own* uniform object, in the vertex shader where `vAmt` already lives: one uniform, one multiply-add, no new pass, no new per-frame write.
- **Gating is inherited, never restated:** `wasdBeatCueOn()` — the shipped floor-beat gate whole. Because `roadLive()` already excludes the trainer, its trailing `(!reduceMotion || trainMode)` reduces to `!reduceMotion`, which is the honest restoration: the pre-wave-7 wash was OFF in free play under reduced motion (only the trainer ever kept a discrete flash), so the ribbon does not breathe there either. `MOBILE` is excluded for the same reason.
- **Scope guards:** the trainer's floor keeps its original `floorBeat` untouched (`updateFloorBeat` still asks `!roadLive()` and still reads `wasdBeatGlow()`); `moonline.on:false` leaves every wave-7 surface's hidden/shown state exactly as wave 7 left it, and compiles a fragment shader that has never heard of `uBreath`; **zero gameplay-math changes** — `roadBreath` is a pure read called from one per-frame uniform write.

**Also in 8.1 — THE DUST IS RESOLVABLE.** First light also reported no stardust. It was never missing: the layer was built, added, visible and drawn every frame, and invisible for two pieces of arithmetic. (1) The budget was flat in road distance while screen area falls as 1/u³ — 400 motes of 0.10 m over 324 m put 272 of them at exactly 1×1 px inside a 31-px strip below the horizon (a wash, not a grain), 71 behind the camera, and only 26 at ≥2 px across the entire near road. (2) The fragment emitted premultiplied `vec4(uCol*a, a)` while the material never set `premultipliedAlpha`, so three.js r128 chose `blendFunc(SRC_ALPHA, ONE)` and delivered `uCol·a²` — 42% of a road rail at peak instead of 90%. Fix: the window now ends where the grain dies (`ML_DUST_SPAN` 12→5 beats, `ML_DUST_BEHIND` 2→0.5, so 135 m of road at exactly 5 motes per sixteenth cell), the mote is `ML_DUST_M` 0.10→0.30 m with a 6 px cap, and the material says `premultipliedAlpha:true`. Density in road space stays UNIFORM by necessity — anchors wrap against `uNow`, so a near-field-weighted distribution would be a clump that streams at you and passes, i.e. a comet, not a carrier. Budget: 4,350 px² = 0.210% of a 1920×1080 frame, seven times the 627 px² the old window actually drew and still a third under the 0.31% parcel V paid for. LOW still builds no dust at all.

## 1.2 amendment — THE DUST IS THE SPACE · THE GOLDEN THREAD (wave 8.2)

**Origin:** the Moonline playtest, 2026-07-27. Both clauses below are user-locked and both OVERRIDE a §1.x design decision at the user's own direction. Where this section and §§1–5 disagree, this section is the law.

### Y1 — THE DUST IS THE SPACE (overrides §4's "road-level only")

**What was wrong.** 8.1 made the stardust resolvable and it was still the wrong layer: motes lying ON the ribbon read as a texture applied to a road, not as the feeling of moving through anything. A carrier wave painted on the carrier is a decal.

**The law.**

- The dust leaves the surface and becomes a **volumetric field wrapped around the camera** — an axis-aligned box that RECYCLES: `ML_DUST_RAD` either side of the eye, `ML_DUST_VERT` above and below it, `ML_DUST_SPAN` beats deep along the travel axis of which `ML_DUST_BEHIND` is behind you. Shipped: 40 m · 25 m · 5 beats with 1 beat behind (27 m behind the eye to 108 m ahead), which are the user's own first guesses, kept because the arithmetic agreed with them.
- Particles stream **opposite the direction of travel at the road's own speed**, tempo-locked to `metersPerBeat`: the wrap is `mod(anchor − uNow, SPAN)` against the ribbon's OWN `uNow` uniform object, so the dust and the ribbon cannot disagree about velocity at any tempo. Motes still never move; the world does.
- The field does **not** follow the course spline. The ribbon bends because a road bends; the space it flies through does not. `uBase/uA/uW/uP` leave this material entirely.
- Same pooled budget (≤ 400 motes, `dustCount`, one `THREE.Points`, one draw call), the 8.1 premultiplied-alpha lesson kept (`premultipliedAlpha:true`), sized and alpha'd for the new distances by the 8.1 method — the window still ENDS WHERE THE GRAIN DIES (108 m = 1.37 px at the shipped 0.30 m mote).
- **§1's "nothing beside the road but space" is amended:** streaming dust IS the space. It is not an object beside the road, and the rule stands for everything else.
- **reduceMotion: the dust is OFF** — not frozen. It is pure motion; a standing volumetric field is a fog of dots with no meaning left in it. Off at build time, the same silence LOW already gets. **LOW: off, as before.**

**Computed (1920×1080, fov 95, EYE 4, level forward view, 400 motes):** volume 80 × 50 × 135 m = 540,000 m³ → 7.407e−4 motes/m³, mean nearest-neighbour spacing 6.12 m; 276 motes on screen (11 at the 6 px cap, 25 at 4–6 px, 124 at 2–4 px, 116 under 2 px) and 80 behind the camera; **2,266 px² = 0.109% of the frame** — half of 8.1's 0.210% and a third of the 0.31% parcel V budgeted, because the same motes now spread over the whole frame instead of the strip below the horizon. Near-pass rate within 5 m of the eye: 0.52/s at the 20 bpm floor, 1.57/s at the sixty cap.

### Y2 — THE GOLDEN THREAD (overrides §5's window-driven tether brightness)

**What was wrong.** The tether was a thin intermittent white line whose alpha WAS the orb shell's opacity. Two failures, both arithmetic: it swung 0.036 → 0.378 → 0.036 once a beat (invisible → rail-bright → invisible) and read as flicker; and it made the moment that matters look like every other moment, because the loudest thing it ever did was something it did on every beat regardless of whether you hit anything.

**The law.**

- **(a) IDLE — the thread just IS.** A thin **GOLD** line (`ML_GOLD`, the arches' and the impostor's own gold — no new colour), **PERSISTENT at a constant subtle alpha for the orb's whole life**: `alpha = tetherGlow × ML_TETH_IDLE`, with no window term anywhere. The open-window cue lives in the shell glow and in §1.1's breath; the thread's fact is "this Echo belongs to that star", which is true continuously, so it is drawn continuously. Shipped 0.9 × 0.18 = 0.162 — 2.2× the old cue's time-average at 20 bpm, 1.9× at 60, and 43% of what it used to peak at, with the return pulse a further 2.2× above it. The far-end fade (`ML_TETH_FAR`) is unchanged.
- **(b) ON A LANDED KILL — the return rides the thread.** A bright golden **PULSE packet** travels from the burst point up the tether to the star over the **existing flight duration** (`CFG.stars.lineBeats`), on the wave-3 `starVoiceHome` flight machinery merged with the tether path: **one line geometry, a travelling brightness head** (dim gold tail → full `ML_GOLD` head, `ML_TETH_PULSE` of the path long), at `CFG.stars.lineAlpha` — 2.2× the idle thread beside it. Both endpoints are the tether's own two ends by construction (`f.from` is where the orb was, `starWorldAt` is where the star is), so the packet cannot leave the thread it rides.
- **The gap law, the epoch machinery and the level tick are UNTOUCHED.** Visual only: `SPEC_STAR_ROAD` §1.3's tick law stays byte-identical, `starFlyDrain` still pays every due return unconditionally before anything draws, and no `starFly` state — queue, debt, stamp, freeze, cap, pool — changed.
- **reduceMotion: no travelling pulse.** `starFlyDrain` builds no flight record under reduced motion, exactly as it always has, so the level lands at the gap with no line — and the thread beside it is now STATIC GOLD at a constant alpha under every motion setting, because (a) removed the flicker for everybody. Static gold thread, no pulse, level paid: that IS the existing no-line path this clause is asked to match.
- **§5's "Accepted as built (wave-8 gate, N-round)" note is superseded for the brightness law only.** It settled that the tether may mirror the shell's live opacity rather than read `reduceMotion`; the user has since removed the thing it mirrored. The reasoning that made it right — one number, no second copy of a cue — is exactly what (a) preserves by having no cue-derived number at all.

**Playtest questions (8.2):** does the void read as *travelled through* now, or is the dust noise (`dustGlow` is the dial, and the budget has 0.20% of frame headroom left)? Is `ML_TETH_IDLE` 0.18 subtle or a web of gold at a full field? Does the pulse read as *going home*, and is `ML_TETH_PULSE` 0.18 a packet or a smear at the sixty cap?

**Playtest questions:** does the swell make the release timeable again without reading anything? Is `breathMax` 0.45 mesmerizing or distracting at 20 bpm and at 60? Do the arches breathing with the road read as one world, or should `ML_ARCH_BREATH` go to 0? Is the dust a rush or noise now (`dustGlow` is the dial)?

## 2. Parcel T — THE VOID

- Post-graduation play renders the full celestial shell (the Temple's milky-way sphere path, full opacity, complete sphere — below the horizon too). The old ground plane, floor grid, horizon haze, and ground fog are REMOVED from post-graduation play and retired intact to the trainer (which keeps today's room look exactly).
- **Graduation transition:** reuse the Temple's floor-dissolve tech (`floorDissolveSec`) — on `setTrainPhase(3)` the room's floor dissolves beneath the player and the Moonline is revealed under them. One-time per run path; no new text.
- Spawn pitch: reevaluate the slight upward bias now that orbs read against stars, not floor (compute current pitch distribution; adjust `beatSpawnPitchDeg` only if the void demonstrably needs it, decision-commented).
- Temple entry/exit unchanged (the Temple remains the investigation space; visually the dojo and Temple now share the shell — the Temple keeps its globes/panel/free-mouse identity).
- reduceMotion: identical world (the void is not motion).

## 3. Parcel U — THE RIBBON REBUILT

- **Form:** spline-mapped WIREFRAME — two luminous edge rails + crossbars at SIXTEENTH spacing, all UV/geometry following the course spline (bends, banks, converges). Beat cells between crossbars FILL with translucent lane color for the next `road.lookAheadBeats` (8) beats; beyond that, naked grid to `moonline.drawBeats` (32); tight corners naturally show ~4 (occlusion does the work — no special logic).
- **Speed:** `moonline.metersPerBeat:27` — road speed = metersPerBeat × bpm/60 m/s (27 m/s ≈ 60 mph at the cap; 9 m/s at the floor). The climb to sixty literally triples ground speed. All existing clock laws (now-line latency, wake epochs) re-anchored to the new scale — the ONE CLOCK identity must be re-proven at the new geometry (computed, in comments).
- **The horizon impostor:** beyond the 32-beat ribbon, one cheap converging golden-white streak at the course's far heading, faded into the starfield, shown when the ribbon's end is on-screen and the course is straight-ish (`moonline.impostorMinStraight`). Real near, painted far.
- **The wake** renders on the new ribbon (cells behind the now-line: landed = lit lane color, missed = dark, neutral = base grid), same epoch law, same ring buffer.
- reduceMotion: static ribbon, cells pulse in place, impostor static.

## 4. Parcel V — ARCHES, RINGS, DUST

- **Rail-split arches (bar lines, every 4 beats):** at each bar line each edge rail BRANCHES — one strand continues flat (the road's edge never breaks), the other sweeps up, arcs over, meets its partner, and rejoins the rail past the arch. Small bright junction nodes (gold) where strands depart/rejoin. Form: smooth semicircular arc of soft gold light, slightly prismatic inner edge, aurora-soft outer, translucent (stars show through). These are from the user's dreams — build them with care, expose form knobs (`archHeightM`, `archGlow`, `archPrism`).
- **The mercy ring:** the mercy bar's marker is the COMPLETE CIRCLE — the arch's mirror half descends below the road plane and closes into one full golden ring the player passes through as the field exhales. The only complete circle on the road; visible from far out; grander glow (`mercyRingBoost`).
- **Reflections:** every arch casts a faint mirrored reflection below the road plane (gold on dark water), implying the completed circle; one mirrored pass, `reflectAlpha` (0.18 first guess), 0 = off.
- **Stardust:** a fine particle layer streaming along the road surface at sixteenth-rate (4 crossbar-lengths per beat — the carrier wave), road-level only, budget stated (`dustCount`, first guess ≤ 400 live), paid for by halving the hit-flock/shards budgets (list every count changed with old→new in comments). LOW-REZ: dust off entirely.
- The wave-7 fill-gate amber edge-marks stay ON the road (on-road marks are legal; side objects are not).

## 5. Parcel W — CURSOR & TETHERS

- **Cursor restoration:** the required letter renders at the crosshair with the pre-wave-7 pulsating-glow timing cue, byte-faithful to the old behavior (git-archaeology 55bc45c to recover exactly what moved; the old cue's timing law was correct — restore, don't reinvent). Road bands lose their glyphs (color-only).
- **Star-tethers:** each star-bound Echo renders a faint line from the orb to its origin star's TRUE current sky position; the tether BRIGHTENS with the orb's open window (same openness amount the shell glow uses — one law, two renderers; the tether makes the window readable against the void). Fallback (non-star-bound) orbs: no tether. The old orb-to-ground drop-line is fully retired (trainer keeps it if it exists there). Line budget: pooled, `patternConcurrency`-bounded, no per-spawn allocation.
- reduceMotion: tether brightness steps instead of pulsing (match how the shell glow already degrades, if it does; else static at open).
  - **Accepted as built (wave-8 gate, N-round):** parcel W reads no `reduceMotion` at all and instead mirrors the shell glow's LIVE opacity frame for frame. That IS this clause's "match how the shell glow already degrades" — the shell glow is a functional cue with no reduceMotion gate of its own (`index.html:8490`), so "if it does" resolves to "it does not", and the tether inherits the shell's own reduced-motion fallback (a still shell holds a still thread) wherever one exists. Reading the live opacity is what makes the two cues structurally unable to disagree. Settled — do not re-litigate.

## 6. Build order & review

T → U → V → W sequential (Sonnet verify each, fix rounds per parcel), then the Codex gate over the whole wave, fix rounds to GREEN, push branch. This wave is RENDER-heavy: verifiers must demand the frame-budget arithmetic and check the kill-switch restores wave-7 rendering exactly; Codex should attack the transition seams (graduation dissolve mid-run states, temple enter/exit under the shell, moonline.on:false with road.on:true, LOW-REZ × reduceMotion matrix).

## 7. Playtest questions

- The only question that matters: **does it feel like a road now?**
- Do the arches read as grown-from-the-road (no hovering)? Does the first mercy ring seen from distance land as anticipation?
- Tethers: can you read an orb's height/depth against the void by its thread? Does the tether-brightening make landings MORE timeable than wave 6?
- Dust: rush or noise? (`dustCount`, sixteenth-rate)
- The void: any vertigo/discomfort across a full session? (If yes: `reflectAlpha` up — grounding — and we discuss a faint floor-glow option.)
- The impostor: any visible seam where real ribbon hands off to painted road?
