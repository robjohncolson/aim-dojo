# Mobile performance budgets

The pause menu has two independent controls:

- **Performance: Auto / Lean / Full.** Changing this restarts the game. Auto uses compact backgrounds and a 60 FPS draw ceiling on touch phones, detected weak GPUs, devices reporting at most four cores or 4 GB of memory, and data-saving connections. Lean starts with a smaller backbuffer on any device. Full keeps original sky textures. Missing hardware hints do not imply weak hardware.
- **Frame rate: Up to 60 FPS / Screen rate.** Changes immediately and is remembered independently of the performance preset. The ceiling applies to scene/reflection drawing and the beat-circle canvas. Input, camera/audio positioning, physics, beat grading, and musical scheduling continue on every animation callback.

Resolution still selects the crunchy or smooth look. The default crunchy image starts at DPR 0.5; Lean starts at 0.4 (36% fewer backbuffer pixels at the same viewport). Sustained slow play can request one lower rung, applied at the next pause. The grid stays stable during play. The crunchy floor is 0.35; Full keeps the crunchy grid fixed at 0.5. These ratios are relative to CSS viewport pixels, not native display pixels. A new page load resolves the starting budget again.

Compact assets preserve the original projection and metadata. Milky Way storage is 2 MiB instead of 18 MiB and each planet is 0.5 MiB instead of 8 MiB for base RGBA8 storage, excluding mipmaps and driver overhead. Planet maps remain lazy on focus; originals remain available. See [asset provenance and regeneration](assets/sky/compact/README.md).

## Reproducible comparisons

URL choices override saved settings for that visit:

```text
?performance=auto
?performance=lean&renderfps=60
?performance=full&renderfps=native
?hi&performance=lean&renderfps=60
?panning=hrtf
?panning=equalpower
```

Add `&fps` to display actual scene draw rate and DPR. Native display refresh may be higher than the draw rate. A frame ceiling does not guarantee that a device can sustain that rate.

HRTF remains the default piano spatialization in every tier. Equal-power panning is an explicit A/B option: it retains the piano graph and left/right direction but changes stereo balance. No instrument, note, groove threshold, shield timing, or streak reward is removed by these budgets.

```sh
node --test tests/*.test.js
node tools/mobile-budget-smoke.mjs --out artifacts/mobile-performance/browser-check
node tools/mobile-audio-probe.mjs --out artifacts/mobile-performance/audio-check
```

Use a new output directory for each probe run. Browser probes use an isolated profile, never the player's saved state. `COLDLOAD_MODULES` can point to an installed `puppeteer-core`; `CHROME_PATH` overrides Chrome. Probe manifests describe instrumentation and limitations. Native offline audio renders can check waveform and routing invariants, but their elapsed time is not a phone CPU benchmark.

The audio probe also accepts `--tone /path/to/Tone-14.8.49.js`. Supply the same pinned [Tone 14.8.49 build](https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js) used by the game; the probe checks its SHA-256 before executing it. Its default path reuses this workspace's existing local test copy.

## Physical-device follow-up

Validate a sustained night on an older Android phone and iPhone/Safari: cold start, first chord, doorways, a full streak, pause/resume, Temple globe changes, and background/foreground transitions. Compare Auto/Lean/Full at the same scene and BPM; record frame pacing, audio glitches and thermal behavior over at least ten minutes. Audition the panning alternatives with headphones before changing the HRTF default. Browser emulation verifies behavior and layout; it cannot establish sustained performance on those devices.
