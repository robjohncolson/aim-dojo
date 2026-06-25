# Godot Native Android Port — Spec & Progress

> **Status (2026-06-24): BOTH GATES PASSED on a Galaxy S24 — the native port is fully de-risked (a GO whenever the ~65–107 dev-days are worth investing). Not yet started.** The WebGL app remains the live product.
> The WebGL app remains the live product; this doc records the native-port exploration so it can resume cleanly.
> Full detail lives in `../godot-aim-spike/PORT_PLAN.md` (the audit output).

## Why (the goal)
Port aim-dojo to a **native Godot 4 → Android APK** for the user's Google smart tablet. Motivation: **lower audio/input
latency, less resource use, better battery/thermals** than the WebGL + Tone.js + Supabase stack running inside a browser
(full Chromium runtime). The rhythm-game heart lives or dies on audio timing, and a native build sheds the browser overhead.

**Key reframing from the design discussion:** for a *native* Android target the usual "Godot web audio is mushy" objection
**reverses** — native uses the platform audio stack (Oboe/AudioTrack), which is good. That objection only applied to Godot
*web* export. A WebView/TWA wrapper (Bubblewrap/Capacitor) would give an APK with **zero** latency/perf win (still Chromium);
only a native rewrite delivers the goal. Rendering actually gets *easier/lighter* in Godot (native sky/reflections/physics
replace hand-rolled Three.js).

