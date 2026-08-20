# Codex prompt — Wave 9: THE NAVE (white stone gates · gold stars · golden street)

**Working directory:** `/home/mrcolson/repos/aim-dojo` (branch `main`, tree clean at start).
**Authoritative spec:** `SPEC_MOONLINE_NAVE.md` — read it IN FULL first; where this brief and the spec disagree, the spec wins.
**Visual reference (read the code, copy the look, NOT the code):** `/tmp/claude-1001/-home-mrcolson-repos-aim-dojo/3186ce38-c333-4532-a30f-1b13cdeb8b3f/scratchpad/studies5/serene/index.html` and its three PNGs alongside — a standalone Three.js study of exactly the target look. The game must reproduce its *read* (calm lit-white-stone round coffered arches, gold star per keystone, gold-star vault, honey-glass street, white mercy circle + gold rose + veil) inside the game's own architecture (one shader-driven instanced mesh, course-spline uniforms, kill-switches).

**Do not commit. Do not push. Do not run `gitnexus analyze`. Do not edit `CLAUDE.md`/`AGENTS.md`.** Leave the tree modified; the dispatcher runs `detect_changes`, an adversarial review, then commits.

## Hard rules (same as the last dispatch — they caught real bugs)

1. **Never append code after a `//` comment. Never delete a statement with regex/sed.** One physical line in this file often carries several statements + a long rationale comment; a mechanical edit once turned live statements into comment text (`97b6134`). After ALL edits run the swallow-scan test (`tests/index-contract.test.js` has it) — it must stay green.
2. `tools/index-inline.mirror.part*.js` are GENERATED (same line numbers as index.html). Never edit them; after your LAST index.html edit run `node tools/extract-inline.mjs`.
3. The repo is GitNexus-indexed; CLI on PATH. Before editing a named function run `gitnexus impact <name> --direction upstream` (mirror line N = index.html line N) and note the callers in your final message. Expected central symbols: `buildRoadArches`, `roadArchFill`, `roadSync`, `moonlineVoid`, the road/dust materials, `updateRenderQuality`.
4. Match the house style: dense single-line statements, `//` comments that say WHY, flat CFG literals with decision comments (the CFG contract test's regex forbids nested `{}` in a CFG entry), raw-boolean-first kill-switches, `_roadG()` for GLSL float literals, shared uniform OBJECTS (not copies) so `roadSync`'s three writes drive every shader.
5. `node --test tests/*.test.js` green (192 at baseline) plus the new tests below. The `index-contract` suite parses every inline script — your GLSL lives in JS strings, so template/quote errors surface there.

## Anchors in today's code (read them before designing)

- `index.html:~1905-1930` — the ML_ARCH const block (`ML_GOLD`, `ML_ARCH_EVERY=4`, `ML_ARCH_BEHIND=8`, `ML_ARCH_N=11`, seg counts, widths, `ML_ARCH_RICH=!LOW`, breath).
- `:~2200-2275` — `buildRoadArches()`: ONE indexed mesh; vertex shader places every station from tonight's course spline (`uBase/uA/uW/uP`, re-based centreline) at its own beat; `uK[]` marks the mercy bar; mirrored pass via the `aMW` attribute; `uReflect`; junction nodes for free from `|t|`. THIS PATTERN SURVIVES — the nave arches must be built the same way (attributes are parameters, zero CPU per frame).
- `:~2280-2340` — `roadArchFill` / arch bookkeeping; `:~2540-2560` — `roadSync` visibility latch (nave pieces must ride `live` exactly as `roadArch`/`roadDust` do).
- The road plane material (search `roadMat=`) — the street palette lives in its fragment shader; the wake/cell/tide/mercy uniforms are the information channels you must NOT change semantically.
- `roadDust` (search `ML_DUST`) — the wrap pattern (`mod(anchor − uNow, SPAN)`) the vault must reuse.
- `CFG.moonline` (`:~1031`) — add the new flat keys HERE with decision comments: `naveOn:true`, `naveStars:1500`, `naveVeil:0.45`, `naveStreetGold:0.7` (ship value; 1 = the study, 0 = today's palette exactly — implement as a shader mix on ONE uniform so the escape hatch is a live knob, not a rebuild).

## Parcels (implement all; the spec §2–§6 carries the numbers)

- **A — THE GATES.** Replace the lancet-ellipse arch shape with the nave gate: piers (plinth/impost) at ±7.65 to y 9.5, semicircular band R7→R8.3, 10 shaded coffers per side, keystone wedge, one gold 8-point star + honey breath above each crown. Marble material per spec §2 (normal-blend lit-white body + faint additive glow; gold accents in their own additive pass/mesh so they read — additive-on-lit-alabaster is invisible). Reflections ~0.5/6 m. Far gates simplify (coffers/glow fade by distance; piers persist). `naveOn:false` → the ENTIRE wave-8 arch path byte-identical (keep the old shader strings compiled under the flag exactly as `ML_ARCH_RICH` does for LOW — a raw boolean picking between two source texts at build time is the established pattern).
- **B — THE MERCY RING.** The mercy bar's gate becomes the deck-centred ring (R10/R11.6, 12 coffers, pedestals, stronger closing reflection), gilded keystone, 10-petal gold rose + ~19-ray sunburst + the gate star, and the parted gold veil (`naveVeil`, its own tiny mesh on the mercy slot only, additive, never crossing the aim line's centre gap). The existing `uK[]` mercy plumbing selects it.
- **C — THE VAULT.** New one-material point layer (~`naveStars` sprites) per spec §4: barrel over the road + low course, gold core/bloom, 4/8-point sparkle only when `!LOW`, wrapped with the road's own `uNow` uniform object, riding `roadSync`'s latch, standing still under reduceMotion (the uNow pin already does this). `naveStars:0` → never built, zero cost.
- **D — THE GOLDEN STREET.** Palette-only restyle of the road fragment shader behind `uNaveGold` (`naveStreetGold`): honey-glass deck, gold leading/crossbars, white-gold bar lines, jewel cells (lane hues ≥90 % pure), pier-foot/gate pools, gold rails/balustrade tint, gold dust tint. Every information mapping (band/colour/tide/fill-mark/mercy width/wake verdicts) unchanged in *contrast* — check the wake's landed/missed/neutral still separate at naveStreetGold 0, 0.7 and 1.
- **E — QUALITY TIERS + TESTS.** LOW per spec §6 (plain arcs, no coffers/glow/sparkle, half vault, veil off — compile-time exclusion, not zeroed uniforms). reduceMotion inherited (no new code paths if the uNow pin already covers the vault). Contract tests: (1) `naveOn` raw-boolean-first (the wave-8 arch source string still present and selected when false); (2) the CFG keys exist as flat literals with the documented defaults; (3) the road fragment shader contains the `uNaveGold` mix and the four lane hues; (4) the swallow scans stay zero. Keep/extend the 192 existing tests green.

## Visual self-verification (do this before your final message)

The dispatcher's harness recipe, condensed: copy index.html to a scratch dir, inject `window.__dbg={ setTrainPhase:(p)=>{ trainPhase=p; }, get state(){return state} };` immediately before the final `renderPrimary(false,false);\nanimate();`, symlink the repo's `*.js` and `assets`/`fixtures` beside it, serve with `python3 -m http.server`, then with puppeteer-core (`/tmp/claude-1001/-home-mrcolson-repos-aim-dojo/3186ce38-c333-4532-a30f-1b13cdeb8b3f/scratchpad/harness/node_modules` has it; Chrome at `/usr/bin/google-chrome`, flags `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --no-sandbox`, URL `?hi`): click `#beginTrain`, wait for `state.running`, `__dbg.setTrainPhase(3)`, wait ~8 s, screenshot 1600×900. LOOK at your screenshot (you can read image files): white stone gates? gold star string? vault present? cells legible? mercy ring closing? Iterate until yes, and include the screenshot path(s) in your final message. Also capture `?low` once (plain arcs, no crash).

## Verification block (run all, paste output)

```
node --test --test-isolation=none tests/*.test.js
node tools/extract-inline.mjs
git status --short && git diff --stat
```

## Final message format

Per parcel A–E: index.html line ranges touched, one-line summary, deviations. The `gitnexus impact` results you consulted. The screenshot paths. The achieved draw-call/triangle budget vs the spec's. Any interaction you're unsure about, stated plainly — the adversarial reviewer will attack exactly those.

---

# ROUND 2 — visual tuning from the dispatcher's harness renders (2026-08-20)

Round 1 is applied and RENDERS CORRECTLY (the dispatcher ran the harness you couldn't: gates, vault, mercy ring, LOW all live; screenshots at `<scratchpad>/harness/nave-*.png`, `tune-*.png`, `navelow-*.png`). Fix exactly these, keeping all hard rules (mirror regen LAST, swallow scans green, no commit):

### R1 — `naveStreetGold` ship value 0.7 → **1.0**
Measured live: at 0.7 the wave-8 lane wash still dominates and the deck reads dark olive/maroon; at 1.0 the deck is the study's honey glass and the jewel cells/rails stay fully legible. Change the CFG default to `naveStreetGold:1` and reword its decision comment (1 = the Nave's street; the dial exists as the escape hatch back toward wave-8's dark glass, 0 = byte-identical old palette).

### R2 — soften the coffers
On screen they read as cold blue-grey panels ("windows"), not carved shadow. In the coffer recess: shift the shadow tone from blue-grey toward the marble's own warm grey (mix the recess colour ~50 % toward the body warm-white instead of the cold limb tone), reduce the recess depth/contrast to ~60 % of current, keep the luminous lip seam. Also fade coffers out with distance EARLIER (they shimmer at the portal at SwiftShader resolution — gone by ~250 m instead of current).

### R3 — the apex gold star must land
The single gold 8-point star + honey breath above each keystone is barely visible at 40 m. Make it read: bigger sparkle core (study: ~0.85 m above the crown, clearly visible as the "rising string of stars" from any distance), a soft honey disc behind it, brightness NOT distance-faded as hard as the coffers (the string to the portal is the point). Check against `<scratchpad>/studies5/serene/serene-wide.png`.

### R4 — the missing Parcel E tests (round-1 deviation, not optional)
Add to `tests/index-contract.test.js` (this file IS in scope — the round-1 reading that only index.html was editable is wrong): (1) `naveOn` raw-boolean-first — assert the wave-8 arch shader source text is still present in index.html and that the nave source is selected under a `naveOn` conditional; (2) the CFG flat keys `naveOn:true, naveStars:1500, naveVeil:0.45, naveStreetGold:1` exist as flat literals in the `moonline:{...}` entry; (3) the road fragment shader contains the `uNaveGold` mix and all four lane hues; (4) run the full suite — 192 + yours green.

Verification: full test suite, `node tools/extract-inline.mjs` last, swallow scans zero, `git status --short`/`git diff --stat`. Final message: per-item line ranges + verification output + concerns.

---

# ROUND 3 — adversarial review findings (BLOCK → fix all five, 2026-08-20)

Rounds 1–2 are applied. An adversarial review returned **BLOCK**; the dispatcher independently confirmed every finding by reading the code. Fix exactly R1–R5. Same hard rules (no code after `//`, mirrors regenerated LAST, no commit, swallow scans green).

### R1 — BLOCKER: the jewel lane colours are wrong (wrong ORDER and wrong VALUES). Fix structurally, not by reordering.
`index.html:~2545` emits hardcoded jewel constants `j0..j3` = green, cyan, #ffb347, #ff5ea8. The game's authoritative lane colours are `WASD_HEX=[0x43d9ff,0x74e84a,0xffd36b,0xff5a7a]` (**W cyan · A green · S gold · D pink**, index.html:8217), loaded into `_roadLaneCol` → the `uL0..uL3` uniforms in `roadSync`'s one-time block. So today lane W paints GREEN and lane A paints CYAN — **the road names the wrong key** — and lanes S/D carry invented hues that are not the game's. (Root cause: the spec listed the hues in a non-lane order; that was the dispatcher's error, not yours.)
**Fix (do it this way, it kills the whole bug class):** delete the `j0..j3` constants entirely. Derive the jewel colour from the SAME `lc` the wave-8 path computes from `uL0..uL3` — i.e. jewel = a saturation/luminance lift of `lc`, something like `vec3 jewel=clamp(mix(vec3(dot(lc,vec3(0.299,0.587,0.114))),lc,1.45)*1.12,0.0,1.0);` (tune the two constants so the four lanes read as rich stained glass against the honey deck and no lane clips to white) then `lc=mix(lc,jewel,uNaveGold);`. This way the lane→colour mapping has exactly ONE source of truth (`WASD_HEX`) forever, and a future palette change cannot desync the Nave. Verify by rendering (harness below) that the near cells read cyan/green/gold/pink, not green/cyan/amber/magenta.

### R2 — major: the fill-gate mark nearly vanishes at gold 1
`index.html:~2578`: `cell=mix(lc,uMark,min(1.0,gb*markE))` tints only the cell term, but the Nave bar's brightness is dominated by the untinted `ng*(grid+rail)` and `nw*(barN+now)` terms. Measured by the reviewer: marking shifts the amber-lane bar by ‖Δ‖≈0.040 in Nave vs ≈0.343 in wave-8 — **~8.5× less separation**, so the "3, 4, 1" rolling amber edge-mark stops reading.
**Fix:** apply `markE` to the COMPLETE Nave bar contribution (tint the assembled `nave` colour toward `uMark` by the same `min(1.0,gb*markE)` factor, or tint `ng`/`nw` alongside `cell`), leaving the wave-8 first operand of the final `mix(col*ink, nave, uNaveGold)` untouched. Re-measure and state the new Δ in your report.

### R3 — major: `uBreath` not shared with the vault and veil
`buildNaveVault()` (`~2376`) and `buildNaveVeil()` (`~2403`) take `{uNow,uBase,uA,uW,uP}` only. House invariant: every material in this family holds the SAME uniform OBJECTS `roadMat`/`roadArchMat` hold so `roadSync`'s per-frame writes drive them all. Add `uBreath:U.uBreath` (the object, never a private `{value:…}`) to both and use it: the vault stars swell gently with the beat (a small fraction — the arches use `ML_ARCH_BREATH` 0.45 of the ribbon's amplitude; the vault should be subtler, ~0.2 of it, so the canopy pulses without strobing), and the veil rides the same. Add a named const with a decision comment rather than an inline literal.

### R4 — major: LOW still emits the recess code
`index.html:~2321`: `rec`/`lip` are declared unconditionally and the two recess/lip `mix()` calls at ~2325–2327 sit in the unconditional `.concat([...])`, so LOW pays for them with `rec=lip=0.0`. Spec §6 requires compile-time exclusion (the `ML_ARCH_RICH` pattern), not zeroed values.
**Fix:** move the `rec`/`lip` declarations and both recess/lip mixes inside the `ML_ARCH_RICH` branch so the LOW fragment source contains plain stone shading only. Confirm by dumping the emitted LOW fragment text and grepping for `rec`/`lip` (must be absent).

### R5 — major: the three new contract tests are tautological
Proven: the suite passed 195/195 **with the R1 lane swap live**. Token-presence assertions cannot catch a mapping error.
**Fix:** make them behavioural. (a) LANE MAPPING: extract `WASD_HEX` and the road fragment source; assert the Nave jewel derives from `uL0..uL3`/`lc` and that NO hardcoded lane-hue vec3 literals remain in the Nave branch (after R1 there should be none) — a test that would have failed on the swap. (b) KILL-SWITCH: build the emitted shader strings for `ML_NAVE` true and false (extract the source-fork arrays and evaluate them in `vm` with both flags) and assert the false-branch text is character-identical to the wave-8 fragment/vertex text; freeze that text as a fixture so any future drift fails loudly. (c) LOW: same evaluation with `ML_ARCH_RICH=false`, asserting the emitted marble fragment contains no `rec`/`lip`/recess tokens. Keep all 195 existing tests green.

### Visual re-verification (required this round)
The dispatcher's harness works and its server is on **port 8771** (`<scratchpad>/harness/`, `make-harness.py` regenerates `index.html` from the repo with a `__dbg` hook, `nave-shot.mjs <page> <outPrefix>` renders). If your sandbox still refuses sockets/Chrome, say so plainly and state what you verified statically instead — do not claim a render you did not do.

Verification: full suite, `node tools/extract-inline.mjs` LAST, swallow scans zero, `git status --short`, `git diff --stat`. Final message: per-item line ranges, the measured Δ for R2, the LOW-shader grep result for R4, and any concern.

---

# ROUND 4 — closing two test-coverage gaps (2026-08-20, post-ship)

Wave 9 shipped as `5802a0f`. A second adversarial review returned BLOCK on **test coverage only** — it confirmed the shipped rendering is correct and could not break the runtime. Both findings are gaps in the safety net that would let a FUTURE regression through. Close them. Tests only; do not change `index.html` behaviour.

### R6 — the lane contract does not cover the uniform bindings
`tests/index-contract.test.js:~97` validates `WASD_HEX` and the shader's `uL0..uL3` selection expression separately, but never the *bindings* at `index.html:~2497` (`uL0:{value:_roadLaneCol[0]}, …`) nor the fill `_roadLaneCol[i].setHex(WASD_HEX[i])`. Proof the gap is real: the reviewer mutated the bindings to `uL0:_roadLaneCol[1], uL1:_roadLaneCol[0]` — recreating the exact W/A swap that shipped-and-was-caught last round — and the suite still passed 196/196.
**Fix:** extend the lane test to assert **index identity across the whole chain**: parse the `uL0..uL3` binding literals from index.html and assert `uL{i}` binds `_roadLaneCol[{i}]` for each i, and that the fill loop assigns `WASD_HEX[i]` to `_roadLaneCol[i]` (same index on both sides — a test that fails if either side is reordered). Prefer parsing over evaluation if evaluation needs too much scaffolding, but the assertion must be index-sensitive, not presence-based. Verify by making the reviewer's mutation locally and confirming your new test FAILS, then revert it and confirm it passes; state both results.

### R7 — the wave-8 shader fixture only freezes the desktop emission
`tests/moonline-wave8-arch-shaders.fixture.json` freezes `{nave:false, low:false}` only. Proof: mutating the LOW-only wave-8 line at `index.html:~2270` (`float a=core*vAmt;` → `float a=core*vAmt*0.5;`) changes the emitted LOW shader while the fixture test still passes.
**Fix:** freeze and compare **both** `{nave:false, low:false}` and `{nave:false, low:true}`. Keep the existing desktop entry byte-identical (it is correctly captured from pre-Nave `ae231cb` — vertex and fragment hashes verified) and add the LOW pair alongside it; update the test to `deepEqual` both. Verify with the same mutate → fail → revert → pass cycle and state both results.

Do not commit or push. Do not run `gitnexus analyze`. `index.html` should not change at all this round — if you believe it must, stop and say why instead. Regenerate mirrors only if index.html changed. Final message: what you changed, the mutate/revert verification results for BOTH findings, and the suite count.
