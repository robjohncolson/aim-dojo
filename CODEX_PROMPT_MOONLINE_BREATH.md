# Codex prompt — Wave 11.1: THE BREATH (the enfilade exhales · the walls hear you)

**Working directory:** `/home/mrcolson/repos/aim-dojo` (branch `main`, clean at start).
**Authoritative spec:** `SPEC_MOONLINE_BREATH.md` — read IN FULL first; where this brief and the spec disagree, the spec wins. Read `SPEC_MOONLINE_ENFILADE.md` for the wave-11 system you are refining (walls, uK plumbing, dissolve machinery, kill-switch law).

**Do not commit. Do not push. Do not run `gitnexus analyze`. Do not edit `CLAUDE.md`/`AGENTS.md`.** Leave the tree modified.

## Hard rules (every one has caught a real bug in this repo)
1. Never append code after a `//` comment; never delete statements with regex/sed; swallow-scan test stays green.
2. Mirrors are GENERATED; `node tools/extract-inline.mjs` as your LAST index.html step.
3. NO lane-colour literal anywhere; neither effect touches lane colour at all (the ripple is warm-white, the dim is multiplicative).
4. `gitnexus impact <name> --direction upstream` before editing named functions; report callers. Expect `roadArchFill` (the per-slot fill site), the wall material builders, the grade/clank sites you write the uniforms from, `roadSync`. `moonlineVoid` and `releaseTargetMesh` are CRITICAL — do not touch.
5. House style: flat CFG literals, raw-boolean-first, `_roadG()`, shared uniform OBJECTS never copies, WHY-comments.
6. `node --test --test-isolation=none tests/*.test.js` green (**212** baseline) plus your new tests.
7. Half-space audit for any new y-term (there should be none — say so).

## Parcels
- **X — THE EXHALE** (spec §1): per-slot bars-to-mercy channel at the `roadArchFill` fill site; dissolve radius pulled to ~60 % two bars out, ~30 % one bar out; instant inhale after; `wallExhale` knob, 0 = wave-11 byte-identical.
- **E — THE ECHO** (spec §2): `uWallHit`/`uWallMiss` road-clock stamps written from the EXISTING flawless/clank sites (locate them via the grade path — showTiming/trauma neighbours; add only the two uniform writes); ripple +12 % cap, 1.5-beat decay, chamber-local; clank dim −10 %, half-beat; `wallEcho` knob with compile-time exclusion; reduceMotion = dim + static glow (no travelling wave); LOW = dim only.

## Tests (behavioural; mutate → must-fail → revert → must-pass, report both)
1. Kill-switch fidelity: `wallExhale:0` alone, `wallEcho:0` alone, both → emission byte-identical to the shipped wave-11 text (extend the fixture pattern; capture the CURRENT emission as the new frozen reference for "wave 11 shipped"). Construct the surviving mutation and kill it.
2. Exhale law: evaluate the emitted per-slot dissolve input at bars-to-mercy {3+, 2, 1, mercy-span, first-bar-after} and assert {100 %, ~60 %, ~30 %, no wall, 100 %}.
3. Echo isolation: the grade/spawn/aim paths gain exactly two uniform writes and no reads (extend the wave-10 isolation test style).
4. Ripple cap: emitted fragment maths never lifts luminance above the cap at any phase.

## Visual self-verification
Harness at `<scratchpad>/harness/` (port 8771). Your sandbox has never been able to render — if so, say so plainly and claim nothing; the dispatcher renders (including a forced-mercy approach sequence) and runs the four-variant perf measurement.
(`<scratchpad>` = `/tmp/claude-1001/-home-mrcolson-repos-aim-dojo/3186ce38-c333-4532-a30f-1b13cdeb8b3f/scratchpad`)

## Verification block
```
node --test --test-isolation=none tests/*.test.js
node tools/extract-inline.mjs
git status --short && git diff --stat
```

## Final message
Per parcel X/E: line ranges, one-line summary, deviations. Impact results. Mutate/revert per test. Draw/uniform deltas (expected: zero draws, two uniforms). Uncertainties stated plainly — the adversarial reviewer has found something real in every wave.

---

# ROUND 2 — adversarial review returned BLOCK (2026-08-21). Three findings, all verified. Fix all three.

### R1 — HIGH: the reduced-motion echo dies once the clock outruns the pinned geometry
`index.html:2522` computes BOTH echo age and chamber locality from the advancing `uPulse`, but reduced-motion wall stations stay pinned at −8…16 beats (LOW) / −8…32 (normal) while the clock advances (`:2986`). Proven numerically: `vWallLocal` reaches zero everywhere after beat 24 (LOW) / 40 — ≈51/86 s at 28 bpm — after which neither the static glow nor the dim can ever render again. **Fix:** keep `uPulse` (the shared beat authority) for the AGE term; compute reduced-motion LOCALITY against the pinned clock (`uNow`, which reduceMotion pins — or the constant 0 the stations were built around). Add an emitted-shader test evaluating locality at pinned-station coordinates with the clock at beats {10, 50, 200} — must be non-zero at all three under the reduceMotion emission.

### R2 — MEDIUM: echo stamps survive session reset — a phantom ripple in the next run
`_wallHit`/`_wallMiss` initialize once (`:2059`); `resetSession()` (`:10268`) rewinds the Transport to zero without clearing them, so a stamp from the old run is future-dated and REPLAYS as a phantom echo when the new run reaches that beat. The reviewer set both initial stamps to `4` and all four Breath tests passed — the lifecycle is untested. **Fix:** in `resetSession()`, gated on `ML_WALL_ECHO`, set both stamps to `-1e9` (and the uniforms if live). Add the lifecycle test: stamp mid-"run", simulate reset, assert the emitted age at the new run's early beats yields zero contribution — and verify it catches the reviewer's initial-stamp-4 mutation.

### R3 — MEDIUM: fixture scope + duplicate "alone" cases + no uK truth table
The frozen wave-11 fixture itself is legitimate (independently reconstructed from `7dfa1a7`, all five hashes match) — but `emittedBreathSet()` (`tests/moonline-breath.test.js:86`) omits the wall-ACCENT and wall-VEIL shaders, so mutating the accent's mercy detection (`step(0.5,kind)` → `step(0.02,kind)` at `:2586` — misclassifying packed 0.02/0.03 walls as mercy) passes every test. And the two "switch alone" cases (`:104`) inherit the other switch off from line 51 — they are duplicates of both-off, exactly the coupling-blindness pattern this repo has hit in four consecutive waves. **Fix:** fingerprint EVERY wall-family shader (wall, accent, veil) in the breath set; make the "alone" cases actually leave the other switch ON; add a uK reader truth table evaluating the emitted decode at packed values {0.01, 0.02, 0.03, 1.03, 2.01, 2.03} against expected {kind, barsToMercy} pairs for each reader (wall, accent, veil). Verify the truth table kills the reviewer's step-boundary mutation.

Keep 216/216 + new tests green; mutate → must-fail → revert → must-pass for each fix; mirrors LAST; swallow scans zero. Final message: line ranges, the three mutation results, and the truth-table output.
