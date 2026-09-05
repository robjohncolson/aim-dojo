# Codex prompt — DRY CHALK IS THE LOOK · THE CHIP IS THE INSTRUMENT (crunch as the authored image; NES/Game Boy as the audio model)

**Working directory:** `C:/Users/rober/Downloads/Projects/aim-dojo` (branch `main`, HEAD `589c3db`, tree clean apart from untracked `state/` and `CODEX_PROMPT_*.md` — never touch `state/`).
**One local commit per parcel, in the order below. Do not push. Do not run `gitnexus analyze`. Do not edit `CLAUDE.md`/`AGENTS.md`/`CONTINUATION_PROMPT.md`** (the dispatcher records). Line numbers below are exact at `589c3db`; re-read every site before editing — one physical line often carries several statements plus a long `//` rationale.

---

## Mission

Two decisions the user made on 2026-09-04 after a measured brainstorm (evidence in `CODEX_PROMPT_BRAINSTORM_CRUNCH_AND_AUDIO.md` and Codex's own audit):

1. **The image: dry chalk.** The LOW-REZ render — 0.5 DPR pixelated, no MSAA, plain chalk doorways, the narrow ribbon — is the look they want, on every machine. HIGH at native 1920×1200 hitches on their Core Ultra 7 155U iGPU (about one frame in forty to 33 ms; LOW never), and they prefer how LOW reads anyway. HIGH stays reachable only as an escape hatch (`?hi`, or the pause-menu RESOLUTION pref `'0'`).
2. **The sound: NES / Game Boy.** Two pulse channels, a triangle, a noise channel; no filters, no reverb, no delay; duty cycle is the only timbre knob; expression is volume and pitch. Mood: **Metroid corridor, not Mega Man stage** — spare and haunting at 28–60 BPM. **Change voicing only, never note density or scheduling.** The music language is information and must stay legible: orb hum PITCH = lead k; kill-lead TIMBRE = arrival tightness; same-beat volleys = dyad/triad on the pad; the tank = drum fill; the Quiet Tick thins with mastery; the standing CHORUS of rescued voices stays soft and human — the player's instrument is a 4-channel chip, the rescued voices are not the machine. Kick/snare/hat/tick already read as chip percussion; leave them.

Everything ships behind flat knobs with byte-identical off arms. Audio is ear-judged by the user one parcel at a time, so every audio parcel is ALSO switchable from the URL without editing the file (see A0). Zen: no UI, no HUD, no strings, no toasts.

## Hard rules for editing `aim-dojo-main.js`

1. **Never append code after a `//` comment. Never delete a statement with a regex.** Put every new statement on its own line before any trailing comment. Run both swallow scans in §Verification after your last edit.
2. `tools/aim-dojo-main.mirror.part*.js` and `tools/index-inline.mirror.part*.js` are GENERATED. Never edit them; regenerate with `node tools/extract-inline.mjs` as the LAST step of every parcel (commit-ready; the dispatcher re-indexes).
3. Match the house style: single-line statements, `//` rationale that says *why*, `try{}catch(e){}` around audio-node construction (every voice at 5142–5207 already does this), flat `CFG` literals with the comment on the same line.
4. Off arm = byte-identical behavior AND graph: a disabled knob must construct exactly today's nodes with today's options and allocate none of the new ones. A `wet:0` bypass is not an off arm.
5. Tone.js is pinned to **14.8.49** (line 23) from cdnjs; Three r128. No AudioWorklets (Tone.BitCrusher is one — do not use it). No new libraries, no samples, no assets.
6. `node --test tests/*.test.js` must stay green (**347 at baseline**) plus the tests you add. Source-scraping tests read through `tests/source.js` (`sourceFor(name)`); follow the extraction style in `tests/the-visitor.test.js` / `tests/index-contract.test.js` and the `vm` stub pattern in `tests/groove-pocket.test.js`.

---

## TRACK V — DRY CHALK IS THE LOOK

### V1 — `CFG.crunchLook:true` makes LOW-REZ the default render for every device

**Today** (`aim-dojo-main.js:223-233`): `LOW` resolves `?hi` → false, `?low` → true, persisted `aimdojo.lowRez` `'1'`/`'0'`, else `CFG.lowRez===true || detectWeakGPU()`. `DPR_MAX/DPR_MIN` at 309 (LOW 0.5→0.4), MSAA at 313, pixelated canvas at 231, `GLOW=!LOW` at 233. `updateRenderQuality` (2424–2430) steps DPR by −0.15/+0.10 inside those bounds while running.

**Change.** Add `crunchLook:true` to `CFG` (flat, beside `lowRez` at line 100, comment: *dry chalk is the authored image — LOW-REZ render on every device; `?hi` or RESOLUTION pref `'0'` still force the smooth path; false = today's auto-detect behavior exactly*). Resolution of `LOW` becomes: `?hi` → false · `?low` → true · pref `'1'` → true · pref `'0'` → false · else `CFG.crunchLook===true || CFG.lowRez===true || detectWeakGPU()`. Keep `detectWeakGPU()` and its regexes untouched (do not loosen the detector).

**Fixed pixel grid.** Introduce `const WEAK = detectWeakGPU()` evaluated once (reuse the same call — do not create a second WebGL context; restructure so the existing single call's result is kept). Under LOW: if `WEAK`, keep today's 0.5→0.4 adaptive range; otherwise `DPR_MAX=DPR_MIN=Math.min(DEVICE_DPR,0.5)` so the pixel grid never shifts mid-run (a moving grid is visible; the 0.4 rung exists for the 2014 Mac Mini class only). `updateRenderQuality` needs no change — with equal bounds `setRenderDpr` returns false.

**Decouple gameplay/social budgets from the render tier.** LOW currently also shrinks things that are NOT render cost: `GH_VISITOR_COUNT=LOW?1:3, GH_VISITOR_FETCH_COUNT=LOW?1:4` (8051) and `GH_TARGET_MAX/GH_BURST_MAX` (8357–8358). A normal laptop on crunch must still seat three visitors. Audit **every** `\bLOW\b` usage (about 124) and classify: render/visual cost (DPR, MSAA, pixelated, GLOW, shader variants, geometry segments, dust, walls, vault points, stars, flock/shard/spark counts, sign-art belt, chart breath, HUD_DPR, reflection layers, texture sizes) STAYS on `LOW`; gameplay/social budgets (visitor seats, fetch count, ghost target/burst caps, and anything else that changes what a player *experiences* rather than how it is drawn) MOVE to `WEAK`. List your classification in the final message. Nothing else in those lines changes.

**Off arm:** `crunchLook:false` → resolution order and bounds exactly as today (the `WEAK` split of budgets is keyed on `WEAK`, which equals today's `detectWeakGPU()` result, so a weak device is unchanged and a strong device forced LOW by `?low` today already got 1 seat — document that this one edge changes: `?low` on a strong device now seats 3; that is intended).

**Docs:** one line in `README.md` beside the `low_rez` row (~148): crunch is the default; `?hi` forces the smooth render.

**Tests** (`tests/index-contract.test.js` or a new `tests/crunch-look.test.js`): (a) source scan: the `LOW` resolver references `CFG.crunchLook`; (b) `vm` test of the resolver extracted as a pure function of `(search, pref, cfg, weak)` covering the eight combinations, including `?hi` beating everything and `crunchLook:false` reproducing today's table; (c) source scan: `GH_VISITOR_COUNT`, `GH_VISITOR_FETCH_COUNT`, `GH_TARGET_MAX`, `GH_BURST_MAX` reference `WEAK` and not `LOW`; (d) DPR bounds: with `LOW && !WEAK`, `DPR_MAX===DPR_MIN`.

**Do not** touch wall count, dust, vault points, sprite sizes, GLOW palette, or the ribbon width in this parcel — the user likes LOW as it is. Those are later eye-tests, if ever.

---

## TRACK A — THE CHIP

### A0 — knobs and the audition switch (part of A1's commit)

Add a flat `CFG.chip` literal: `chip:{ lead:true, dry:false, bass:false, hums:false, pad:false, dutyFull:0.5, dutyEdge:0.125, leadLpHz:9000, bassDb:-9, humGain:0.32, humHarmonics:32, padDuty:0.25, arpHz:30 }` with one-line comments. Resolve the five booleans ONCE at boot into `const CHIP_LEAD, CHIP_DRY, CHIP_BASS, CHIP_HUMS, CHIP_PAD` from `CFG.chip` **overridden by a URL param** `?chip=` (house pattern like `?hi`/`?low`): `?chip=lead,dry` turns exactly those on and the rest off; `?chip=0` or `?chip=` turns all off; `?chip=all` all on; absent → CFG values. No UI, no persistence. Every on-arm below is gated on these constants at construction time; off arms construct today's exact graph.

### A1 — THE LEAD IS A PULSE (duty cycle is the tightness)

**Today:** `lead` (5153) is a triangle `Tone.Synth` → `leadLp` 3800 Hz lowpass → FeedbackDelay → Volume(−8) → drumBus. THE LEAD INSTRUMENT writes tightness `q∈[0,1]` at 5262 as `leadLp.frequency.value = dullHz + (brightHz−dullHz)·q` (`CFG.voice` at 117: `dullHz:1400, brightHz:5600`), and velocity `breathyVel..fullVel` elsewhere in the same block (5233–5272; read all of it — grace notes, the consonance stack, the clank mute).

**Change (CHIP_LEAD):** build `lead` with `oscillator:{type:'pulse', width:dutyToWidth(CFG.chip.dutyFull)}` and hold `leadLp` at the fixed `CFG.chip.leadLpHz` (the NES has no filter; the node stays so the graph shape is unchanged and 9 kHz is a safety against aliasing harshness, not a timbre). At the 5262 write, on the chip arm set `lead.oscillator.width.value = dutyToWidth(dutyEdge + (dutyFull−dutyEdge)·q)` INSTEAD of the cutoff write (dead-center = 50 % square, window edge = 12.5 % thin pulse). Velocity mapping, grace notes, stack, clank mute: untouched. The tank's walking notes ride whatever duty the last kill set, exactly as they ride the cutoff today (keep that comment's spirit).

`dutyToWidth(d)`: derive the mapping from Tone 14.8.49's `PulseOscillator` source (read it: https://unpkg.com/tone@14.8.49/build/esm/source/oscillator/PulseOscillator.js — `width` is −1..1 and 0 is a square; determine which sign narrows the HIGH half of the cycle and write the formula so that d is the fraction of the period spent high). Pin it with a test that also asserts monotonicity and clamping to `[0.05, 0.5]`.

**Tests:** source scan that the tightness block contains the width write on the chip arm and the cutoff write on the off arm; `vm` test of `dutyToWidth`; a graph test: extract `buildDrums` (or whatever builds 5142–5155) into a `vm` context with a fake `Tone` whose constructors record `(name, options)` and whose `.connect` records edges — with CHIP_* all false the recorded sequence must equal a fixture captured from `589c3db` (build the fixture in the same test from `git show 589c3db:aim-dojo-main.js` via `tests/source.js` style extraction, or check it in as JSON — your call, say which); with CHIP_LEAD true the only differences are the lead's oscillator options and the filter cutoff.

### A2 — DRY (no delays)

**Today:** three tempo-notation delays — arp 5150 `FeedbackDelay({delayTime:'8n',feedback:0.2,wet:0.28})`, lead 5153 `('8n',0.18,0.2)`, tune 5154 `('8n',0.12,0.15)`. **Finding to preserve in a comment:** `'8n'` is converted to seconds at construction, before `Tone.Transport.bpm` is set for the run, so these are FIXED ≈0.25 s slaps, not eighths (an eighth at 28 BPM is 1.07 s). Do not "fix" them to follow BPM — the user is auditioning with vs without.

**Change (CHIP_DRY):** construct the three chains WITHOUT the FeedbackDelay node (LP → Volume → drumBus), same volumes. Off arm: exact current chains including the `'8n'` literals.

**Tests:** graph test extension — CHIP_DRY true removes exactly three `FeedbackDelay` constructions and nothing else.

### A3 — THE BASS IS A TRIANGLE, UP AN OCTAVE

**Today:** `bass` (5149) sawtooth → LP 520 → Volume(−6) → drumBus; triggered at 5091, 6716, 6737 (grep `bass.triggerAttackRelease` for any others) with `CHORD_ROOT[...]` values.

**Change (CHIP_BASS):** oscillator `triangle`, NO filter node (NES triangle is unfiltered), `Volume(CFG.chip.bassDb)`; every trigger goes through `bassNote(n)` which on the chip arm returns the note one octave up (`Tone.Frequency(n).transpose(12)` handles Hz numbers and note names alike — check what `CHORD_ROOT` holds first) and on the off arm returns `n` unchanged. A triangle at C1 vanishes on laptop speakers; NES composers wrote bass an octave up.

**Tests:** `bassNote` `vm` test (off → identity; on → ×2 for Hz, +12 for names); graph test extension; source scan that every `bass.triggerAttackRelease(` call site passes through `bassNote(`.

### A4 — THE HUMS ARE THIN PULSES (pitch = k must survive a laptop speaker)

**Today:** each Echo's native hum (5612–5631) is `osc.type='sine'` (5614) → gain 0.55 → lowpass → 16th gate → dry gain → PositionalAudio panner, plus a reverb send to the shared convolver; gold adds a detuned twin `o2` (5641, also sine); mover adds slow pitch modulation; singing retunes `osc.frequency`. This is the THREE listener's native context, not Tone.

**Change (CHIP_HUMS):** `osc.setPeriodicWave(pulseWave(ctx))` (and the same for `o2`) where `pulseWave(ctx)` returns ONE shared `PeriodicWave` per context (memoize on the ctx) built from the Fourier coefficients of a **12.5 % duty pulse** (duty from `CFG.chip.dutyEdge`), band-limited to `CFG.chip.humHarmonics` harmonics, DC removed, `disableNormalization:false`. Lower the hum's amplitude gain from 0.55 to `CFG.chip.humGain` on the chip arm (a pulse is perceptually louder). LFO, gate, filter, send, panner, detune, singing: untouched — the hum stays the same information voice with a waveform that carries harmonics.

**Tests:** `vm` test of the coefficient builder against the closed form for a pulse of duty d (derive both real and imag arrays for a pulse that is high on `[0, dT)`; assert the DC term is zero, the harmonic count, and that the `n·d` integer zeros fall where the closed form says); source scan that the chip arm calls `setPeriodicWave` on both `osc` and `o2` and the off arm keeps `osc.type='sine'`.

### A5 — THE PAD IS ONE PULSE CHANNEL (frame-rate chord arpeggio) — default OFF, build last

**Today:** `pad` (5152) is a triangle `PolySynth` → LP 1400 → Volume(−17) → drumBus, triggered with single notes or chord arrays at 2149, 5090, 5298 (triad on the third volley), 5303 (dyad), and in the Bow near 6737.

**Change (CHIP_PAD):** on the chip arm `pad` is a MONO pulse `Tone.Synth` (`width:dutyToWidth(CFG.chip.padDuty)`, same envelope, LP 1400 kept, same Volume) and every pad trigger goes through `padChord(notes, dur, at, vel)`: a single note plays as today; an array of N notes triggers ONE attack and schedules `pad.oscillator.frequency.setValueAtTime(f_i, at + i·(1/CFG.chip.arpHz))` cycling through the notes for the duration (`Tone.Time(dur).toSeconds()`), then releases — the NES way of sounding a chord on one channel. A dyad becomes a two-note cycle, a triad a three-note cycle, so volley identity is preserved as cycle length. Off arm: the PolySynth and direct `triggerAttackRelease` calls exactly as today. This is the riskiest parcel for zen; default OFF, the user turns it on with `?chip=lead,pad`.

**Tests:** `vm` test of `padChord` with a fake synth recording attacks, frequency automation times, and releases (single note → one triggerAttackRelease; 3 notes over `'2n'` at 30 Hz → the right number of steps, cyclic order, one release); source scan that every pad trigger site goes through `padChord(`.

---

## Verification (run all after every parcel; paste the final run)

```bash
node --test tests/*.test.js                          # 347 + yours, all green
node tools/extract-inline.mjs                        # regenerate mirrors — LAST step of each parcel
# swallow scans — both must print only the count 0
node -e 'const L=require("fs").readFileSync("aim-dojo-main.js","utf8").split("\n");let n=0;for(let i=0;i<L.length;i++){const s=L[i];let idx=-1,p=0;while(true){p=s.indexOf("//",p);if(p<0)break;if(p>0&&s[p-1]===":"){p+=2;continue;}idx=p;break;}if(idx<0)continue;const t=s.slice(idx+2).trimEnd();if(/\)\s*;\s*$/.test(t)&&/[A-Za-z_$][\w$]*\(/.test(t)){n++;console.log(i+1)}}console.log("tail-call:",n)'
node -e 'const L=require("fs").readFileSync("aim-dojo-main.js","utf8").split("\n");let n=0;for(let i=0;i<L.length;i++){const s=L[i];let idx=-1,p=0;while(true){p=s.indexOf("//",p);if(p<0)break;if(p>0&&s[p-1]===":"){p+=2;continue;}idx=p;break;}if(idx<0)continue;const t=s.slice(idx+2);if(/[A-Za-z_$][\w$]*\(.*\)\s*;\s+\/\//.test(t)){n++;console.log(i+1)}}console.log("mid-call:",n)'
node --check aim-dojo-main.js
git status --short                                   # aim-dojo-main.js, README.md, tests/…, tools/*mirror* — nothing else
```

Boot smoke (no GPU judgement needed — just "no page errors"): serve locally (`python -m http.server 8931` from the repo root), open `http://127.0.0.1:8931/?chip=all` and `?chip=0` and `?hi`, confirm the console is clean and PLAY lights. Do not play a night on the production site.

## Ear-test recipe for the user (put this verbatim in your final message)

Serve locally and open one at a time, each for an evening or a few minutes, reloading between:
- `http://127.0.0.1:8931/` — crunch look + pulse lead (A1 on by default)
- `?chip=0` — today's sound, for reference
- `?chip=lead,dry` — pulse lead, no delays
- `?chip=lead,dry,bass` — plus the triangle bass up an octave
- `?chip=lead,dry,bass,hums` — plus thin-pulse orb hums
- `?chip=all` — plus the one-channel chip pad
- `?hi` — the smooth render, for reference
Judge: does tightness read as a *shape* change (square → thin) on laptop speakers? Do the orb pitches (near vs far) read better or worse? Does the dry mix feel like the chalk? Keep what you keep by flipping the CFG defaults.

## Final message format

Per parcel (V1, A1, A2, A3, A4, A5): the exact `aim-dojo-main.js` line ranges changed (post-edit), the knob and its default, the `dutyToWidth` formula you derived and the PulseOscillator lines it came from, the LOW→WEAK classification table (V1), test names added, and anything you deviated from and why. Then the verification output. Then the ear-test recipe. Then concerns, plainly — especially any place where a chip arm could not be kept graph-identical on the off arm.
