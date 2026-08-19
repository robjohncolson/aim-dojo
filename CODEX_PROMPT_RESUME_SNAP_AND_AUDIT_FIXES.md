# Codex prompt — Snappy RESUME + 2026-08-19 audit fixes

**Working directory:** `/home/mrcolson/repos/aim-dojo` (branch `main`, tree clean at start).
**Do not commit. Do not push. Do not run `gitnexus analyze` or edit `CLAUDE.md`/`AGENTS.md`.** Leave the working tree modified; the dispatcher (Claude) runs GitNexus `detect_changes`, an adversarial review, then commits.

---

## Mission

Ship eight small, surgical fixes to **Moon Chorus** (`index.html` — a ~10,000-line single-file Three.js r128 + Tone.js 14.8.49 rhythm shooter). Seven come from a verified code audit run today; one (W2) is the player-facing complaint that motivated this pass: *"a kid pressed Esc, got to the menu, and we had a hard time resuming play — the menu feels boggy."* Every item below was **traced and adversarially verified at file:line**; the line numbers are exact as of HEAD `2664b6d`. Trust the numbers, but re-read each site before editing — this file is dense and one line often carries several statements plus a long `//` rationale comment.

Identity to preserve (from CLAUDE/handoff): first-person rhythm shooter under a real sky; kill judged at ARRIVAL; WASD on the "and"; Zen feel — **no new UI panels**, tune constants, keep the dense commented style. `prefers-reduced-motion` and the 20 fps idle throttle (`IDLE_FRAME_MS`) are deliberate; do not touch them.

## Hard rules for editing `index.html`

1. **Never append code after a `//` comment. Never delete a statement with a regex/sed.** This exact mistake caused W1: a mechanical deletion joined the next line onto the previous line's `//` tail, silently turning live statements into comment text (twice: `e172584`, `97b6134`). Put every new statement on its own line *before* any trailing comment. After all edits run the swallow scans in §Verification.
2. `tools/index-inline.mirror.part*.js` are GENERATED mirrors of `index.html` (same line numbers). **Never edit them.** After your last `index.html` edit run `node tools/extract-inline.mjs` to regenerate them (commit-ready; the dispatcher re-indexes).
3. Match the local style: single-line statements, `//` rationale comments that say *why* (read the neighbours), `T('key','default')` for any player-visible string with a JA entry beside the other strings (see `toneFailedHtml` near line ~835 for the pattern), `try{}catch(e){}` around storage/DOM.
4. Do not refactor, rename, reorder, or "clean up" anything outside the listed edits. No hygiene deletions (a separate decision).
5. `node --test tests/*.test.js` must pass (183 at baseline) plus the new tests you add.

---

## Work items

### W1 — Restore two statements swallowed into comments by `97b6134` (HIGH, live regression)

**W1a `index.html:7541` — `onExpire`.** The physical line reads
`if(CFG.tank.fillOnly && tg.fill16>=0){ removeTarget(tg); return; }   // THE TANK IS A DRUM FILL, … every orb keeps today's expiry exactly removeTarget(tg); state.streak=0; pushEvent(false); showTiming(T('faded','FADED'),T('fadedSub','listen for the next'),'off');`
— everything after the first `//` is comment. Verify with `git show 97b6134 -- index.html` (hunk `@@ -7511,9 +7500,8 @@`): the former separate line `retireTrail(tg, 0.3); removeTarget(tg); state.streak=0; pushEvent(false); showTiming(...)` lost `retireTrail` and its remainder was appended to the comment.
Effect today, for **every ordinary orb that times out**: `animate` (`:8722`) calls `dropTarget(tg); onExpire(tg);` — `dropTarget` (`:7169`) only unlinks the record from `targets`; `removeTarget` (`:7358`) is the sole path to `stopTargetSound/releaseTargetMesh/releaseTargetRecord`. So the mesh stays in the scene forever (zombie orbs, unhittable, survive into the Temple), its oscillator keeps running with the 16th-gate frozen wherever it was (stacked hum on RESUME), the streak never resets on a miss, `pushEvent(false)` never feeds the adaptive engine / Quiet Tick / range creep, and FADED never shows.
**Fix:** split the line: keep `if(CFG.tank.fillOnly && tg.fill16>=0){ removeTarget(tg); return; }` with its full comment on its own line, then on the NEXT line, before `playWhiffSfx();`:
`removeTarget(tg); state.streak=0; pushEvent(false); showTiming(T('faded','FADED'),T('fadedSub','listen for the next'),'off');`
(No `retireTrail` — the trail is gone.) Blast radius (GitNexus `impact upstream`): LOW — only caller is `animate`.