## Decision: STAGED-GO, gated on two conditions (in order)
1. **Latency spike — ✅ PASSED on-device (Galaxy S24, 2026-06-24).** Feels **reactive**; the native Android audio-clock
   model holds. On-screen readout over 64 taps: **mean +35 ms, jitter ±56 ms, spread 211 ms, reported output latency 0 ms.**
   Key finding: Godot's `get_output_latency()` returns **0 on Android** (it doesn't surface the real device latency), so the
   auto-compensation is a no-op and the true latency shows up as the **+35 ms mean — a fixed, *calibratable* offset**
   (exactly Risk #2's prediction). **→ Action if pursued: ship an in-app tap-calibration to measure + subtract that offset.**
   The **±56 ms jitter** is confounded with human tapping variance (casual phone taps run ±30–50 ms on their own), so it's
   acceptable and matched the qualitative feel — worth a cleaner (automated-input) look only if the port proceeds.
2. **Lookahead groove scheduler — ✅ PASSED on-device (Galaxy S24, 2026-06-24).** Prototyped the **baked-tier-stem** approach
   (4 one-bar groove loops — kick/snare/hat/bass at rising density — all looping phase-locked, `volume_db` crossfade between
   tiers driven by tap accuracy). On the S24 it sounds **tight: no wobble, no drift, no seam** as layers fade in through the
   tier changes — because the stems loop continuously and never re-schedule per-hit. **DECISION: baked tier stems** (not the
   frame-time per-hit poll). The highest-leverage call in the port is now made. (Aside: desktop audio couldn't be used for
   this test — WASAPI had no device because Windows audio was temporarily disabled — so it was validated on the phone, which
   is the real target anyway.)

**Both passed (2026-06-24)** → the port is a GO; the next concrete step is **Phase 1** (the playable rhythm-aim vertical
slice) in PORT_PLAN.md (~65–107 dev-days for v1, front-loaded into audio). Not yet started — the web build stays live until then.

## What was built this session (2026-06-24)
- **Godot 4.7.stable installed** → `C:\Users\rober\Godot\` (console exe `Godot_v4.7-stable_win64_console.exe`).
  `GODOT_PATH` set (User env); the godot MCP server config in `~/.claude.json` fixed (was a `/path/to/godot` placeholder)
  → MCP verified live (`get_godot_version` = 4.7.stable.official.5b4e0cb0f).
- **Android toolchain confirmed already present**: JDK 17 (Temurin), Android SDK (platform-tools/adb, build-tools 35,
  platform android-35, cmdline-tools), keytool. **Export templates 4.7 installed.** Debug keystore at
  `C:\Users\rober\Godot\debug.keystore` (Godot also auto-configured one in `%APPDATA%\Godot\keystores\`). No NDK needed
  (standard export, not a gradle custom build).
- **Latency-spike prototype** → `C:\Users\rober\Downloads\Projects\godot-aim-spike\` (SIBLING of this repo, not tracked
  here). Reproduces the WASD converge-bloom tap mechanic on the latency-corrected audio clock
  `song_pos() = get_playback_position() + get_time_since_last_mix() - get_output_latency()`. On-screen readout:
  AHEAD/PERFECT/BEHIND ±ms + **mean / jitter / spread** (jitter is THE metric — low = tight, high = mushy). Validated
  headless + live on a Vulkan desktop preview.
  - **Desktop preview gotcha:** this machine's Intel drivers support **Vulkan** but NOT OpenGL 3.3. Preview with
    `--rendering-method forward_plus --rendering-driver vulkan`. The APK ships **gl_compatibility** (OpenGL ES, fine on Android).
- **Debug APK exported + run on-device** → `godot-aim-spike\aim-spike-debug.apk` (arm64-only, ~27 MB; apksigner-signed).
  Package `org.aimdojo.spike`. Installed + launched on a **Galaxy S24** (Adreno 750, GL ES 3.2) — renders + feels reactive
  (see Gate 1). (A universal arm64+x86_64 build was tried for an emulator smoke test — emulator was flaky and x86 latency
  is meaningless, so reverted to lean arm64. The shipped APK is **gl_compatibility** and works on the S24 — do NOT switch
  to Vulkan based on a black screenshot; see gotcha.)
  - **GOTCHA:** `adb screencap` returns a **BLACK image** for Godot's hardware SurfaceView on Samsung — the screen renders
    fine; the screenshot lies. Trust the device / on-screen readout. (Also: Godot `print()` to the `godot` logcat tag was
    filtered / not visible on this S24 — read the numbers off-screen instead of from logcat.)
- **Full portability audit** (9-agent workflow, ~745K tokens) → `godot-aim-spike\PORT_PLAN.md`.
- **Gate 2 groove prototype** (same spike) → `main.gd` + baked `tier0–3.wav` (one bar each, 100 BPM, kick/snare/hat/bass at
  rising density). All stems + the metronome loop **phase-locked**; tap accuracy drives a `groove` float whose floor selects
  the tier; `volume_db` crossfade (Tween ~0.45 s) on tier change. Confirmed tight on the S24 → baked stems chosen.

## The plan in one breath
**~65–107 dev-days for v1** (midpoint ~76), front-loaded into audio. Most of the app ports cleanly: ballistics
(`computeShotPlan`, swept collision, `simShotHits`) = near-verbatim GDScript math; HUD = shallow Control-node work; the
Railway anti-cheat server is **reused unchanged**; web-only cruft (autoplay gates, pointer-lock plumbing, CDN lazy-load,
the `animate()`-last TDZ dance) just deletes. The ONLY hard part is rebuilding `Tone.Transport`:
- **Clock** — solved (the spike).
- **Lookahead groove scheduler** (`onGrid`/`scheduleRepeat`) — the real risk. Recommend **baked tier stems** (looping
  one-bar loops per intensity tier, `volume_db` crossfade) over a per-hit poll (frame-time jitter) for mobile.
- **Per-target spatial tone** (`makeTargetSound`) — Godot effects live on buses not players → bucket orbs into 3–4
  filtered distance buses.
- **Dual-clock** — every `beats = ticks/PPQ` re-sources to `song_pos()`, edge-detected in `_process` (not `_physics_process`).
- **`bpm.rampTo` continuity** — drive `beats` off an integrated musical-time counter during tempo ramps, not raw playback pos.

See `../godot-aim-spike/PORT_PLAN.md` for the full per-system effort table, 5-phase order, and risk register.

## How to resume
- **Gate 1 (latency) — DONE ✅** (Galaxy S24, 2026-06-24): reactive; mean +35 ms (calibratable), jitter ±56 ms, 64 taps.
  Caveat to handle if pursued: Godot `get_output_latency()` = 0 on Android → **add an in-app tap-calibration** (measure +
  subtract the per-device offset). To re-test on another device: `adb install` the APK, tap, read the on-screen numbers.
- **Gate 2 (groove scheduler) — DONE ✅** (S24, 2026-06-24): the baked-tier-stem groove (4 looping one-bar stems + crossfade)
  sounds tight, no wobble. Decision locked: **baked stems**. The spike now demonstrates it — `adb install` the APK + tap to
  hear the groove build through the tiers. (Desktop audio works once Windows audio is enabled, but the phone is the real test.)
- **Both gates cleared → if pursuing the port, start at Phase 1** (playable rhythm-aim vertical slice) in PORT_PLAN.md.
- Re-export: `& "C:\Users\rober\Godot\Godot_v4.7-stable_win64_console.exe" --headless --path "C:\Users\rober\Downloads\Projects\godot-aim-spike" --export-debug "Android" "out.apk"`

## Artifacts
| Thing | Path |
|---|---|
| Godot spike project | `C:\Users\rober\Downloads\Projects\godot-aim-spike\` |
| Full port plan (audit) | `…\godot-aim-spike\PORT_PLAN.md` |
| Debug APK | `…\godot-aim-spike\aim-spike-debug.apk` |
| Godot editor | `C:\Users\rober\Godot\Godot_v4.7-stable_win64.exe` (GUI) / `…_console.exe` (CLI/MCP) |

## Open follow-ups if pursued
- **In-app latency calibration is REQUIRED on Android** — Godot `get_output_latency()` returns 0 there (no auto-compensation;
  the S24 showed a +35 ms uncompensated offset). A one-time tap-calibration storing a per-device offset. Small but mandatory.
- ✅ **Per-hit poll vs baked tier stems — DECIDED: baked stems** (Gate 2 proved it tight on the S24). No longer open.
- The Godot spike project is **outside any git repo** — if the port goes forward, `git init` it (or move under a repo).
- A custom app icon was skipped (Godot default used); add one before any real build.
