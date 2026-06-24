# Godot Native Android Port — Spec & Progress

> **Status: EXPLORATION PARKED (2026-06-24).** Decision = **staged-go**, gated on 2 unproven conditions (below).
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
1. **Tablet latency spike** — does Godot's `get_output_latency()` compensation yield a *stable, calibratable* offset on the
   actual tablet? **Built, NOT yet measured on-device.** (The desktop spike proved the *tap* survives the audio-clock model;
   the per-device offset stability is unproven — this is the headline go/no-go.)
2. **The Tone.js lookahead scheduler** — prove a baked-tier-stem groove feels solid (vs a frame-time per-hit poll that
   wobbles the backbeat). ~1 afternoon, **no tablet needed.** Not started — the recommended NEXT build if resumed.

If both pass → proceed through the 5 phases in PORT_PLAN.md (~65–107 dev-days for v1). If either fails → keep the web build.

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
- **Debug APK exported** → `godot-aim-spike\aim-spike-debug.apk` (arm64-only, ~27 MB; apksigner-signed+verified).
  Package `org.aimdojo.spike`. (A universal arm64+x86_64 build was tried for an emulator smoke test — emulator was flaky
  and x86 latency is meaningless, so reverted to lean arm64.)
- **Full portability audit** (9-agent workflow, ~745K tokens) → `godot-aim-spike\PORT_PLAN.md`.

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
- **Gate 1 (tablet):** plug tablet in → enable USB debugging → `adb install godot-aim-spike\aim-spike-debug.apk` (or
  sideload the file) → tap to the beat → read **jitter**. Low jitter = the heart mechanic survives the port.
- **Gate 2 (scheduler):** extend the spike — bake a one-bar groove, layer into intensity tiers crossfaded on the audio
  clock, confirm baked stems feel solid on the Vulkan desktop preview. Recommended FIRST build if resumed.
- Re-export: `& "C:\Users\rober\Godot\Godot_v4.7-stable_win64_console.exe" --headless --path "C:\Users\rober\Downloads\Projects\godot-aim-spike" --export-debug "Android" "out.apk"`

## Artifacts
| Thing | Path |
|---|---|
| Godot spike project | `C:\Users\rober\Downloads\Projects\godot-aim-spike\` |
| Full port plan (audit) | `…\godot-aim-spike\PORT_PLAN.md` |
| Debug APK | `…\godot-aim-spike\aim-spike-debug.apk` |
| Godot editor | `C:\Users\rober\Godot\Godot_v4.7-stable_win64.exe` (GUI) / `…_console.exe` (CLI/MCP) |

## Open follow-ups if pursued
- Decide **per-hit poll vs baked tier stems** (Gate 2) — highest-leverage call in the whole port.
- The Godot spike project is **outside any git repo** — if the port goes forward, `git init` it (or move under a repo).
- A custom app icon was skipped (Godot default used); add one before any real build.