**W1b `index.html:8417` — `resolveFlickLock`.** `playHit(0); chordHit(state.streak);   // FLAWLESS lead note … growing streak killTarget(tg, true);   // clutch=true → …` — `killTarget(tg, true);` sits after the first `//`. Same commit, hunk `@@ -8388,8 +8377,7 @@`. Dormant today (`CFG.flickBonus.on:false`, `:1053`) but broken if revived.
**Fix:** `playHit(0); chordHit(state.streak); killTarget(tg, true);   // FLAWLESS lead note … // clutch=true → …` (statement out of the comment, comments preserved).

**W1c — Guard test.** Add to `tests/index-contract.test.js`:
- a test that scans every inline `<script>` of `index.html` line by line and fails if a `//` comment tail (ignore `://`) matches either swallow shape: `/[A-Za-z_$][\w$]*\([^()]*\)\s*;\s*$/` (call statement ending the comment) or `/[A-Za-z_$][\w$]*\([^()]*\)\s*;\s+\/\//` (call statement inside a comment followed by another `//`). At HEAD exactly lines 7541 and 8417 trip it; after W1a/W1b it must find zero. Print the offending line numbers in the assertion message.
- a test that extracts the source of `function onExpire(tg){…}` (regex on `index.html`) and asserts, with a tiny `vm` stub context (`removeTarget`, `pushEvent`, `showTiming`, `playWhiffSfx`, `missGrooveDuck`, `addTrauma`, `T`, `CFG={tank:{fillOnly:true},hitTrauma:0}`, `state={streak:3}`, `reduceMotion=true`), that calling it with `{kind:0, fill16:-1}` calls `removeTarget` and `pushEvent(false)` and sets `state.streak` to 0. Look at how `tests/groove-pocket.test.js` extracts functions from `index.html` and reuse the pattern.

### W2 — Snappy, reliable RESUME after Esc (the player complaint) (MEDIUM)

**What happens today.** Esc while pointer-locked → the browser drops the lock → `pointerlockchange` (`:9840-9844`) → `exitRunning()` → `showPause()`. The card is cheap (measured 2.5 ms; idle frames 98.7 % idle) — the bogginess is not CPU. Click RESUME → `startRun` (`:9714`) → `canvas.requestPointerLock()` (`:9728`) and the run only enters when `pointerlockchange` fires. **Chromium rejects any pointer-lock request made within 1250 ms of the user pressing Esc to leave a lock** (`chrome/browser/ui/exclusive_access/pointer_lock_controller.cc`, `kEffectiveUserEscapeDuration = 1250 ms`; a user gesture does NOT exempt it, only fullscreen does). The rejection fires `pointerlockerror`, whose handler (`:9737`) is `()=>{ if(!state.running) enterRunning(); }` — so a quick RESUME **enters the run with no pointer lock: the mouse does not look, the OS cursor floats over the canvas, and clicks fire**. Nothing relocks in-run: the only in-run relock (`:7560`) is gated on `_templeNeedsRelock`. The player has to Esc again and RESUME a second time. That is the "hard time resuming".

