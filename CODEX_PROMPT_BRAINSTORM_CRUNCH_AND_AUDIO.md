# Codex prompt — Brainstorm: CRUNCH AS THE LOOK + an AUDIO STYLE that matches it

**Working directory:** `C:/Users/rober/Downloads/Projects/aim-dojo` (branch `main`). **READ-ONLY.** Do not edit, commit, or push anything in the repo. Prototypes and measurement scripts go in a scratch folder outside the repo (e.g. `../scratch-brainstorm/`). Your deliverable is a written brainstorm, not code.

---

## The user's words (2026-09-04)

> "I tried playing with high resolution and.. it's just so.. laggy compared to lo res. I'm thinking a lot of the artwork we've been creating needs rethinking? I dunno. I love the crunchiness.. one thing I think about a lot is.. audio style."

Two questions, then: **(1)** should the low-rez "N64 crunch" stop being a fallback and become the authored look, and what would the art become? **(2)** what audio style belongs to that look, given that the sound is load-bearing information (see the Music Language below)?

## What is already established (verified 2026-09-04; cite lines only if you re-check them)

**The machine.** Intel Core Ultra 7 155U laptop (15 W), integrated Intel Xe iGPU (`ANGLE (Intel, Intel(R) Graphics (0x00007D45) Direct3D11)`), 1920×1200 @ 60 Hz, devicePixelRatio 1. Students play on school laptops/Chromebooks, often 1366×768, laptop speakers or cheap earbuds.

**Measured frame times on that machine** (headful Chrome, fresh profile, production site, 20 s runs, no shots fired, trainer-phase scene):

| variant | canvas buffer | mean ms | p99 ms | doubled frames (>25 ms) |
|---|---|---|---|---|
| `?hi`, full window | 1904×1049, MSAA | 17.1 | 33.3 | ~2.5% (28–32 of 1170), max 50–83 |
| `?low`, full window | 952×524, no MSAA, pixelated | 16.66 | 16.9 | 0 of 2402 |
| `?hi`, 960×600 window | 944×449, MSAA, full HIGH shaders | 16.7 | 16.8 | 0–1 |

Reading: HIGH is **fill-bound** (pixel count × MSAA), not JS-bound (main-thread JS ≈ 1 ms/frame on both). The HIGH shader set at a quarter of the pixels runs clean. The user's "laggy" is the hitch rate at native resolution, likely worse in the post-graduation void with walls on.

**The render ledger, corrected.** Two July assumptions are stale for actual play: the planar sky-reflection pass is gated `!roadLive()` (aim-dojo-main.js ~2567) and the sky-dome fbm is culled once the milky shell is solid (`domeCull`, ~2316), so in the void **neither tier pays them**. What HIGH pays in the void that LOW does not, biggest first: 4× pixels (DPR 1.0 vs 0.5; HIGH's adaptive floor is 0.9, LOW's ceiling is 0.5 — **there is no middle tier**, ~309/2425); MSAA (~313); 11 wall slots vs 7, each a huge depth-writing quad running ~6 value-noise lookups per fragment plus rim/next-door glow (~1107, 1657–1719; LOW compiles a sin-ripple instead); the carved-chevron road SDF with `fwidth`/`dFdy` and 4 crossbar tiers vs 2 (~1913, 1931–1936); 3 course harmonics vs 1 in every road-family shader (~855); 1500 vs 750 vault points with `exp()` sparkle (~1098, 1620); 400 dust points vs none (~1115); 13 always-on additive zodiac planes in the Temple (~3012). `GLOW = !LOW` (~233) is the one line that couples the key-art night treatment (halo grid, moon corona, mist, bolder ribbon — mostly hidden in the void anyway) to resolution. LOW also: `image-rendering: pixelated` (~231), chunkier orb geometry (~6842), fewer shards/flock/stars.

**The audio, as built.** 100 % synthesized in Tone.js 14.8.49, no samples in the repo. Two AudioContexts: Tone's (Transport/Destination bound at load, ~10586) and THREE.AudioListener's (~5183), which owns every per-Echo spatial hum **and the only reverb** (`makeIR`, ~5108). The musical bed is **bone dry**: no Tone voice is reverberated, only three tempo-synced `8n` FeedbackDelays. No compressor or limiter anywhere. `drumBus = Volume(-5)` is the music master (~5142), ducked −3/−6 dB on a miss/clank (~7182). Voices (~5142–5207, 5373): kick MembraneSynth C1 · snare/hat white noise through bandpass/highpass · tick triangle (+3 dB, the Quiet Tick) · bass sawtooth → 520 Hz LP · arp/lead/tune triangle or sine → LP → delay · tapSynth triangle → 3200 LP · pad PolySynth triangle → 1400 LP · synthHit/synthLvl/synthLow/chordSynth for kills and chords · fireMuzzle brown noise / firePluck sine / noiseFire for the shot · arcWhoosh, doorWhoosh · chorusVoice PolySynth (slow attack, ≤8 stems) for the standing chorus. Waveform census: 10 triangle, 3 sine, 2 sawtooth, 1 square. Character today: soft, clean, dark-filtered synth. Nothing lo-fi exists (no BitCrusher, no waveshaper, no wow/flutter, no sample-rate reduction). Themes at ~4829–4878 (DOJO, CANON, MOONLIGHT, ICAROS, CHANT, HYMN, JOY, GREENS, TORIYANSE); `pickTheme` (~5080) is locked to MOONLIGHT (C♯-minor, Beethoven mood).

