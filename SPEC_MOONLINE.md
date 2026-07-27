# The Moonline — Season 2, Wave 8 (the rebuild: void, ribbon, arches, tethers)

**Version:** 1.0 · 2026-07-27
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