**Design (no new UI):**
1. Near `:1146` (`let _templeBlend=0, _templeFocus=null, _templeEscapeGuard=false, _templeNeedsRelock=false;`) add module state: `_lockLostAt=-1e9` (perf.now of the last browser-side lock loss during a run), `_lockRetryT=null`, `_lockRetries=0`, `_runNeedsRelock=false`. Add a CFG-style const beside `IDLE_FRAME_MS`'s neighbours or near `startRun`: `const LOCK_COOLDOWN_MS=1350;` (Chromium's 1250 + margin) with a comment naming the Chromium constant.
2. `pointerlockchange` (`:9840-9844`): in the lock-acquired branch also `clearTimeout(_lockRetryT); _lockRetryT=null; _lockRetries=0; _runNeedsRelock=false;`. In the `else if(state.running) exitRunning();` branch record `_lockLostAt=performance.now();` first.
3. Replace the one-line `pointerlockerror` listener (`:9737`) with a named `function onPointerLockError()`:
   - if `state.running`: this was an in-run relock attempt (W2 step 5) that failed → `_runNeedsRelock=!MOBILE;` and return (the next canvas click tries again).
   - else if `!MOBILE && performance.now()-_lockLostAt < LOCK_COOLDOWN_MS && _lockRetries<2`: we are inside Chromium's post-Esc cooldown → `_lockRetries++`; acknowledge the click by setting the RESUME label to `T('resumeWait','ONE MOMENT…')` (via `beginLabel`/`beginBtn` exactly as `showPause` sets `primaryLbl`; add the JA string beside the others); `clearTimeout(_lockRetryT)`; `_lockRetryT=setTimeout(retry, Math.max(80, LOCK_COOLDOWN_MS-(performance.now()-_lockLostAt)+40))` where `retry` = `_lockRetryT=null; if(state.running || overlay.classList.contains('hidden')) return; try{ canvas.requestPointerLock(); }catch(e){ enterRunning(); }`. The retry still runs inside the click's transient user activation (Chromium: 5 s), so it is accepted once the cooldown lapses → `pointerlockchange` → `enterRunning()` locked. Return.
   - else (lock genuinely unavailable, or retries exhausted): `_runNeedsRelock = !MOBILE && !!canvas.requestPointerLock;` then `enterRunning();` — today's fallback, so nobody is ever stuck on the card.
   Also in `startRun`'s desktop branch (`:9728`), reset `_lockRetries=0` and clear any pending `_lockRetryT` before `requestPointerLock()` (each RESUME click gets a fresh budget), and restore the label to RESUME when the run enters (`showPause` rewrites it on the next pause anyway; `enterRunning` hides the overlay — a restore in `enterRunning` is enough: if the label currently shows `resumeWait`, set it back to `T('resume','RESUME')`).
4. `canvas` `mousedown` (`:7556-7562`): before `fire();` add, mirroring the temple line: `if(_runNeedsRelock && !MOBILE && document.pointerLockElement!==canvas && canvas.requestPointerLock){ _runNeedsRelock=false; try{ canvas.requestPointerLock(); }catch(_e){} return; }` — a run that had to enter without the lock (fallback) re-engages aim on the first click instead of firing blind.
5. Pad-started and touch runs never lock (`viaPad`, `MOBILE`): make sure none of the above changes their paths (`_runNeedsRelock` must stay false for them; the `!MOBILE` guards do that — keep them).
6. Add a contract test: the `pointerlockerror` handler references `LOCK_COOLDOWN_MS` and `_lockLostAt`, `pointerlockchange` writes `_lockLostAt`, and the canvas mousedown handler contains the `_runNeedsRelock` relock branch before `fire()`.

Blast radius: `enterRunning`/`exitRunning` are MEDIUM (callers: `pointerlockchange`, `startRun`, `pollGamepad`, `bowFinish`, visibilitychange, touch pause) — you are not changing their bodies except the one label restore; keep the edits in the listeners and `startRun`.

### W3 — Cloud-pref reconcile reload loop with URL flags (HIGH)

`LOW` (`:1109-1112`) is resolved with `?hi`/`?low` winning over the persisted `aimdojo.lowRez`; `SKY_MODE` (`:1124-1130`) with `?sky=` winning and rewriting `aimdojo.skyMode` every boot. `applyCloudPrefsRow` (`:9068-9071`, `:9082-9085`) sets `needsReload` when the signed-in row's `low_rez`/`sky_mode` disagrees with `LOW`/`SKY_MODE`, then `:9096` `location.reload()` with the query string intact → the flag wins again → the row is unchanged (`sky_mode` is only written to the cloud at row creation; no `queueCloudPrefs({sky_mode})` exists) → **unbounded reload loop** for any signed-in player using `?hi` (the documented escape hatch for a false weak-GPU detection), `?low`, or `?sky=`.
**Fix:** at the resolvers record `const LOW_FROM_URL = …` (true when `?hi` or `?low` matched) and `const SKY_MODE_FROM_URL = !!fromUrl` (expose it from the IIFE the same way `SKY_MODE` is), then in `applyCloudPrefsRow`: `if(row.low_rez!==LOW && !LOW_FROM_URL) needsReload=true;` and `if(row.sky_mode!==SKY_MODE && !SKY_MODE_FROM_URL) needsReload=true;`. localStorage still receives the cloud value, so the next flag-free load agrees with the row (matches the existing comment "URL always wins once for the session that set it"). Blast radius LOW (callers `skyHandleSession` → `skyAcceptAuthSession`). Add a contract test asserting both `needsReload` lines carry the `_FROM_URL` guard.