**The Music Language is information** (SPEC_MUSIC_LANGUAGE.md, shipped and loved): each orb's hum PITCH encodes its beat-quantized lead k; the kill note's TIMBRE = arrival tightness (full voice / breathy / a clank mutes the lead for a beat); same-beat volleys ring dyads/triads; the tank is a DRUM FILL; the Quiet Tick thins with mastery; WASD taps sing a pentatonic; the standing CHORUS of rescued star voices (menu, mercy, the Bow) is the player's audible save file. Any style change must keep these channels legible on laptop speakers.

## Hard laws (the user's own verdicts; ideas that break them are dead on arrival)

1. **ZEN.** No new UI, HUD counters, toasts, settings screens, pickers, tiers, modes. Tune by flat CFG constants behind kill-switch knobs whose off-arm is byte-identical.
2. **Identity = LEAD + RHYTHM** (land the shot on the orb on the beat; distance encodes syncopation). BPM cap 60; depth is polyrhythm, not speed. Killed for good: flick, hunt mode, difficulty packs, song picker, leaderboards, terrain/scenery floors, live precision glow, fabricated aurora in the dojo sky, the Mandala stats screen.
3. **The orb glow on the beat is the sole "land it now" cue**; star tethers carry lead; the ribbon carries the beat grid. Crunch must not smear those.
4. **Audio is ear-judged:** one clear change at a time, the user reacts, tune that one thing. Public-domain material only. No copyrighted melodies.
5. **Perf posture:** build-time booleans compile costs OUT; never a post-processing pass; `reduceMotion` is first-class. Chromebooks must not need an AudioWorklet without a fallback.
6. Every asset is committed before code references it; there is no build step.

## Seeds from tonight's brainstorm (build on them, disagree with evidence)

- **Crunch is a discipline, not a filter.** Authored-for-0.5-DPR art means: a consistent pixel grid, no bilinear smear, 1–2 px wireframes at buffer resolution, flat-faceted orbs, hard-edged additive glows, ordered dither instead of alpha overdraw, small hand-made textures instead of 2 k JPEGs. Most of these *reduce* GPU cost.
- **A middle tier is one line away.** Decouple `GLOW` from `LOW`, and let HIGH's adaptive floor reach 0.5 (or make 0.5-pixelated the default and keep `?hi` as the smooth escape hatch). The measurement says the HIGH shader set is fine at a quarter of the pixels.
- **The walls are the real HIGH tax in the void**, not the reflection or the sky. Rethinking "the artwork" starts at the wall/doorway shaders and the dust, not at the planets.
- **The sound is cleaner than the image.** Candidate audio moves, cheapest first: a light saturation/soft-clip on `drumBus` (native WaveShaperNode, no worklet); a short bright reverb send for the kill notes and taps only (the bed stays dry so k-pitch reads); a hint of downsample/bitcrush **only on percussive one-shots** (kick, clank, shot), never on the per-orb hums; tape wow (Tone.Vibrato, tiny depth) on the pad only; square/pulse (strong harmonics) for the k-pitch hum so pitch survives laptop speakers; a bus compressor so the ducking and the chorus sit together.
- **Whole-style directions worth arguing:** N64-era ambient (soft FM + short bright reverb + punchy short envelopes, matches the image exactly); lo-fi study beats (tape hiss, wow/flutter, dusty kick, sidechained pad; zen-compatible, risks blurring timbre-as-tightness); Japanese-instrument minimalism via FM (koto/bell/shakuhachi-like, no samples, fits dojo/moon/sensei); choral organum (the chorus *is* a choir — lean in); chip/Game-Boy (fits crunch, may fight the zen).

## Your tasks (read-only; scratch folder only)

1. **Void-scene measurement.** Extend the frame-meter idea to a *post-graduation* scene if you can reach it without playing a worthy night (no shots, < 45 s): compare `?hi` vs `?low` vs `?hi` with the wall count or dust forced to LOW values via a scratch copy of the page served locally. Report where the hitches actually come from. Never touch the user's Chrome profile; fresh temp profile only; nothing may upload to the relay.
2. **Crunch art audit.** For each visual element (ribbon/crossbars, walls/doorways, mercy pane, nave stars, tethers, orbs, flash/shards, flock, dust, moon, milky shell, Temple planets + sign belt, crosshair ring, ghost silhouettes) state how it reads at 952×524 pixelated today (crisp / mushy / shimmering / unreadable) with screenshots from a scratch run, and propose the authored-for-crunch version and its cost delta.
3. **Audio style sketches.** For 3–5 directions, write the exact Tone/native graph changes on the existing voices, CPU cost on a 15 W laptop, the kill-switch knob, what MOONLIGHT becomes, and the single first ear test. Render short A/B audio examples offline if you can (scratch only); otherwise describe precisely.
4. **The information-channel audit.** For every proposed audio move, state its effect on pitch=k, timbre=tightness, chords, fill, tick, chorus — enhance / neutral / blur — and on laptop speakers specifically.
5. **A kill list** of ideas you considered and reject, one line each, and **open questions only the user can answer** (taste calls).

## Report format

One markdown file in the scratch folder, pasted in full as your final message: evidence headlines (numbers) · 3–5 directions, each with ideas, first experiments, cost, risks · kill list · open questions. No code changes. Say plainly where you disagree with the seeds above.