### W4 — `audioLat()` never sees `outputLatency` (MEDIUM — timing feel)

`:5152` `function audioLat(){ return (((rawCtx && (rawCtx.outputLatency||rawCtx.baseLatency))||0)) + _userOffsetSec; }`. `rawCtx` (`:5507`) is `Tone.getContext().rawContext` — in Tone 14.8.49 that is **standardized-audio-context's wrapper**, which exposes `baseLatency` only (`grep -c outputLatency` in the Tone bundle = 0). So the term is always `baseLatency` (~3–10 ms) and the intended correction (comment `:5151`: "ADDED to the reported output latency so the beat windows line up with what the player actually HEARS") never happens — real output latency is ~20–45 ms wired desktop, 80–200+ ms Bluetooth/Android. `audioLat` has 6 direct callers (`wasdBeatsHeard`, `voiceQ`, `volleyNote`, `timingErrorMs`, `fillOff16`, `bowNote`) and sits in the arrival-judgement flow — changing its value shifts every judged window and the glow, together, toward the heard beat.
**Fix (behind a const so the user can react):** add `const AUDIO_OUT_LATENCY=true;` beside `audioLat` with a comment, and make `audioLat` read the *native* context: `const n=(listener&&listener.context)||null;` (THREE's `AudioListener` context is a native `AudioContext` on the same output device — a public-API proxy for Tone's private `_nativeAudioContext`) then `const out=AUDIO_OUT_LATENCY ? ((n&&n.outputLatency)||0) : 0; return (out || (rawCtx&&rawCtx.baseLatency) || 0) + _userOffsetSec;`. Keep the `||` fallbacks: `outputLatency` is 0/undefined until the context renders and is absent in Safari; `listener` is null before `ensureListener`. Do NOT sum base+output (keep the original OR semantics — one estimate, not two). Add a contract test that `audioLat`'s source references `outputLatency` on `listener.context` and the const. **Report clearly in your final message that a calibrated player should press CALIBRATE once after this ships** (their stored `aimdojo.offsetMs` was absorbing the missing term).

### W5 — CALIBRATE does not sync the offset to the cloud (MEDIUM)

`calibBtn` click (`:9016-9022`) sets `_userOffsetSec`, `offSlider.value`, and `localStorage['aimdojo.offsetMs']` — but, unlike the slider's `change` listener (`:9015`), never `queueCloudPrefs({offset_ms})`; setting `.value` programmatically fires no `change`. `applyCloudPrefsRow` (`:9063-9066`) then overwrites memory + localStorage with the stale cloud value on the next boot.
**Fix:** after the localStorage write in the calibBtn handler add `try{ queueCloudPrefs({offset_ms:ms}); }catch(e){}`. Touches that listener only.

### W6 — First run is dry (no reverb) on PLAY-first / pad-first starts (LOW)

`initAudio` (`:5499-5501`) calls `scheduleReverbBuild()` (`:5436`), which defers `buildReverb` to `requestIdleCallback`/`setTimeout` and re-defers for as long as `state.running` is true. When the first `initAudio` happens inside `startRun` (first gesture = PLAY; `chorusBootSkip` `:9779` deliberately ignores `#beginBtn/#beginTrain`) and `enterRunning()` follows synchronously (`MOBILE`, pad, or an already-running ctx), `state.running` is true before the idle callback ever fires → `reverbInput` stays null all run → every orb spawned takes the `if(reverbInput)` miss at `:5935` and has no distance send.
**Fix in `initAudio` only:** replace `scheduleReverbBuild();` with `if(!reverbInput && listener && !state.running) buildReverb(); else scheduleReverbBuild();` — `makeIR` is ~2–4 ms once, inside the PLAY gesture, before the first frame (the pre-`a9e0cdd` behaviour). Read `buildReverb` (`:5428`) first to confirm it is idempotent/guarded the way `scheduleReverbBuild`'s `run` expects.

### W7 — Module cache skew on Vercel (LOW, deploy hygiene)

`vercel.json:22-28` gives every `/(.*)\.(js|css|woff2?)` `public, max-age=604800, stale-while-revalidate=86400`, while `/` and `/index.html` are `max-age=0, must-revalidate`. The five bare-`src` modules (`index.html:895-899`: `observer-location.js`, `local-sky.js`, `sky-temple.js`, `sky-maps.js`, `save-my-sky.js`, ~79 KB total) are therefore served up to 8 days stale against a fresh `index.html` — e.g. `c7cbeee`'s `timezoneDisagrees` guard (`index.html:1163`) is silently inert for returning players until their cache expires.
**Fix:** in `vercel.json` narrow the third rule to `/(.*)\.(css|woff2?)` and add a rule for `/(observer-location|local-sky|sky-temple|sky-maps|save-my-sky)\.js` → `public, max-age=0, must-revalidate` (ETag revalidation is a cheap 304). Keep `/assets` and `/fixtures` at 7 days. Add one line to `README.md` next to the existing cache/deploy notes stating that root modules revalidate on every load. Do not touch the `<script src>` tags.

### W8 — Nothing else

Out of scope (decided elsewhere): hygiene deletions (`avgReaction`, decoy branches, `lifeBeatsEff`, …), the Three.js-CDN-failure message, the unreachable Tone-failed copy, unifying the two AudioContexts, the starChorus read-merge-write. Do not do them.

---

## Verification (run all; paste results in your final message)

```bash
node --test tests/*.test.js                          # 183 + your new tests, all green
node tools/extract-inline.mjs                        # regenerate mirrors (LAST index.html step)
# swallow scans — both must print only the count 0
node -e 'const L=require("fs").readFileSync("index.html","utf8").split("\n");let n=0;for(let i=0;i<L.length;i++){const s=L[i];let idx=-1,p=0;while(true){p=s.indexOf("//",p);if(p<0)break;if(p>0&&s[p-1]===":"){p+=2;continue;}idx=p;break;}if(idx<0)continue;const t=s.slice(idx+2).trimEnd();if(/[A-Za-z_$][\w$]*\([^()]*\)\s*;\s*$/.test(t)){n++;console.log(i+1)}}console.log("tail-call:",n)'
node -e 'const L=require("fs").readFileSync("index.html","utf8").split("\n");let n=0;for(let i=0;i<L.length;i++){const s=L[i];let idx=-1,p=0;while(true){p=s.indexOf("//",p);if(p<0)break;if(p>0&&s[p-1]===":"){p+=2;continue;}idx=p;break;}if(idx<0)continue;const t=s.slice(idx+2);if(/[A-Za-z_$][\w$]*\([^()]*\)\s*;\s+\/\//.test(t)){n++;console.log(i+1)}}console.log("mid-call:",n)'
git status --short                                   # index.html, vercel.json, README.md, tests/index-contract.test.js, tools/index-inline.mirror.part*.js — nothing else
git diff --stat
```

## Final message format

For each of W1a, W1b, W1c, W2, W3, W4, W5, W6, W7: the exact `index.html` line ranges you changed (post-edit numbers), a one-line summary, and anything you deliberately deviated from and why. Then the verification output. Then any concern you have about a change (e.g. an interaction you noticed) — say it plainly; the reviewer will check it.

---

# ROUND 2 — fixes from the adversarial review (2026-08-19)

The first implementation of W1–W7 is in the working tree. An adversarial review (Codex, read-only) proved five defects by executing the actual handlers. Fix exactly these, keeping every hard rule above (no code after `//`, regenerate mirrors last, no new UI, tests green). Line numbers are post-round-1.

### R1 (blocker, W2) — `_runNeedsRelock` re-armed forever
`onPointerLockError` (`:9749-9750`): `if(state.running){ _runNeedsRelock=!MOBILE; return; }` re-arms after EVERY failed in-run relock, so when pointer lock is permanently unavailable every canvas click (`:7569`) is swallowed as a relock and the player can never fire (combat or Temple). **Fix:** add `_relockTries=0` to the W2 state line; in the canvas mousedown relock branch increment it before requesting; in `onPointerLockError`'s running branch set `_runNeedsRelock = !MOBILE && _relockTries<1` (one in-run relock attempt, then clicks fire unlocked as before this change); reset `_relockTries=0` wherever `_runNeedsRelock` is set true in the fallback path and on successful lock (`pointerlockchange` acquired branch).

### R2 (major, W2) — retry timer / label survive pad START, a new pause, tab-hide
`_lockRetryT` is only cleared by desktop `startRun` or a successful lock; a pending retry can fire after a pad START already entered the run and the player paused again (late `requestPointerLock` → `pointerlockchange` → `enterRunning()` restarts a deliberately paused run), or fire in a hidden tab (`pointerlockerror` → fallback `enterRunning()` in the background; the `visibilitychange` visible branch never pauses it). **Fix:** add `function cancelLockRetry(){ clearTimeout(_lockRetryT); _lockRetryT=null; _lockRetries=0; /* restore the RESUME label if it shows resumeWait (move the restore code out of enterRunning into here and call cancelLockRetry() from enterRunning) */ }` next to `onPointerLockError`; call `cancelLockRetry()` from: `enterRunning` (replacing the inline label restore), `exitRunning` (start of function), the `viaPad===true` branch of `startRun`, and the `document.hidden` branch of the `visibilitychange` listener. Guard: in `retry` and in the fallback branch of `onPointerLockError`, `if(document.hidden) return;` (leave the card up; the player clicks RESUME again). Keep the desktop `startRun` reset (`_lockRetries=0; clearTimeout...`) — it can simply call `cancelLockRetry()` too.

### R3 (major, W4) — clamp `audioLat`'s output-latency term
`:5155-5158` passes 0.224, 1.2, Infinity, -0.1 straight through. **Fix:** accept only finite values in (0, 0.35]: `let out=0; if(AUDIO_OUT_LATENCY && n && typeof n.outputLatency==='number' && isFinite(n.outputLatency) && n.outputLatency>0) out=Math.min(n.outputLatency,0.35);` (0.35 s keeps real Bluetooth in range; `_userOffsetSec` is already clamped to [-0.3,0.4]). Update the W4 contract test to assert the clamp (`0.35`) and the isFinite guard textually; better, make it behavioral: extract `audioLat`'s source into a `vm` context with `listener={context:{outputLatency:X}}`, `rawCtx={baseLatency:0.01}`, `_userOffsetSec=0`, `AUDIO_OUT_LATENCY=true` and assert: X=0.03→0.03, X=1.2→0.35, X=Infinity→0.01 (falls back to baseLatency), X=-0.1→0.01, X=undefined→0.01.

### R4 (major, W6) — synchronous `buildReverb()` can abort `startRun`
`initAudio` (`:5508`) now calls `buildReverb()` synchronously; on a closed/bad context `createConvolver()` throws `InvalidStateError` and the exception escapes `initAudio` → `startRun` aborts → PLAY does nothing. **Fix:** make `buildReverb` (`:5435-5441`) fail-soft: build into locals inside `try{…}catch(e){ return; }` and assign `reverbInput` only after all connections succeed (so a half-built graph is never published), and wrap the synchronous call in `initAudio` as `try{ buildReverb(); }catch(e){}` as belt-and-braces.

### R5 (minor, W1c) — swallow-scan test misses nested calls
The regex `[A-Za-z_$][\w$]*\([^()]*\)\s*;\s*$` cannot match a tail ending in `showTiming(T('faded','FADED'),T('fadedSub','…'),'off');` — the exact original W1a shape — because `[^()]*` forbids nested parens. **Fix:** in the test use shape A = comment tail (trimmed) ends with `/\)\s*;\s*$/` AND contains a call `/[A-Za-z_$][\w$]*\(/`; shape B = `/[A-Za-z_$][\w$]*\(.*\)\s*;\s+\/\//` (a call statement inside the comment followed by another `//`). Run it: it must still report zero offenders on the fixed file; if a legitimate prose comment trips it (e.g. "…call foo();"), print the line and tell the dispatcher rather than weakening the regex — but first check by running, do not assume.

Not in scope for round 2: the Firefox/Safari "ONE MOMENT…" nuance (accepted), CLAUDE.md/AGENTS.md count edits (dispatcher's re-index, intentional).

Verification: same block as above (tests, mirror regen, both swallow scans — run the NEW looser scans too), plus `git diff --stat`. Final message: per-item line ranges + verification output + concerns.

---

# ROUND 3 — in-flight request intent (2026-08-19, from the round-2 review)

Round 2 is applied. The reviewer proved (VM-executing the real handlers) that a pointer-lock REQUEST already issued can resolve a few ms after the player has paused/pad-paused/hidden the tab, and both handlers then act on current state: a late in-run relock `pointerlockerror` after `exitRunning()` is taken for a RESUME failure (`onPointerLockError`'s fallback → `enterRunning()`), and a late successful `pointerlockchange` enters unconditionally. Also: a `pointerlockerror` arriving while hidden (after `visibilitychange` already cancelled) recreates the wait label/timer, and the retry's hidden guard returns without cleanup → "ONE MOMENT…" stays until the next RESUME click. Fix with ONE extra boolean, nothing heavier:

### R6 — `_lockReqPending` (request intent)
- Add `_lockReqPending=false` to the W2 state line (`:1148`). Meaning: "a RESUME/PLAY pointer-lock request is in flight and its outcome should enter the run".
- Set it `true` immediately before the two RESUME-path requests only: `startRun`'s desktop branch (`:9745`, before `canvas.requestPointerLock()`) and the `retry` closure in `onPointerLockError` (before its `canvas.requestPointerLock()`). The in-run relock requests (canvas mousedown `_runNeedsRelock`/`_templeNeedsRelock` branches, `:7572-7573`, and the temple relock at ~`:7560`/`4687`) must NOT set it.
- Clear it in `cancelLockRetry()` (so `enterRunning`, `exitRunning`, pad start, tab-hide and a fresh RESUME click all clear it).
- `onPointerLockError`: in the `!state.running` path, first `if(!_lockReqPending) return;` (a stale error from an in-run relock that landed after a pause is ignored — the card stays up, nothing enters). Then `_lockReqPending=false;` before the cooldown/fallback decision (the retry sets it again when it actually requests).
- `pointerlockchange` acquired branch (`:9875`): if `!state.running && !_lockReqPending` → this is a late acquisition nobody asked to enter with (a relock that resolved after a pause, or a hidden-tab/pad-paused late success): `try{ document.exitPointerLock(); }catch(e){}` and return WITHOUT `enterRunning()` (keep the `cancelLockRetry(); _relockTries=0; _runNeedsRelock=false; _templeEscapeGuard=false; _templeNeedsRelock=false;` bookkeeping before returning). Otherwise unchanged (enter). Make sure the FIRST PLAY/RESUME on desktop still enters: it goes through `startRun`'s desktop branch which sets the flag.
- Also treat `document.hidden` in that acquired branch the same way (exit the lock, do not enter).

### R7 — hidden-tab label/timer leak
- At the top of `onPointerLockError` (before the `state.running` check): `if(document.hidden){ cancelLockRetry(); return; }`.
- In the `retry` closure: if `document.hidden` → `cancelLockRetry(); return;` (instead of a bare return).

### Tests
Add two behavioral `vm` tests (extract `onPointerLockError`, `cancelLockRetry` and the `pointerlockchange` listener body from `index.html` into a context with stubs for `state`, `overlay`, `canvas` (with a `requestPointerLock` that records calls), `document` (`hidden`, `pointerLockElement`, `exitPointerLock` recorder), `beginLabel`, `T`, `MOBILE=false`, `performance`, timers, `enterRunning`/`exitRunning` counters and the W2 lets): (1) late in-run relock error after pause → `enterRunning` NOT called, card state unchanged; (2) late `pointerlockchange` acquisition with no pending request → `exitPointerLock` called, `enterRunning` NOT called; and a positive control: RESUME request (pending=true) + acquisition → `enterRunning` called once. Look at the existing W4/W6 behavioral tests for the extraction style.

Verification: same block as before (tests, mirror regen last, both swallow scans incl. loose shapes, diff stat). Final message: line ranges + verification + concerns.

---

# ROUND 4 — one line (2026-08-19, from the round-3 sign-off review)

### R8 — `_lockReqPending` must be cleared only by `cancelLockRetry`
`onPointerLockError` (`:9762`) clears `_lockReqPending=false` before deciding retry/fallback. A stale error from an older request A can therefore clear the intent of a NEWER request B (RESUME A → pad START → pad pause → RESUME B → A's late error → B's acquisition is released at `:9878`). **Fix:** delete the `_lockReqPending=false;` statement at `:9762` (keep the `if(!_lockReqPending) return;` guard above it). The flag stays "live run-entry intent" through the error/retry interval; `cancelLockRetry()` (called by enterRunning/exitRunning/pad start/tab-hide/acquired/hidden-error) remains its only clearing authority, and the fallback `enterRunning()` clears it via cancelLockRetry. Update the test assertion at `tests/index-contract.test.js:85` that currently requires the clear, and add one VM regression: old error → new RESUME request → new acquisition ⇒ `enterRunning` called once, `exitPointerLock` not called. Mirrors regenerated last; tests green; swallow scans 0. Nothing else.
