# CONTINUATION_PROMPT — Moon Chorus / aim-dojo (resume here, 2026-09-04 · cycle 2)

## -26. 2026-09-04: P4 HTML split complete · THE PAGE OPENS EARLY
**Code commit:** `ba15c03` moves the large game IIFE, byte-for-byte apart from its markup-only leading newline, into
`aim-dojo-main.js`. The 98,800-byte `index.html` retains the gate/overlay, pre-paint and i18n blocks, then preserves
the required module → Three r128 → deferred main order. The pre-P4 shell at `ab0cfa2` was 1,263,837 bytes. A direct
oracle confirms current HTML is exactly that old shell with only the large script element replaced by
`<script defer src="aim-dojo-main.js"></script>`. Vercel gives the new unhashed asset the same must-revalidate policy
as the other runtime modules.

**Test and graph boundary:** all 23 source-scraping tests now read through `tests/source.js`; `sourceFor(name)` is used
by the sky-chat, temple-orbs and index-contract extractors. `tests/html-split.test.js` pins the 150 KB ceiling, unique
deferred tag, full load order, independent main parse, source resolution, and Vercel header. GitNexus cannot parse the
1.16 MB runtime source within its worker budget, so `.gitnexusignore` excludes only that file and
`tools/extract-inline.mjs` emits five independently parse-checked, line-preserving main mirrors plus one residual
inline mirror. A forced rebuild completed in 30.5 s at 5,619 nodes / 10,609 edges / 279 clusters / all 300 flows;
`animate` resolves at its real main-file line with cross-part callers and 11 processes. Never load or hand-edit mirrors.
The following documentation refresh settled the current graph at 5,620 nodes / 10,610 edges / 279 clusters / 300 flows.

**Evidence:** final suite 347/347 and `git diff --check` pass. Three-run cold-cache headful friend A/B against exact
`ab0cfa2`: `T_play` 3,037 → 2,608 ms (−14%), `T_frame` 1,332 → 960 ms (−28%), bytes before PLAY 1,730 → 1,692 KB.
The current build meets the 4,000/1,500 ms timing budgets; transfer remains 156 KB above the 1,536 KB budget. Direct
`file://` boot enabled PLAY at 1,705 ms and reached its first gameplay frame in 491 ms. Chromium reports null-origin
CORS errors for mapped images/JSON and the relay on direct-file open; those fail soft and are not introduced by the
split. Local HTTP boot had no page error; its only console noise was the known localhost→production relay CORS edge.

**Risk review:** P4 was declared HIGH because almost every contract scraped the monolith. Pre-edit graph impacts for
the file boundaries, `animate`, `threeBlock`, `CFG`, test readers and extraction tooling were LOW; the test helper
changes each had zero or one direct test caller and no production process. Final staged `detect_changes` was CRITICAL
by relocation count (2,170 changed symbols / 271 affected flows / 36 indexed files). The byte-equality oracles, full
suite and browser A/B bound that graph churn to source relocation and test/tooling adaptation.

**Shipped state:** the twelve-commit range `6103524..be193c7` was pushed to `origin/main`. Vercel immediately served
the 98,800-byte shell and 1,165,065-byte main with `max-age=0, must-revalidate`. A cold-cache, headful live desktop
smoke was clean: PLAY 2,302 ms, first frame 765 ms, 1,192 KB before PLAY, worst early frame 117 ms, and no page or
console errors. The Sidereal relay merge/deploy remains the user's external boundary; live mail/visitor/chat
validation must wait for that relay deploy.

## -25. 2026-09-04: reviewed ImageBitmap decode complete locally · THE SKY ARRIVES LIGHTLY
**Local-only state (not pushed or deployed):** `c1a3c27` adds flat `skyMaps.bitmapDecode:true`. Where both the browser
and Three r128 expose ImageBitmap support, `loadSkyTexture` now creates one stable `THREE.Texture` wrapper, decodes
through one lazily constructed `THREE.ImageBitmapLoader`, and publishes the bitmap with `needsUpdate=true`. The loader
uses `imageOrientation:'flipY'` and `premultiplyAlpha:'none'`; the wrapper has `flipY=false`. Cache identity, in-flight
waiter fan-out, retry-after-error, and fail-soft glyph-only behavior remain intact. `bitmapDecode:false`, a missing
`createImageBitmap`, or a missing Three loader all fall through to the prior `_skyTexLoader.load(...)` block unchanged.
`_skyTexImageReady` now accepts positive-width/height ImageBitmaps and canvases while retaining DOM-image `.complete`
semantics. The globe contrast canvas inherits `tex.flipY`; this prevents a second vertical flip after drawing a
pre-oriented bitmap and is a no-op (`true` to `true`) on the legacy TextureLoader path.

**Evidence:** executable VM contracts cover the active path, stable return identity, duplicate-load suppression,
waiter release, synchronous ready-cache hits, both failure modes, retry, knob-off and two capability fallbacks, DOM /
bitmap / canvas readiness, orientation options, and the enhancement handoff. Full suite 345/345; inline mirrors were
regenerated after the final edit and GitNexus re-indexed to 6,241 nodes / 11,185 edges / 271 clusters / 300 flows.
Headful high-quality A/B used fixed clock, RNG and camera state against `824527b`: all 13 belt maps loaded on both;
baseline made 0 `createImageBitmap` calls and the new build made 15. At 1280×800, pixelmatch deltas were menu 7 /
1,024,000 (0.0007%), focused Jupiter 623 (0.0608%), and Aries belt 27 (0.0026%); visual inspection found no orientation,
placement, scale or tone drift. The first run caught the enhancement double-flip before this final pass.

**Performance reading:** one three-run headful friend-profile pair was too noisy to claim a speedup: baseline median
`T_play` / `T_frame` 10,948 / 4,190 ms versus current 11,802 / 4,975 ms, while bytes-before-PLAY also varied 2,284 /
1,929 KB and both were dominated by the same over-budget cold-start conditions. The defensible measured fact is that
the new build exercised 15 asynchronous bitmap decodes with visual parity; do not quote this timing sample as a win.

**Risk review:** pre-edit `loadSkyTexture` was CRITICAL (4 direct callers / 13 dependents / 5 processes),
`_skyTexImageReady` HIGH (2 / 9 / 3), and `enhancePlanetTexture` CRITICAL (1 direct caller / 19 dependents / 10
processes). The final staged `detect_changes` was CRITICAL by count (66 symbols / 24 flows / 7 files). Raw production
diff review limits the live change to `CFG.skyMaps`, those three reviewed texture functions, and generated mirrors;
reported `restoreFigures`, `cardLoad`, and gift flows are mirror repartition attribution.

**Next:** P4 HTML split (`CODEX_PROMPT_PERF_HTML_SPLIT.md`), with pre/post headful measurement and explicit audit of
every contract that currently reads `index.html`. The relay merge/deploy and live smokes remain the user's external
boundary.

## -24. 2026-09-04: wave 22 Parcel P complete locally · THE STARS DID NOT LOAD
**Local-only state (not pushed or deployed):** `b9cf074` gives the blocking Three.js r128 CDN tag the specified
`onerror="window.__threeFailed=1"` marker and wraps the existing game IIFE in a strict bootstrap scope. The inner
game IIFE's literal first statement now tests `typeof THREE==='undefined'`, invokes a pre-defined `threeBlock`, and
returns before the first constructor. `threeBlock` depends only on the markup, document language and the already-loaded
flat JA table; it writes the EN/JA failure line into `#ovLede` and leaves `#beginTrain` disabled with the same opacity
and wait cursor as `setGateReady(false)`. A normal load passes the guard without touching the card or gate; inherited
strict mode preserves the old IIFE semantics.

**Evidence:** source-order and VM failure smokes pass in English, Japanese, missing-card, missing-THREE and normal-THREE
worlds; five weakened-boundary/copy/gate mutants are killed. Inline parse and comment-swallow pass; all root modules
parse; full suite 340/340; mirrors regenerated and re-indexed after the final inline edit.

**Risk review:** the generated-file boundaries at the start and end of the anonymous game IIFE were LOW with zero
indexed upstream dependents; the JA object/anonymous wrapper are not individually resolvable and were reviewed by
literal source order. Final staged `detect_changes` was MEDIUM (21 symbols / 1 flow / 7 files). Its sole production
flow (`ShowPause → T`) is name conflation with `threeBlock`'s private pre-guard translator; the raw diff leaves the
existing game `T` and every normal-load statement untouched.

**Next:** the reviewed ImageBitmap decode round in `loadSkyTexture`; then the final P4 HTML split. The relay deploy
and live smokes remain the user's external boundary.

## -23. 2026-09-04: wave 22 Parcel O complete locally · THE DEAD HELPERS
**Local-only state (not pushed or deployed):** `fff7532` removes the ten verified zero-caller helpers
`avgReaction`, `classifyPocket`, `showTempleSignArt`, `placeTempleSignArt`, `starLitLevel`, `showListenGhost`,
`eighthSec`, `timingErrorMs`, `setClassName`, and `liveCount`; the zero-read `decoyChance` / `decoyDistMul`
knobs; and all three write-only `tg.lifeBeatsEff` assignments. Their obsolete reader/revival comments were corrected.
The defensive `tg.kind===2` behavior remains intact, as do `pushReaction` at its two live call sites and
`hideListenGhost` at its one live call site. The realtime fail-quiet test now exercises only the channel behavior
the application actually calls.

**Evidence:** the comment-swallow/inline parser passed after every individual hand-written deletion. Focused sweep,
realtime and inline tests pass; full suite 338/338; five root modules parse; mirrors were regenerated only after the
last inline deletion and then re-indexed. Seventeen constructed mutants prove every removed name stays gone while
the protected neighboring helpers and all four defensive decoy branches stay present.

**Risk review:** all ten named helper impacts were LOW with zero direct callers and zero processes; `CFG` was LOW
with zero indexed upstream dependents. GitNexus cannot resolve the record property `lifeBeatsEff`, so its three
writes and zero reads were verified directly across source and tests before editing. Final staged `detect_changes`
was CRITICAL by count (31 symbols / 25 flows / 8 files); the raw production diff removes no live branch, and the
reported Listen/card processes are generated-mirror split-boundary attribution. `spawnTarget` retains every live
control-flow statement; only its write-only record fields and the comments around them changed.

**Next:** Wave 22 Parcel P, the fail-soft Three.js CDN guard. The user's relay deploy/live smoke remains external.

## -22. 2026-09-04: wave 21 Parcel K complete locally · MOON SENSEI II
**Local-only state (not pushed or deployed):** `fb86dd0` adds flat `CFG.sensei2:1` and the lazy, versioned
`aimdojo.sensei2` envelope `{v:1,seen:{mercy,fill,bow,star}}`. Validation rejects the whole record unless its
top level and four numeric 0/1 marks are exactly the shape this build writes. Marks only accrete, and memory is
updated before storage so a refused quota cannot repeat a line during the same page life. The raw knob, trainer and
Temple gates precede every storage touch; `sensei2:0` creates no key and speaks no line.

The four hooks observe existing authorities rather than inventing clocks: the false→true `tideMercy` transition,
a `tg.fill16` tag only after the spawned record survives the fill rescue path, half of the same computed threshold
that commits the Bow, and `starLitGain(...)===1` at both live return-drain branches. `starFlyClear` teardown is
deliberately unhooked, so a pause/new-night cleanup cannot collide with the threshold flash. Every line uses
`showTrainCoach(line,true)` and the existing `T` table; the four Japanese drafts remain marked for native review.

**Evidence:** focused K + star-return + inline-contract suite 117/117; full suite 336/336; all five root modules parse;
comment-swallow and inline-script parse pass; mirrors regenerated and re-indexed after the final inline edit. The new
contract executes strict-invalid repair, valid accretion, every off gate, refused storage, exact EN/JA one-line copy,
both Bow clocks and long-frame ordering, both star drain branches, and teardown exclusion.

**Risk review:** pre-edit `onGrid` was LOW (0 direct callers), `spawnTarget` LOW (1 direct caller / 1 process),
`bowClock` LOW (1 / 1), and `CFG` LOW. `starFlyDrain` was HIGH: two direct callers (`starFlyStep`, `onGrid`) and three
return/render processes; the reviewed edit keeps every grant in the same order and only observes its existing return
value before the old geometry gate. Final staged `detect_changes` was CRITICAL by count (82 symbols / 27 flows / 8
files). The real production paths are exactly the four reviewed hooks; reported card/gift names are generated-mirror
split-boundary attribution, and the raw zero-context `index.html` diff confirms those symbols are untouched.

**Still owed:** the user's relay merge/deploy and live smokes from §-16 item 0 remain an external boundary. Next code
item is Wave 22 Parcel O (dead helpers) followed by Parcel P (Three.js CDN failure guard).

## -21. 2026-09-04: wave 21 Parcel J complete locally · THE TIDE ORDERS THE CHALK
**Local-only state (not pushed or deployed):** `6103524` adds the flat `moonline.tidePalette:1` arm. The main road's
existing shared tide record now exposes its already-computed cycle bar as `.cb`; no second modulo or allocation was
added. At the existing per-station lookup, and only after the seeded 512-bar private palette has returned its two
colours, the current chalk eases toward the existing powder pigment `0x6f91bc` by the specified smoothstep, capped at
0.45. The trough and mercy pane remain unblended. `_wallNext` reads `cb+1`, so the shader's colour crossfade is continuous
through every bar line and through the mercy→trough wrap. `tidePalette:0` leaves `_wallCol/_wallNext` value-identical;
the ghost palette remains wholly outside the live tide and still wears its own night's chalk.

**Evidence:** focused tide-palette contract 4/4; full suite 330/330, including inline parse, mirror freshness, and
comment-swallow. A frozen fixture covers both wall-colour arrays over all nine bars. The full
`doorCross × tidePalette × wallsOn × mercyInverse` matrix passes. Eleven constructed mutants are killed across the
pigment and cap, linear-vs-smooth easing, mercy leakage, absolute and independently recomputed cycle bars, switch
cross-wiring, next-colour discontinuity, palette-index shifting, a third private RNG draw, and ghost tinting. Mirrors
were regenerated after the final inline edit.

**Risk review:** every pre-edit production impact was LOW. `roadTideAt` has one direct caller (`roadBandFill`) with
`roadSync`/`animate` downstream; `roadArchFill` has one direct caller (`roadSync`) with `animate` downstream; `CFG` and
`_roadTideR` had no graph-level upstream dependents. Final staged `detect_changes` is CRITICAL by count (73 symbols,
19 processes, 10 files). The only real changed production route is the reviewed road-sync palette path; the reported
sky/listen/card names are generated-mirror split-boundary attribution after the inline source grew, and their raw
`index.html` symbols are untouched. The intended commit is `index.html`, all five mirrors, the new test+fixture, and
the two GitNexus count files; `state/` remains untracked and untouched.

**Still owed before publication:** the user's relay deploy and live smokes from §-16 item 0 still come first. Parcel J
is not pushed. Next code item is wave 21 Parcel K, MOON SENSEI II; its Japanese drafts still require native review.

## -20. 2026-09-04: G-client + H (dormant) + I reviewed and PUSHED (live at `e06ebfc`) · THE NEXT CYCLE, remaining items
**Review (this machine, real GPU):** `c7c4de9` (G client: strict-boolean `reachedBack`, `seat.back`, the reached-back
line first; the field never reaches gameplay), `ea0d7fc` (H: `ghostPhase:0` dormant, eight validated slots, phase seat
after strangers, never posts to the relay), `e06ebfc` (I: `doorCross:1`, one road-clock stamp, tide-gated whoosh,
mercy tonic, wave-18 frozen-shader fixture). Suite 326/326; mirrors fresh; `detect_changes` CRITICAL by count (208
symbols) but the production reach is the ghost/gift flows + `roadSync`/`initAudio` — mirror repartitioning explains
the sky/card/listen names (their index.html symbols are untouched). Headful boot smoke: PLAY at 1.8 s, zero page errors.
Pushed → Vercel live. Deploy-order caveat from §-16 STILL STANDS: the live relay cools mail per sender token until the
user merges+deploys sidereal `ghost-relay-wave20`; with the relay empty nothing is lost yet.

### NEXT CYCLE (remaining, in order; the §-16 hard rules apply unchanged)
0. **USER:** deploy the relay (sidereal `ghost-relay-wave20` → main → Railway), live-smoke per §-16 item 0, then play
   one real night on the live site (card link line · pause-card offset · PLAY speed · the doorway whoosh at the mercy door).
1. **Wave 21 — Parcel J, THE TIDE ORDERS THE CHALK** (SPEC §J; anchors: `_roadTideR` ~2070 + `cb` local ~2088 →
   expose `.cb`; tint at the per-station lookup ~2704 AFTER `roadWallPaletteAt` (THE STREAM RULE: the 512-bar private
   walk is untouched); `_wallNext` uses `cb+1`; ghost seats (~9353 palette twin) NOT tinted). Knob
   `moonline.tidePalette`; 0 → `_wallCol/_wallNext` byte-identical over a full 9-bar cycle (fixture). Consts
   `ML_TIDE_COOL=0x6f91bc`, `ML_TIDE_COOL_MAX=0.45`.
2. **Wave 21 — Parcel K, MOON SENSEI II** (SPEC §K): `aimdojo.sensei2` `{v:1,seen:{mercy,fill,bow,star}}` strict;
   hooks: first `tideMercy` true (~6538), first `tg.fill16` spawn, holster half-way to the Bow (the Bow's own
   constant), first star lit to level 1; `showTrainCoach(line,true)`; EN+JA (JA drafts in the spec, mark for native
   review). Knob `sensei2`; post-graduation only; never over the threshold flash.
3. **Wave 22 — Parcel O** (dead helpers; grep `tests/` for `placeTempleSignArt` first; comment-swallow scans after
   every deletion) and **Parcel P** (Three.js CDN guard: `onerror` on the tag ~904, first statement of the IIFE ~906,
   `threeFailedHtml` EN+JA; a vm smoke with THREE undefined).
4. **Perf, reviewed round — ImageBitmap decode in `loadSkyTexture`** (§-14 traps + visual acceptance; impact CRITICAL).
5. **Perf, last — P4 HTML split** (measure with `tools/coldload.mjs --headful` before/after).
**Owed by the user (human):** the relay deploy; the wave-8 ruling for H (flip `ghostPhase` to 1 if it falls); by-ear
auditions — doorway whoosh level (`DOOR_WHOOSH_DB` −26 vs −30/−22), `GH_VISITOR_ALPHA` 0.8 vs 0.65, `GH_GIFT_LEAD` 3.0.


## -19. 2026-09-04: wave 21 Parcel I complete locally · THE DOORWAYS ARE EVENTS
**Local-only state (not pushed or deployed):** `moonline.doorCross:1` gives the live main road one absolute-bar latch.
The opening chamber seats silently; each later chamber crossing writes one shared `_wallCross` road-clock stamp, with
rewinds retiring both the stamp and latch. Trainer and Temple paths remain excluded. The stamp is a pure visual sink:
it has no RNG, spawn, grading, scoring, or palette consequence.

Wall and restored white-nave arch materials borrow the same stamp. The wall carries a one-beat warm-white 0.18 lift
outward from the doorway plane, bounded by its powder/dissolve tail and the above-deck half-space; the passed arch adds
the same envelope inside its existing 45% breath term. Reduced motion uses the live `uPulse` road clock for a still 0.06
one-beat lift while reconstructing the shipped binary road pulse in GLSL. `doorCross:0` emits the frozen Wave 18
road+nave+wall shader family byte-for-byte and builds no doorway voice.

One shared triangle voice falls 520→140 Hz over 0.22 s through a -26 dB trim at `beatSnap()`. Tide gating is exact:
three or more bars out is silent, two bars out is -6 dB, one bar out is full, and the mercy doorway adds one active-theme
tonic on the existing pad at `CFG.tide.padPeakVel`. Audio-off still leaves the visual event alive.

**Evidence:** doorway + coupled road/nave/wall suites 83/83; full suite 326/326, including inline parse and
comment-swallow. Eleven constructed mutants are killed across switch cross-wiring, below-deck/tail leakage, breath
replacement, reduced-motion strength/clock, tide silence/gain/tonic, beat-vs-bar latching, opening-frame phantoms, and
rewind state. The new frozen fixture fingerprints road, socket, nave, HIGH/LOW wall, inverse, accent, and veil shaders.
Mirrors were regenerated twice with stable hashes. A local headless-Chrome/SwiftShader boot loaded the current page,
enabled PLAY, hid the start card, and reported no page or shader error; only the expected local-origin sky-day CORS
warning appeared (7.2 s PLAY / 1.8 s first frame are software-renderer diagnostics, not a performance acceptance).

**Risk review:** every resolved pre-edit production impact was LOW (`CFG`, wall/arch shader builders, `roadSync`, and
`initAudio`); the broadest test helper was MEDIUM, and the inline `buildRoad` IIFE plus anonymous legacy test callbacks
were unresolvable/UNKNOWN and therefore reviewed directly. Final staged `detect_changes` is CRITICAL: 141 graph symbols,
28 affected processes, 15 files. The real production fan-out is the reviewed `roadSync` caller (`animate`) and
its three existing road processes plus `initAudio`'s two callers and three audio-start processes. The reported sky,
card, and ghost processes are generated-mirror split-boundary attribution after the inline source grew; their raw
`index.html` symbols are untouched. The staged set is 15 intended files including this handoff and all five mirrors;
`state/` remains untracked and untouched.

**Still owed before publication:** the user's relay deployment/live smokes from §-16 item 0 still precede the local
Parcel G/H client commits; `ghostPhase:0` remains dormant. Audition the doorway whoosh level by ear before publication.
Next code item is wave 21 Parcel J, THE TIDE ORDERS THE CHALK.

## -18. 2026-09-04: wave 20 Parcel H complete locally · THE MOON REMEMBERS YOU stays DORMANT
**Local-only state (not pushed or deployed):** `ghostPhase:0` is the ruling boundary, so the shipped/default path never
opens `aimdojo.ghostPhase`, allocates its seats, or adds its frame path. When explicitly enabled, every worthy finalized
night is copied only after `aimdojo.ghost` is safe into `{v:1,slots:{"0-7":artifact}}`; the current bucket replaces its
older bare v1 artifact, each artifact is capped at 100 KB, the eight-slot envelope is bounded, quota failure cannot cost
the ordinary night, and a malformed old envelope cannot block the next worthy copy. Reads are strict and fail-soft;
invalid/misfiled slots disappear from the in-memory view without a repair write. The archive never enters a relay path,
and README now names both browser-only ghost keys.

At the real main-play boundary, the matching phase artifact is skipped when it has the +90 own ghost's same date. It
otherwise takes the first empty full visitor seat **after** fetched strangers (−90 first with no stranger; LOW's sole
seat belongs to the stranger). It reuses the existing palette/reveal/beacon/Gift machinery even with `ghostSeat:0`;
phase catches deliberately alias the normal self-mail ledger. It is excluded from stranger counts and speaks once, at
the lowest visitor-copy precedence, as `the last {sigil} night rides with you` /
`このまえの{sigil}の夜がとなりを走る`.

**Evidence:** focused ghost + Visitor suites 44/44; full suite 321/321, including inline parse and comment-swallow.
The frozen emitted road/wall family passes all 32 `record × seat × gift × share × phase` combinations. Nine constructed
mutants are killed across archive timing/bucketing/recovery, duplicate-night exclusion, LOW capacity, stranger-copy
isolation, phase-only Gift lock/projectile/catch routing, and slot/bucket validation. A real headless Chrome door smoke served the current
source with only in-memory `ghostPhase:1`, relay-off, and shortened Bow timings: actual `beginTrain` →
`W W S S A D A D · L · Space` graduated to `THE CHORUS REMEMBERS YOU · MOON SENSEI OPENS THE FULL NIGHT`, the actual
hitless Bow returned `PLAY — A NEW NIGHT`, and the restarted night spoke `the last 🌗 night rides with you`; no page
error escaped (the local-origin sky-day CORS warning was harness-only).

**Risk review:** pre-edit GitNexus impact was CRITICAL for `ghostGiftLockTarget`; HIGH for `ghostVisitorLine`,
`ghostShareReset`, `ghostSessionStart`, and `flashTheme`; LOW for the remaining production edits (including `animate`).
The compare-to-main aggregate is CRITICAL because the same narrow `GH_SHARE → GH_MULTI` predicate reaches existing
scope/flick/arc/projectile and animation fan-out. Representative traces were read end to end; they still terminate in
the existing ghost road-clock/seat helpers, while the new archive has no network process. The full knob matrix and Gift
ledger tests cover those exact boundaries. Final staged `detect_changes`: 68 changed symbols, 53 affected processes,
10 intended files, CRITICAL aggregate; every listed changed process enters through those reviewed Gift, frame, reset,
relay-validation, seat-read, or threshold boundaries.

**Still owed before publication:** the USER must merge/deploy sidereal `ghost-relay-wave20` (`d2c460f`) and run the two
live smokes from §-16 item 0 before pushing either local client commit. The user still owns the wave-8 tonight-only
ruling; until that changes, leave `ghostPhase:0`. Next code item is wave 21 Parcel I, THE DOORWAYS ARE EVENTS.

## -17. 2026-09-04: wave 20 Parcel G client half complete locally · RELAY STILL MUST DEPLOY FIRST
**Local-only state (not pushed or deployed):** the Parcel G client now treats `reachedBack` as relay metadata only when its
value is a strict boolean; absent, string, numeric, and every other malformed value become the old plain case without
rejecting the ghost. The normalized bit lives only on the full visitor seat as `seat.back`. A single reached-back visitor
speaks `a visitor who reached back rides tonight · {sigil}` / `手をのばしてくれた旅人が今夜ならぶ · {sigil}`. A 2–3-seat chorus
keeps the existing plural sentence byte-for-byte and promotes the first reached-back sigil to the front. No gameplay,
grading, spawn, silhouette, artifact, or RNG path reads the field. No knob was added; the whole path still rides
`ghostShare`.

**Evidence:** `tests/the-visitor.test.js` covers absent → old line, `true` → reached-back line, `"true"`/`1` → old line,
plural sigil precedence, EN+JA, seat storage, and a source scan that confines the field to fetch/accept/copy. Three
constructed mutants (truthy coercion, dropped seat bit, unread seat bit) are killed. Mirrors regenerated; focused Visitor
suite 17/17; full suite 319/319. GitNexus pre-edit impact was HIGH for `ghostVisitorFetch` (1 direct caller, 4 flows) and
`ghostVisitorLine` (1 direct caller, 3 flows), LOW for `ghostVisitorAccept` (1 direct caller, 2 flows). Final
`detect_changes` was MEDIUM: the affected flows are exactly the four existing bounded `ghostVisitorFetch` relay
URL/body/timeout/UTF-8 paths; three extra changed-symbol labels are generated-mirror split-boundary attribution, and the
raw `index.html` diff confirms those underlying symbols are untouched.

**Still owed before publication:** the USER must merge/deploy sidereal `ghost-relay-wave20` (`d2c460f`) and run the two
live smokes from §-16 item 0. Do not push this client commit first. Next code item is Parcel H, built dormant at
`ghostPhase:0`; the tonight-only ruling remains with the user.

## -16. 2026-09-04: wave 20 E + F reviewed and PUSHED (live) · THE NEXT CYCLE — a brief Codex can implement from, in order
**Review of Codex's E (`571fcb8`) and F (`309aa27`) (2026-09-04, this machine):** both diffs read coherent and scoped —
multi-seat registers, honest silhouette, bounded aggregate response (`GH_GHOSTS_RESPONSE_MAX`), per-seat mail, visitor-only
construction alpha, analytic road-clock Gift flight with canonical 90 Hz collision samples. Mirrors fresh; 318/318 on
Windows; `detect_changes` vs origin: 171 touched symbols, all inside the ghost/gift flows (expected radius). Headful boot
smoke on the real GPU: PLAY at 1.0 s, zero page errors. Pushed to main → live.
**DEPLOY-ORDER CAVEAT, deliberately accepted:** the client now POSTs one mail batch per visitor (up to three) but the LIVE
relay still cools mail down ≥60 s per sender token, so with two or more visitors the 2nd/3rd batches would 429 (fail-soft:
nothing surfaces, the notes are simply not delivered). The relay fix is Parcel G on sidereal branch `ghost-relay-wave20`
(`d2c460f`: `ghost_seen`, `reachedBack`, per-target mail cooldown; 96+ tests). The relay is EMPTY today (10-day TTL),
so no mail can be lost yet — but the relay MUST deploy before a second friend plays. That deploy is the user's push.

### NEXT CYCLE — ordered work list (Codex: one commit per item, each behind its flat knob; no push, no deploy)
0. **USER, not Codex — deploy the relay:** merge sidereal `ghost-relay-wave20` → main → Railway. Live-smoke: GET
   `/api/ghosts?lon=…&n=4` with a throwaway token returns `reachedBack` booleans; two mail POSTs to two targets inside
   60 s from one sender both 200. Then `node tools/relay-scan.mjs`.
1. **Parcel G, client half** (SPEC §G "What — client"; only after item 0 is live, but the CODE can be written now because
   an absent field is the plain line): `ghostVisitorFetch` (index.html ~9337) validates `item.reachedBack` as a STRICT
   boolean when present (any other type → treat as absent, do not reject the ghost); the seat bag stores it
   (`seat.back`); `ghostVisitorLine` (~9205) speaks `TF('ghostVisitorBack','a visitor who reached back rides tonight · {sigil}')`
   / JA `手をのばしてくれた旅人が今夜ならぶ · {sigil}` when any seated visitor reached back (single-visitor form; with 2–3
   visitors keep the plural line and append the reached-back sigil first). Nothing else reads the field. Tests in
   tests/the-visitor.test.js: absent → plain line byte-identical; `true` → back line; `"true"`/1 → plain line; the
   field never reaches grading/spawn/RNG (source scan). Knob: none new — it rides `ghostShare`.
2. **Parcel H — THE MOON REMEMBERS YOU, built DORMANT:** implement exactly per SPEC §H (slots keyed by moon bucket in
   `localStorage['aimdojo.ghostPhase']`, written at `ghostRecordFinalize` ~9048 after the worthy night is stored, seated
   at the first empty visitor seat after strangers, line `ghostPhaseLine`), but ship with `ghostPhase:0` — the user
   still owes the wave-8 "tonight-only self-ghost" ruling and the knob is how that ruling is applied. Off arm =
   wave-20 byte-identical (extend the knob matrix: ghostShare × ghostGift × ghostPhase). Do NOT silently broaden the
   ghost's memory (Codex's own note, kept).
3. **Wave 21 — Parcel I, THE DOORWAYS ARE EVENTS** (SPEC §I). Anchors: bar latch beside the beat gate in `roadSync`
   (~3046, `n0!==_roadBeat0`); shared stamp objects `_wallHit/_wallMiss` at ~2069 and the uniform block ~2600 are the
   pattern for `_wallCross`; `beatSwell` ~9697; `arcWhoosh` ~6004 / `beatSnap` ~5905 for the voice; tide via
   `roadTideAt` ~2079. Knob `moonline.doorCross`; 0 → frozen-shader fixture byte-identical (test the switch ALONE).
   Audio gated by bars-to-mercy (silent ≥3 out, −6 dB at 2, full at 1, mercy door = sweep + one pad tonic grace).
4. **Wave 21 — Parcel J, THE TIDE ORDERS THE CHALK** (SPEC §J): expose `cb` on `_roadTideR` (~2070/2088), tint at the
   per-station lookup ~2704 AFTER the private palette draw (THE STREAM RULE — the 512-bar walk is untouched), ghost
   seats NOT tinted. Knob `moonline.tidePalette`; 0 → `_wallCol/_wallNext` byte-identical over a full 9-bar cycle.
5. **Wave 21 — Parcel K, MOON SENSEI II** (SPEC §K): four once-ever lines (`aimdojo.sensei2`), hooks at the first
   `tideMercy` true (~6538), the first `tg.fill16` spawn, the holster half-way to the Bow, the first star lit to level
   1; `showTrainCoach(line,true)`; EN+JA (JA drafts in the spec, mark for native review). Knob `sensei2`.
6. **Wave 22 — Parcel O** (dead helpers, SPEC §O list — grep `tests/` for `placeTempleSignArt` first) and **Parcel P**
   (Three.js CDN guard: `onerror` on the tag ~904, first statement of the IIFE ~906, `threeFailedHtml` EN+JA).
7. **Perf, reviewed round — ImageBitmap decode in `loadSkyTexture` (~3505):** §-14 below has the traps (flipY,
   `_skyTexImageReady`, `enhancePlanetTexture`) and the visual acceptance (headful screenshots: menu sky, Temple
   planet focus, belt — pixel A/B vs HEAD). Impact CRITICAL (14 dependents). Knob `skyMaps.bitmapDecode`; the
   temple-orbs test pins `_skyTexLoader.load(` — keep the TextureLoader fallback path verbatim.
8. **Perf, last — P4 HTML split** (`CODEX_PROMPT_PERF_HTML_SPLIT.md`): the only lever left for the friend profile's
   ~6 s parse; HIGH risk (every contract test greps index.html; `tools/extract-inline.mjs` and the mirror-freshness CI
   gate must learn the new file). Measure with `tools/coldload.mjs --headful` before/after.
**Human auditions the user owes (not Codex work):** `GH_VISITOR_ALPHA` 0.8 vs 0.65 (two short nights each);
`GH_GIFT_LEAD` 3.0 by feel; the wave-8 ruling for H; the doorway whoosh level once I ships.

### Hard rules for the implementer (unchanged, restated so no brief has to be re-read)
- Read SPEC_THE_INVITATION.md's parcel before starting it; the anchors there were verified 2026-09-03 (line numbers
  drift a few lines per commit — re-grep). Every parcel: flat knob, off arm byte-identical, tested ALONE and in its
  coupling matrix, mutants constructed (reviewer law: verify "N killed" claims).
- After ANY index.html edit: `node tools/extract-inline.mjs`, commit the mirrors with it (CI's freshness gate fails
  otherwise). Comment-swallow scanner: never a mechanical delete on a multi-statement line; a `//` inside a regex
  literal reads as a comment — write `[/]{2}`. Windows: heredocs eat backslashes — patch via a node script with
  exact-match anchors.
- No GitNexus CLI in a Codex sandbox (it hangs); the dispatcher does impact via MCP. Codex cannot render or bind
  ports — the dispatcher runs coldload/screenshots. `state/` is untracked user data: never touch or stage it.
- Network only at session boundaries, fail-soft, bounded JSON with byte ceilings before validation. One clock
  (`ghostRoadTime`). Lane colours only via `WASD_HEX`/`_roadLaneCol`. Every string EN+JA through `T`/`TF`.
- Acceptance for anything touching the ghost topology walks the REAL door once: `beginAs(true)` → incantation →
  graduation → night → bow. Commit messages in the house voice, ending with the Co-Authored-By + Claude-Session lines
  when Claude commits (Codex commits carry its own attribution).
- Finish every cycle by writing the next section of this file (what shipped, numbers, what is owed).


## -15. 2026-09-03 VERY LATE: wave 20 E/G/F complete locally · deploy order still belongs to the user
**Local state (nothing pushed or deployed):** aim-dojo `main` contains Parcel E at `571fcb8` and Parcel F in the current tip; the sibling sidereal relay branch `ghost-relay-wave20` contains Parcel G at `d2c460f`. Deploy the relay before the client whenever the user chooses to publish. `state/` is untracked user data: never touch or stage it.

**Parcel F — THE VISITOR, WEIGHED:** `GH_VISITOR_ALPHA=1.0` is the safe default. Visitor-only construction scales road, wall, avatar, and beacon alpha; own seats, targets, hit/catch birds, and the honest fourth silhouette stay exact. Failure injection covers first/last material allocation on HIGH/LOW, restores the exact own register set and held Gift lock, publishes no partial roots, and retries a complete cached seat. Human judgement remains open: audition 0.8 and 0.65 for two short nights each before choosing a softer peripheral weight.

**Gift tuning:** lead 3.0 is the technical audition candidate: production-code aim sweeps found lock opportunities for 4/8 extrema at 2.2, 6/8 at 2.6, and 8/8 at 3.0. Real Gift flight and collision now share the predictor's absolute 90 Hz curve. Exact outer tangent locks catch at independent 30/60/90/144 Hz and through a two-second stall; a hidden crossing advances its cursor and cannot be awarded when reveal reopens. Independent sweep: 200 gold candidates, 800 cadence runs plus 800 coarse-stall runs, zero mismatches. Full suite: 318/318.

**Performance, exact final source:** LOW, three alternating pairs × 300 frames, gift off/on: render median 0.4/0.4 ms, render p90 0.5/0.5 ms, whole-frame CPU median 0.6/0.7 ms, CPU p90 0.8/0.9 ms, rAF median/p90 17.7/18.1 vs 17.7/18.1 ms. Identical one-target/one-beacon/two-ring topology, 18 draws, 3,232 triangles, DPR 0.5, zero errors. The old wave-14 "+8–11 ms" result is retired.

**Next:** let the user decide push/deploy and the 0.8-vs-0.65 visual audition. Parcel H still requires the wave-8 tonight-only ruling; if that law stands, ship H dormant at `ghostPhase:0`. Do not silently broaden the ghost's memory.

## -14. 2026-09-03 LATE: THE GATE FIRST shipped (wave 19 complete) · HANDOFF FOR ANY AGENT (Codex included) — start here
**State of main:** wave 19 of SPEC_THE_INVITATION.md is complete and pushed (parcels A/B/M `530a46b`, C/D/N `1694396`,
C-load-scheduling THE GATE FIRST — see git log). Live at aim-dojo.vercel.app. Suite 315/315 (`node --test tests/*.test.js`).
The user has NOT yet played a real night on wave 19 — that is the first thing to verify (card link line under the date;
pause card's offset after the first pause; PLAY lights ~1.8 s on desktop).

**THE GATE FIRST (this session's last parcel), what and why:** CPU-profiled production boot on a real Windows GPU: 2.0 s of
the 3.8 s before PLAY was WebGLProgram linking — `warmShaders`' single synchronous `renderer.compile` at boot idle — and
Tone's then-callback (the ONLY thing that enables PLAY) queued behind it and behind the belt/milky texture uploads. Now
`gateFirst:1`: Tone `<link rel=preload>` in <head>; `_gateReady` resolves once in `setGateReady(true)`; `afterGate()`
sequences sticks/belt, glossary, sky day, auth, skypack, boards and the warm behind it; `warmShadersStart` links program
families per top-level scene child (lights in every chunk) across 40 ms idle slices and abandons the rest if PLAY beats it.
`gateFirst:0` = wave-18 order verbatim. A/B (real GPU, local server, page-clock stamp, 3 runs): desktop PLAY-enabled
5307 → 1803 ms; friend profile (4× CPU, 10 Mbit/40 ms) 6139 ms — STILL OVER the 4000 ms budget. What remains on the friend
profile is PARSE of the 1.15 MB inline script (DCL 5–6.5 s at 4× CPU) — only P4 (HTML split, `CODEX_PROMPT_PERF_HTML_SPLIT.md`,
HIGH risk: every contract test greps index.html) moves that.

**Next lever, NOT taken (needs a reviewed round): ImageBitmap decode in `loadSkyTexture` (index.html ~3505).** texImage2D on
HTMLImageElement sources costs 500–800 ms of main thread on the friend profile (milky 3072×1536 + 13 belt PNGs, decoded ON
upload). `createImageBitmap`/`THREE.ImageBitmapLoader` moves the decode off-thread. GitNexus impact = CRITICAL (14
dependents: enterSkyTemple, focusSkyTempleReticle, updateTempleOrbs, updateSky, ensureSignArtSlot, showTempleGlobe). Traps:
ImageBitmap textures need `flipY=false` with the loader's `imageOrientation:'flipY'` (or the sky/globes render upside
down); `_skyTexImageReady` (3503) reads `tex.image` completeness — a bitmap has width/height, no `complete`;
`enhancePlanetTexture` (3577) drawImage's the image (works with a bitmap) and reads `naturalWidth||width` (works).
Acceptance MUST be visual: headful screenshots of the menu sky, the Temple with a planet focused, and the belt, A/B against
HEAD, pixel-compared. Knob `skyMaps.bitmapDecode`, 0 → TextureLoader path byte-identical (the temple-orbs test pins
`_skyTexLoader.load(`). Also measured and NOT worth it: memoizing `deviceSkyTimezone` (its 200 ms is ICU's first-call
init; impact CRITICAL for zero gain).

**Tools shipped this session (all in tools/):** `coldload.mjs` — cold-cache boot meter, `--headful` = real GPU (headless
SwiftShader is an upper bound only), T_play stamped by a MutationObserver inside the page, `--url` for a local A/B (serve
the repo with `python -m http.server 8931` and `git show HEAD:index.html > head-index.html` for the baseline — delete it
after, it must never be committed). `relay-scan.mjs` — lists relay nights (throwaway token → own night included; NEVER
touches mail). puppeteer-core is NOT a dependency: `npm i puppeteer-core@23` in a scratch dir and point
`COLDLOAD_MODULES` at its node_modules. Scratch probes worth regenerating: a CDP `Profiler` self-time-by-function run
(`Profiler.setSamplingInterval 500`, aggregate `timeDeltas` per callFrame; `Jr` in three.min.js r128 = WebGLProgram) and
a `Network.loadingFinished` waterfall split at T_play.

**Codex-specific:** no GitNexus CLI in a sandbox (it hangs — memory codex-dispatch-procedure); the dispatcher does impact via
MCP. Codex's sandbox cannot render or bind ports; the dispatcher runs coldload/screenshots. Every index.html edit →
`node tools/extract-inline.mjs` → commit the mirrors with it (CI's mirror-freshness gate fails otherwise). Comment-swallow
scanner: a `//` inside a regex literal reads as a comment — write `[/]{2}`. Windows: heredocs eat backslashes — patch via a
node script file with exact-match anchors, never sed/heredoc.

**Then wave 20 in spec order:** E three seats (client) → G relay half on a sidereal branch (tests, NO deploy — the user's
push; relay before client) → F visitor alpha knob + gift LOW remeasure → H only after the user's ruling on the wave-8
tonight-only law (ship at ghostPhase:0 if it stands). The relay is EMPTY (10-day TTL) — seed with a production-origin
puppeteer night before testing seats.


## -13. 2026-09-03: wave 19 — THE INVITATION (`530a46b` + `1694396`), committed on main, NOT pushed · the full menu is SPEC_THE_INVITATION.md
- Session on the Windows machine (New York). Pull was blocked by the auto-generated GitNexus counts in CLAUDE/AGENTS.md
  (discard + fast-forward). The realCivilDate oracle FAILED here (`5d7a48d`): it simulated Apia's skipped day with a
  UTC midnight, which reads as the previous day on any host west of UTC — the mutant it exists to kill survived. LAW:
  a timezone oracle is only an oracle if it holds on both sides of UTC; CI now runs on ubuntu AND windows.
- **Wave 19 shipped (all behind flat knobs, 311/311, headless boot smoke clean):** A `calibSilent:1` — calibApply is
  the one authority (button + silent path), fires once per page life at graduation or the first post-graduation
  pause, only with NO stored/cloud offset, ≥12 taps, |mean| ≥ 12 ms, says nothing. B `nightCard.link:1` — shareLinkUrl()
  hoisted (origin+path only), the host painted under the date; the SIGIL IS A TIMESTAMP (phase bucket shared by the
  whole ~3.7-day window; the card already draws it as the moon disc) — never propose it as identity again. M — the
  lesson leaves no record: submitDojo gates on trainMode; _gradSnap makes dur/kills count from graduation (state.t is
  never reset mid-run). C tools/coldload.mjs · D tools/relay-scan.mjs (never touches mail; own night included via a
  throwaway token) · N .github/workflows/tests.yml (parse + mirror-freshness gate + suite, two hosts).
- **The relay is EMPTY** (10-day TTL: the 08-23 nights expired 09-02). The user's next night is again "the first".
- **COLD LOAD, production, real GPU (--headful), 2 runs:** desktop T_play 2254 ms · 1318 KB · T_frame 402 ms · worst
  83 ms. Friend profile (4× CPU, 10 Mbit/40 ms): T_play 6983 ms · 960 KB · T_frame 2713 ms · worst 933 ms — OVER the
  4000/1500 budget. Headless SwiftShader is an upper bound only (8.4 s / 13.5 s — software shader compile). DECISION
  RULE (spec C): execute P2 load scheduling (CODEX_PROMPT_PERF_LOAD_SCHEDULING.md: defer sky textures, planet maps, QR,
  Supabase until after the lesson starts), re-measure with the tool; only then consider P4.
- **Rulings the user still owes:** parcel H (past self by moon phase) bends the wave-8 "tonight-only self-ghost" law —
  ships at ghostPhase:1 in the spec, flip to 0 if the ruling stands. Parcel E's silhouette line is REDUCED to real 4th
  ghosts only; "ghost-filled empty chairs" retired (nothing fabricates presence).
- Environment: puppeteer-core lives in the session scratchpad (COLDLOAD_MODULES=…/scratchpad/node_modules), Chrome at
  the standard Windows path; the claude-in-chrome extension and browser-harness both needed a user click here — the
  tool is the harness. resetSession impact reads HIGH in GitNexus (hub); the wave-19 edit there is one added assignment.
- NEXT: push (Vercel → live), the user's real night (verify the card's link line + a friend's first night via
  relay-scan), then wave 20 in spec order (E seats → G relay-first → H after the ruling → F tuning).


## -12. 2026-08-23 LATE: wave 18 — THE CARD WITHOUT THE FREEZE (`2e885b0`) live · FIRST REAL NIGHT ON THE WIRE
- ★ THE USER'S FIRST REAL NIGHT landed on the relay: bucket 21, 2026-08-23, 162 s, 16 targets/58 taps/25
  fires, 2,426 B — the honest lifecycle proven by a human. The chorus has its first voice.
- Their 'nearly froze at the end' = the night card's synchronous capture at the bow (A/B: 10.3 s worst
  frame with card on, 87 ms off). Fixed: capture schedules at overlay-open, paints in idle, encodes via
  async toBlob; copy/download ride the Blob. Acceptance: 103 ms worst frame, card on. 302/302.
- NOTE: the card requires a SCORING night (wave-5a summary law) — a no-hit robot night earns no card;
  verify card UX with the user's next real night (open the pause card → NIGHT CARD button → the card).
- USER IS CLEARED TO INVITE FRIENDS. Friend brief: desktop + mouse/trackpad, just the link, 7-step
  lesson, incantation W W S S A D A D · L · SPACE, anonymity structural (sigil-only strangers).

## -11. 2026-08-23: wave 17 — A WORTHY NIGHT (`648c646`) + relay ease (`5301864`), both live
- Worthiness eased user-calibrated: GH_WORTHY_ARRIVALS=8, GH_WORTHY_DUR=45; relay mirror eased FIRST and
  live-smoked (50s→200, 44s→422) — deploy ORDER law: relay before client whenever the mirror moves.
- Legacy Supabase realtime channel fail-quiets on one latch (dead 401 credentials were retry-hammering);
  healthy path byte-preserved. Reviewer 14/14. 298/298.
- STILL OPEN: the user's first real night on the wire (only 4 smokes + 2 ease-probes on the relay). Their
  console showed [0,'9aff99'] = token minted, night unstored (old bar). With 8/45 live a casual minute
  banks. Next: user plays → scan relay (non-2338/2000-ish artifacts = real) → celebrate → friends invited.

## -10. 2026-08-23: wave 16 — THE BRISK LESSON (`b846d7f`) shipped+live
- Trainer gates halved AGAIN (user-locked; they kept the every-night tutorial over a skip gate — 'sometimes
  the tutorial is refreshing'): 3/2/2, TRAIN_NEED_TOTAL 7. Ghost finalize-on-page-departure: pagehide +
  persisted:false ONLY (review blockers, 13/13: visibilitychange finalize would have killed nights on
  tab-switch; unconditional keepalive silently dropped >64KiB uploads even at the bow — envelope
  serialized once, keepalive only under the budget, bow uploads ordinary fetch). 297/297.
- STILL OPEN: the user has NOT yet landed a real night on the relay (only the 4 smoke ghosts, buckets 5-8,
  2338 B each). Next session: after the user plays post-wave-16, query the relay (scan lon 0-23 via
  X-Ghost-Token header; a non-2338-byte artifact = their first real night) and CELEBRATE it; then their
  second night should seat their own ghost + a smoke visitor. Overnight Codex API drops repeatedly wedge
  runs (~02:00 JST) — kill + continuation-dispatch is routine; see the codex-dispatch-procedure memory.

## -9. 2026-08-22 NIGHT: wave 15 — THE VISITOR (`418eec1`) shipped+live. THE CHORUS IS OPEN.
- **Shipped**: ghostShare:1 — worthy nights upload to the Ghost Relay (anon 32-hex token, X-Ghost-Token
  header ONLY; lonBucket from TIMEZONE only); a nearby stranger's night seats at −90 (THE VISITOR — same
  veil/reveal/beacon laws, its own seeded chalk, moon-phase-sigil identity); gifts generalize over both
  seats; visitor catches batch to its mailbox; own mail arrives read-once at the threshold ('N of your
  notes were caught · sigil') and each caught note RETURNS as a road-clocked shooting star at its beat
  (GH_RETURN_MAX 16). RIDER: incantation = W W S S A D A D · L · SPACE (trackpad-true; MB2 arm deleted).
- **THE FIND OF THE ARC (no-mocks e2e through the REAL doors)**: waves 13-14 shipped with the ghost
  system UNREACHABLE — the only entry is beginAs(true) (trainer), graduation flips trainMode mid-session,
  and the recorder/seat armed only at main-play RESET. Fixed: graduation IS main-play session start —
  setTrainPhase(3) → ghostSessionStart() (seat → visitor/mail fetch → recorder), road clock based at
  graduation, lesson still never records. PROVEN through the honest lifecycle on a quiet machine:
  incantation → graduate → 214 s night → 19 arrivals → bow stores 2,962 B → reload → graduate →
  own:true. LESSON FOR ALL FUTURE WAVES: the harness's trainMode=false staging BYPASSES the real
  topology — every acceptance must also walk beginAs(true)→incantation→graduation at least once.
- **Environment laws learned**: localhost harness CANNOT test relay network legs (CORS allows only
  production origins — by design); production-origin e2e = puppeteer on aim-dojo.vercel.app with pure
  input events (no __dbg there). The audio/road clock STARVES under machine load (road-time 0.2×-0.85×
  real when load>5 or >15 zombie Chromes — `pkill -9 -f chrome` + wait before timing-sensitive probes).
  A bad robot player suppresses spawns BY DESIGN (the tide); worthy nights need ~5-8 min blind play.
- **Reviewer 12/12**: wave-15 round closed a real trust hole (bounded relay JSON — abort timer must
  cover BODY consumption; byte ceilings BEFORE validation) + tz half-hour table (India/Newfoundland/
  Kiribati) + isolation oracles + Space-only-at-step-10. Relay: header-only tokens deployed
  (sidereal 313b234, live-smoked: body-token 422, header 200, read-once mail w/ sigil).
- **In flight at handoff**: the production-origin e2e (prod-e2e.mjs — live site, blind 8-min night,
  relay queried after for the fresh upload, night-2 screenshot). If it surfaces production issues,
  fix-forward. NEXT candidates: visitor render polish pass (user judgment on -90 peripheral weight),
  0d (±2 seats + silhouette line + ghost-filled chairs), the perf tuning session (gift LOW remeasure,
  GH_GIFT_LEAD feel), SENSEI_PACK projSpeedFast=72 vs base 60 reconciliation.

## -8. 2026-08-22 LATE: wave 14 — THE GIFT (`ca6348d`) shipped+live · GHOST RELAY on branch · slowdown fixed
- **THE GIFT (six rounds — the deepest wave yet)**: during my mercy the ghost's falling notes are catchable.
  Lock extends to flares (real targets outrank charity); gift shots fly GH_GIFT_SPEED=72 on the ROAD CLOCK,
  connection-graded only, and CAN NEVER HURT (punitive whiff taps suppressed, mutation-enforced); catch =
  star-burst + beacon sigh + mail row; threshold speaks 'you reached back · N notes caught'. ghostGift:0 →
  wave-13 byte-identical (8-combo fixture). LIVE ACCEPTANCE: 5 real catches in a 90 s storm at seat 90 m
  (harness/gift-storm.mjs — the in-page hunter: aim the analytic loft at the led flare, fire whenever the
  honest lock golds).
- **The six lessons (probes + reviewer, now 10/10)**: gifts died at the OLD ±32 m room walls; a 1.5 s window
  cannot fit a 1.4 s flight (GH_GIFT_LEAD=2.6, review-marched at 72); collisions must clamp to arrival;
  rewind resurrected caught slots; 'projSpeedFast' is 60 in base CFG (72 only in SENSEI_PACK) — blessings
  need their own named number; the LOCK must not promise post-arrival connections (honest-lock band test);
  and the ROOT of every near-miss: projectiles integrate on 50 ms-CAPPED render dt while ghosts replay on
  the uncapped road clock — ~11 m shear on slow frames. Gift flight now integrates on the road clock; the
  numeric differential oracle (march vs faithful flight) pins the agreement forever.
- **THE USER'S LIVE SLOWDOWN ('slows down when playing after a bit') — FIXED**: the lazily-built ghost seat
  missed boot warmShaders; first reveal each night compiled ~6 programs mid-beat (3.5–11.8 s single frames
  measured). ghostSeatBuild now schedules an idle renderer.compile re-warm; stall probe worst frame 181 ms.
  Longevity probes (harness/longevity-probe.mjs, mercy-stall-probe.mjs — with KEEP-ALIVE taps/fires or the
  bow ends the session and poisons the data) proved NO leak: heap/scene/draws/Tone timeline all flat.
- **GHOST RELAY (sidereal repo ~/repos/sidereal, branch `ghost-relay` @712d60c, pushed, NOT merged)**: the
  0c transport server — anonymous token upsert, lonBucket 0-23 fetch, mail w/ read-once + sigil-only
  identity; hardened by a security review (8 findings: pre-parse body limits, Railway CIDR proxy trust +
  IPv6 /64, storage quotas + secure_delete in a separate DB, SQL-side reads, tokens→headers + log
  sanitization, mailbox ingress protection, id rotation, UTC date mirror). 96 relay tests; repo
  regression-free (venv .venv-check; baseline = 5 SkyPack fixture fails + 1 env serve fail). MERGE TO MAIN
  = RAILWAY DEPLOY — held for the user's explicit word. Game-side UTC realCivilDate fix shipped in wave 14.
- **Next (0c client, after relay deploys)**: the visitor seat at −90 (multi-seat refactor of the singleton
  _ghost* globals), upload-at-finalize + fetch-at-reset via the relay, gift/mail vs visitors, sigil render.
  Perf note: one degraded-env sample showed gift-on LOW median +8-11 ms at a staged reveal (day's noise
  band was that wide) — REMEASURE in a fresh environment during the tuning session.

## -7. 2026-08-22: wave 13 — NIGHT GHOSTS phase 0a (`378c005`), shipped and live. MULTIPLAYER BEGINS.
- **The chorus design (user-locked over a long brainstorm)**: sovereign parallel railways (own seed/tempo/
  song/tide per player), seat spacing 90 m, Option B THE VEILED CHOIR — my walls byte-identical to solo
  (fixture-enforced), the chorus revealed by MY mercy via the shipped uK bars-to-mercy authority
  (v: 0 → 0.35 @2 bars → 0.7 @1 → 1.0 mercy). Always-visible exception: the lane-coloured lighthouse
  BEACON over the parapet when a ghost drops a note. Behind the inverse pane the ghost renders in
  negative — the spirits law, uniform (all ghost draws precede order 6). Studies: studies8/chorus
  (walls-choice-sheet.png; the rejected "room makes room" narrowing taught us the walls are sacred).
- **Phase 0a shipped**: every main-play night records itself (aimdojo.ghost.v1, localStorage, one slot,
  finalize-if-worthy ≥16 arrivals/≥60 s, invalid can never replace valid) and last-night-you rides beside
  you from your second night. Ghost wears last night's TRUE chalk (prior-night course seed + private
  palette stream re-derived). One road clock (Tone.Transport.seconds − audioLat()) for record AND replay.
  Knobs ghostRecord/ghostSeat, each 0 → solo byte-identical. LOW arm: beacon+road+targets+avatar only.
- **FOUR review rounds (reviewer 9/9)**: R2 BLOCK×8 (two-clock, rewind/bpm0, palette drift, validation
  gaps incl. invalid-overwrites-valid, tank-chip fires as misses, two surviving mutants, beacon/avatar);
  R3 FIX×3 (divergent-clock hits voided the whole night via hitT>arrivalT — recompute arrival at
  resolution; equal-time fire stamps credit wrong projectile — opaque row token; bow yaw MIRRORED —
  GH_AVATAR_YAW_SIGN=+1 with an aim-direction oracle vs gameplay's x=−sin(yaw)). 262/262, 34 mutants.
- **Ops lessons (memory updated)**: Codex's sandboxed gitnexus CLI HANGS indefinitely (8 h stall) — ban it
  in briefs, dispatcher does impact via MCP; Monitors need log-size stall detection (15 min); one round
  died on a Codex API network drop — just re-dispatch. Probe kit: ghost-probe2/ghost-beacon/ghost-yaw-
  probe (staging: trainMode=false + ghostSeatReset() via glob, uK pin drives the reveal; artifact rule:
  expired targets need hitT null; slots strictly increasing).
- **Phase 0b (NEXT, designed and user-approved)**: Railway transport (the sidereal app at index.html:1044)
  for other players' ghosts, longitude SEATING (sort key only — spacing stays 90 m), ±2 full seats +
  silhouette line, ghost-filled empty seats ("live is a ghost with zero delay"), gift archery at the
  flares (graded on CONNECTION not rhythm; only droppable notes giftable; mercy lends expert muzzle
  speed), the MAIL (assists delivered into the recipient's next session), stranger identity = zodiac
  sigil only. Perf note: reveal-open LOW +2.7 ms median (mercy-only); revisit if 0b widens the seat count.

## -6. 2026-08-22: wave 12 — SPACE TRUTH (`5962b82`), shipped and live
- **Parcel R — THE CONFIRM CROSSFADE**: the beat circle's correct-hit confirm used to vanish at the note
  midpoint in the same frame the next ring was born at full radius (user: "snaps back to a predetermined
  radius"). Now the confirm ECHOES past the flip (0.30 s capped at 0.6× interval, keyed on time + stored
  radius — nd-remap- and reset-proof) while the fresh ring condenses in over its first 18 % (ML_RING_IN).
  Frame-captured proof in harness/hud-{on,off}-sheet.png. ringEcho:0 → shipped draw path verbatim.
- **Parcel V — THE ARC BELIEVES THE VOID**: computeShotPlan still ended the aim parabola at the deleted
  floor (y<=0.04) and decorated the phantom point. Under moonlineVoid() the ribbon now continues to
  ML_ARC_FAR (140 m) with a 28 % tail dissolve (build-time uTail arm), landing ring + pulse rings stand
  down, uBands scales with the extension so the ROYGBIV period stays shipped, and the ribbon draws at
  renderOrder −41 in the void so the falling tail sits BENEATH live road cues. computeShotPlan byte-
  identical (SHA-pinned test) — aim/bullets/whiff timing untouched. Dojo/Temple/trainer-lesson keep
  their honest ground. arcVoid:0 → shipped shader byte-for-byte.
- **Review lessons (reviewer now 8/8)**: round 1 broke the SHIPPED in-void suppression inside
  spawnLandRing by rewiring its gate (restored — real missed shots already had no void ring: check HEAD
  before "adding" a suppression); implementer's "7 constructed, 7 killed" was FALSE — the review
  constructed 8 more survivors (frozen-solver hash, reduceMotion arm, spoiled-echo, pocket ring,
  allocation, pause/Temple lifecycle, uBands period, named-const inlining). Verify mutation claims.
- 242/242 tests. Probes: harness/ring-probe4.mjs (in-page HUD canvas frame recorder — full screenshots
  are too slow on SwiftShader to resolve sub-second HUD behaviour; record every rAF into canvas copies
  and pick nearest-to-target frames), arc-probe.mjs (state flags + full frame).

## -5. 2026-08-21 EVENING: wave 11.2 — THE INVERSE (`f1ad43b`), shipped and live
- **The mercy wall is now a colour-inversion pane**: ring/rose/veil retire behind flat knob `mercyInverse:1`;
  one non-depth-writing draw reuses the sibling walls' exact doorway silhouette, face = pure `1-dst` via
  CustomBlending (OneMinusDstColorFactor/ZeroFactor, white fragment, binary discard edges ONLY — inversion
  cannot alpha-fade). Night → paper-white with black stars; the next chamber's chalk shows as its own
  negative (green→plum); the doorway is the only true-colour view, wearing a crimson corona (the mint door
  glow inverting around it). Crown star stays true gold at order 6.5 over the pane's 6; dust promoted to 7.
- **The round-2 lesson (reviewer 6/6)**: my renders caught the pane inverting the FOREGROUND (road/cues
  nearer than it — road never writes depth, pane draws later) — a Lane Law breach during the final peak
  bar. Fix: a depth-only road-deck guard (child of roadMesh, exact road vertex shader + shared
  roadMat.uniforms, colorWrite:false depthWrite:true, order 5.5, built AND visible only with a live mercy
  pane). Foreground true, everything genuinely behind the filter inverted. Target CORES were already safe
  by law (opaque MeshBasicMaterial writes depth); their additive fringe is guarded by the same prepass.
- 227/227 tests; 7 constructed mutants killed (all-reader uK table, one-object pane lifecycle true→false,
  numeric crown apex, representation-independent lane-literal scan across all changed GLSL, target-depth
  contract, prepass structure, footprint spelling-sync). `mercyInverse:0` → wave-11.1 byte-identical
  (new frozen fixture moonline-wave11-1-shaders.fixture.json, verified against shipped `e9269e1`), and
  wallsOn:false still → wave 10. LOW perf, pane staged visible: median +0.5 ms, p90 +3.6 ms (mercy window
  only; +0 submissions otherwise). Probe: `harness/inverse-probe.mjs` (uK pin + forced pane visibility).
- Improvement menu still open: doorway crossings as felt events (bloom+whoosh on bar lines), tide-ordered
  palette (warm→cool toward mercy). The mercy-chamber-as-place item is PARTLY superseded by the pane.

## -4. LATE 2026-08-21 (post-Enfilade): wave 11.1 + the incantation, all shipped and live
- **Wave 11.1 — THE BREATH (`a8a668c`)**: the enfilade exhales toward mercy (the wall 2 bars out renders at
  60 % dissolve; the 1-bar slot stays inside wave-11's absolute no-wall gap; inhale after mercy is instant)
  and the walls hear play (uWallHit/uWallMiss road-clock stamps from the FLAWLESS/clank sites → chamber-local
  warm ripple +12 %/1.5 beats and clank dim −10 %/half-beat). Bars-to-mercy is PACKED into uK as fractional
  hundredths — a truth table test pins the decode for every reader. Review caught: reduced-motion locality
  vs pinned stations (echo died forever after ~1 min), stamps surviving resetSession (phantom ripples), and
  the fixture omitting accent/veil + duplicate switch-alone cases (the coupling-blindness pattern, 4th time).
  Knobs wallExhale/wallEcho, each 0 → wave-11 byte-identical.
- **THE OLD CODE, final form (`e9269e1`; earlier forms `5c03c63`/`7dfa1a7` superseded)**: W W S S A D A D ·
  R-click · L-click, spoken MID-LESSON through live play (taps stay taps; the closing click fires AND
  graduates via setTrainPhase(3)); the advancing right-click swallows its one skyFreeze toggle; honest
  graduation teaches the secret for 2 s (showGhostToast slow variant), code-graduates are not re-taught
  (_konamiGrad). Never persisted — contract-pinned in index-contract.test.js.
- Suite is 219/219. The user's improvement menu (from the wave-11 debrief) still has open items: doorway
  crossings as felt events (bloom+whoosh on bar lines), tide-ordered palette (warm→cool toward mercy), the
  mercy chamber as a place (denser canopy, rose shedding petals).

# CONTINUATION_PROMPT — Moon Chorus / aim-dojo (resume here, 2026-08-21 night (superseded header))

## -3. THE VISUAL REDESIGN ARC (2026-08-20 → 21): waves 9–11, all shipped and live
Three waves in ~36 h, all via the Codex dispatch loop (§-1 below), all user-directed through RENDERED STUDIES
(the loop that works: build 2-3 standalone Three.js studies in the scratchpad, screenshot at the GAME camera
(eye 4 m, FOV 95), let the user pick/refine, only then spec + build). Studies live under scratchpad/studies*/.
- **Wave 9 — THE NAVE (`5802a0f`)**: white lit-stone round coffered arches (SERENE study), gold-star vault
  canopy, honey-glass street behind `naveStreetGold`. The review caught a LANE-SWAP BLOCKER (spec listed hues
  in non-lane order; W painted green). LAW SINCE: lane colours derive ONLY from uL0..uL3 ← _roadLaneCol ←
  WASD_HEX (0=W cyan, 1=A green, 2=S gold, 3=D pink); chain tests in `f435805`; NO lane-colour literal ever.
- **Wave 10 — THE TERRAIN (`047deab`)**: carved chevron marks replace the full-width lane bands (dark socket
  under them — gold-on-gold vanishes without it), re-based elevation (deck always at the feet; only curvature
  reads; crests cost lookahead — user accepted the trade knowingly, `terrainAmp` dials it), 7-beat/2.2 m curve
  harmonic (+20 % tangent kept). `leanBite:0.25` keeps the tracking drill's p90 lean within 1 % of wave 9 —
  the dolly moving the aim is DELIBERATE shipped design; the review misread it as a violation. Perf lesson:
  the dark socket re-submitted the whole ribbon; diagnose by FOUR-VARIANT measurement, never one-variable.
- **Wave 11 — THE ENFILADE (`992e75f`)**: pastel chalk walls the road PIERCES (up/down/sideways, solid ~95 m,
  powder-dissolve by ~200), tall oblate doorways with veduta light, night-seeded chamber palette (private rng
  stream off roadCourse's key, lazily seeded at first live sync), NO side walls (Echoes spawn 360°), glow-
  through pass for walled orbs (GreaterDepth, scope documented as accepted), mercy = no wall one bar before
  → two after the ring, chevrons SATURATE TO PURE LANE COLOUR exactly at the audible band-edge (floor(b)−uNow
  — per-fragment keying peaked half a beat late; review caught it). LOW station cap 7 fixed p90 73→34 ms.
  Kill-switches: `wallsOn:false` → wave-10 byte-identical (frozen fixture, each switch tested ALONE).
- Recurring review lesson: the frozen-fixture test has missed a coupling in EVERY wave (gate not including the
  master switch); test each kill-switch ALONE, and construct the surviving mutation.
- Harness facts: make-harness.py injects __dbg (now exposes CFG/materials/glob eval); server PORT 8771 (8765
  was stolen by another session's server — check what you're actually serving); Codex's sandbox has NEVER been
  able to render or bind ports — the dispatcher renders, Codex must not claim frames it didn't make.
- Debugging law from the study rounds: when patches provably apply but pixels don't change, stop theorizing
  and do PER-OBJECT ELIMINATION (hide scene children, measure pixels). The culprit was exp(-y) diverging below
  the deck — the HALF-SPACE HAZARD is now named in specs and audited per wave.

# (superseded) CONTINUATION_PROMPT — Moon Chorus / aim-dojo (2026-08-19 evening)

> Supersedes the 2026-07-08 handoff (`git show 4e145b8:CONTINUATION_PROMPT.md`). Durable design record: memory `aim-dojo-unified-vision.md`. Deploy facts: memory `aim-dojo-deploy-infra`. HEAD at handoff: **d906ccf** on `main`, working tree clean, live at **aim-dojo.vercel.app** (push to `main` auto-deploys in seconds).

## -1. What the 2026-08-19 evening session shipped (d906ccf) — read §0 next, then this
- **Regression found & fixed:** `97b6134` (the aim-trail deletion) had joined two lines onto the previous lines' `//` comments: `onExpire` lost `removeTarget/streak=0/pushEvent(false)/FADED` (every timed-out orb stayed in the scene with its oscillator running; streak never reset on a miss) and `resolveFlickLock` lost `killTarget` (dormant). Restored + a contract test now scans every inline script for call statements swallowed by `//` (two shapes) + a vm test on `onExpire`. **Lesson (memory `aim-dojo-comment-swallow-hazard`): never delete a statement on a multi-statement line mechanically; run the swallow scans after any such edit.**
- **Snappy RESUME (user report: kid pressed Esc, hard to resume):** Chromium rejects re-lock within 1250 ms of the user's Esc (`kEffectiveUserEscapeDuration`); the old `pointerlockerror` fallback entered the run UNLOCKED (dead mouse). Now `onPointerLockError` + `cancelLockRetry` (index.html ~9754-9775): inside the cooldown the button says ONE MOMENT… and the lock is re-requested when the cooldown lapses (still under the click's transient activation) → enters LOCKED ~1.3 s after the click; genuinely unavailable lock → unlocked run (never stuck), first canvas click relocks once then clicks fire. State: `_lockLostAt/_lockRetryT/_lockRetries/_runNeedsRelock/_relockTries/_lockReqPending` (~:1148). `_lockReqPending` = "a RESUME/PLAY request is in flight": set only by `startRun`'s desktop branch and the cooldown retry, cleared ONLY by `cancelLockRetry` (called from enterRunning/exitRunning/pad start/tab-hide/acquired/hidden-error); the `pointerlockchange` acquired branch releases a lock nobody asked to enter with (`document.hidden || (!running && !pending)`). Harness-verified (cooldown resume 1.4 s locked; fallback <1 s; pad/hidden/late-request races stay paused). The pause card itself was never slow: exitRunning+showPause 2.5 ms, idle frames 98.7 % idle.
- **Audit fixes (from a 6-lens/12-agent workflow, 11 confirmed):** cloud-pref reconcile no longer reload-loops under `?low/?hi/?sky=` (`LOW_FROM_URL`, `SKY_MODE_FROM_URL`); `audioLat()` now reads `listener.context.outputLatency` (Tone 14's wrapper has none — the correction was silently baseLatency-only), finite-positive, clamped 0.35 s, behind `AUDIO_OUT_LATENCY` — **tell the user to press CALIBRATE once** (their stored offset absorbed the missing term); CALIBRATE syncs `offset_ms` to the cloud; first PLAY/pad-first runs build reverb synchronously (fail-soft) instead of staying dry; Vercel root modules now `max-age=0, must-revalidate` (were 7-day cached against a max-age=0 index.html).
- **Not done (deliberately, user's call):** hygiene deletions verified dead — `avgReaction`+`pushReaction`+reaction ring buffer, `classifyPocket`, `showTempleSignArt`, `placeTempleSignArt`, `starLitLevel`, `showListenGhost`/`hideListenGhost`, `eighthSec`, `timingErrorMs`, `setClassName`, `liveCount`; `decoyChance/decoyDistMul` unread (the `:1054` comment claiming decoys are revivable is false); `tg.lifeBeatsEff` write-only. Also downgraded/left: Three.js-CDN-failure shows a greyed PLAY with no message; Tone-failed copy unreachable; two AudioContexts (a Firefox `AudioListener.positionX` polyfill risk if unified); starChorus last-writer-wins across tabs. Full record: this session's workflow journal `…/3186ce38-…/subagents/workflows/wf_69549391-97f/journal.jsonl` and the Codex briefs/reviews in `CODEX_PROMPT_RESUME_SNAP_AND_AUDIT_FIXES.md` (rounds 1-4).
- **Procedure that worked ("standard work procedure"):** audit workflow → brief `CODEX_PROMPT_<TOPIC>.md` (evidence at file:line, exact fix, GitNexus blast radius, acceptance, hard rules) → `codex exec -m gpt-5.6-sol -c model_reasoning_effort=xhigh -s workspace-write -c approval_policy="never" -C <repo> -o <last.md> "<prompt>"` (detach with `setsid nohup … &`; `--approve-for-me` clashes with `-s`; `exec review --uncommitted` cannot take a custom prompt → use plain `exec -s read-only` for the adversarial review) → my own harness probes + tests → Codex adversarial review (read-only) → fix rounds until SHIP → GitNexus `detect_changes` → commit/push. Codex has no GitNexus MCP but the CLI works (`gitnexus impact <sym> --direction upstream`). The reviews were worth it: rounds 2-4 closed a real blocker (relock swallowing every click) and three race conditions.
- **GitNexus on this machine:** TWO repos are indexed (`aim-dojo`, `apstats-live-worksheet`) → every MCP call needs `repo:"aim-dojo"`. Another session's Codex hammers the shared index DB; incremental `gitnexus analyze` has hit `FTS index 'file_fts' is inconsistent` three times → use `GITNEXUS_MAX_FILE_SIZE=4096 gitnexus analyze --force` (≈3-4 min). The PostToolUse hook says "index stale" after every commit until you re-analyze; re-analyze rewrites the counts in CLAUDE.md/AGENTS.md — commit them.
- Harness recipe unchanged (§5); this session's scripts live in the scratchpad (`harness/make-harness.py` injects `window.__dbg`, `resume-probe.mjs`, `r6-probe.mjs`, `expire-probe.mjs`) — regenerate from the recipe if the scratchpad is gone. Headless Chrome cannot reproduce the browser-side Esc cooldown; the probes shim `canvas.requestPointerLock` to reject/defer.

## 0. FIRST THING NEXT SESSION — GitNexus is now wired up
Last session the GitNexus **MCP tools were not callable** (the server had never been registered on this machine), so blast-radius checks were done with grep. That is fixed:
- `gitnexus setup -c claude` was run → MCP server `gitnexus` registered (`claude mcp list` shows it ✔ Connected), 9 skills in `~/.claude/skills/`, Pre/PostToolUse hooks installed. Reversible with `gitnexus uninstall`.
- The repo is indexed at HEAD (`.gitnexus/` — gitignored; 4,003 symbols / 7,615 edges / 300 flows). `gitnexus status` tells you if it's stale; refresh with `GITNEXUS_MAX_FILE_SIZE=4096 gitnexus analyze` (the env var is REQUIRED — index.html is 1 MB; the default 512 KB threshold silently skips it). Bare `npx gitnexus` crashes on npm 11; use the global `gitnexus` binary (`npm i -g gitnexus` if missing).
- MCP tools load at session start, so in a fresh session `impact / context / query / detect_changes` should just be there. **Sanity check at the top of the session:** `context({name:"animate"})` — if it errors, `claude mcp list` and re-run setup.
- Follow CLAUDE.md's rules for real now: `impact({target, direction:"upstream"})` before editing a symbol, `detect_changes()` before committing. Graph line numbers cite `tools/index-inline.mirror.part<N>.js:N` = `index.html:N` (same line). **After ANY index.html edit: `node tools/extract-inline.mjs`** (regenerates the mirror; commit the parts alongside), then re-analyze before trusting graph results again.
- Note: `gitnexus analyze` also rewrites the symbol counts in `CLAUDE.md`/`AGENTS.md` and its skill files — commit that bookkeeping or it sits as noise in `git status`.

## 1. What last session did (2026-08-18 → 19): a Three.js perf/visual audit (`/improve-threejs`), all shipped
Method: headless Chrome (puppeteer-core, SwiftShader) with a **patched harness copy** of index.html in the scratchpad exposing `window.__dbg` (never in the repo) — GL create/delete counters, `renderer.info`, a `getProgramInfoLog` link tracer, CPU profile — plus a 9-finder/39-verifier workflow. Findings that mattered:
- **`3ed60a3`** Shader warm-up: r128 links programs lazily and synchronously; the arc-ribbon shader linked on the PLAY frame, shard `PointsMaterial` on the first hit, a LineBasic variant on first spawn. `warmShaders()` (boot idle) now pre-creates one of each on-demand kind, compiles, releases to pools → **0 links after PLAY** (measured). Reflection pass: mirror camera was det −1 → BackSide sky dome/milky shell were winding-culled out of the floor mirror; now a rigid camera (`REFL_M·M·REFL_FLIP_X`) + x-flipped RT sample in the floor shader (index.html ~1539). `sizeRefl` re-renders immediately. WASD ring canvas backing store 560×dpr → 300×dpr (its real CSS box). Night grid recolours vertex colours in place (no dispose → relink). `_templeDisposeChildren` prunes `_hzFadeMats`. Gamepad no longer forces 60 Hz idle frames. Two `Tone.Transport.ticks` reads in `animate()` → one lazy sample.
- **`97b6134`** Deleted the dead per-orb aim trail (silently dead since e172584 swallowed `tg.trailMesh=…` into a comment) — trail mesh pool + `starFlyStep` remain (returning-voice line). `enhancePlanetTexture` → 256-entry LUT. One `camera.matrixWorldInverse` per frame; `setVar()` change-guarded `--tx/--ty/--lx/--ly`; hoisted per-frame closures; epsilon dirty check in `placeAllSignArt`.
- **`0b55d06`** Audio automation diet (user: random crackle in Chrome at solid 60 fps): r128 `AudioListener`/`PositionalAudio.updateMatrixWorld` pushed 9 / 6 `linearRampToValueAtTime` per call, ~3 walks a frame → ≈1,600 + 1,100·N events/s. `quietAudioMatrixUpdates()` wraps them: listener once per two frames, Echo panner only when its pose changed. **User says it sounds good** — but if crackle recurs, the next suspects are steady-state load: TWO AudioContexts (Tone's + THREE's), an HRTF panner per Echo, a 2.2 s stereo convolver.
- **`c7cbeee`** Stale observer guard: the persisted observer location (Boston) stayed authoritative after moving to Japan → the sun/sky were computed for Boston (checkerboard at 20:47 JST). At boot a non-manual record whose longitude disagrees with the device UTC offset by >4 h is dropped (+ geo-tried latch) so the device is asked again; manual locations kept. `observer-location.js` gained `timezoneDisagrees`/`clearObserver` + tests. **User confirmed: works.**
- Baseline facts worth remembering: GL/three resource counts are FLAT over long play (no leaks); JS main thread ~92 % idle; the codebase is already heavily hand-optimised — look for what survived that care, not for textbook items. Menu/pause runs at 20 fps **on purpose** (`IDLE_FRAME_MS`); user chose to keep it. Colour space is deliberate linear passthrough (comment ~index.html:2988) — not a defect. Tests: `node --test tests/*.test.js` → 183/183.

## 2. Verified-but-deliberately-not-changed (don't re-find these)
Transparent floor layers with no `renderOrder` (ordering is monotonic in y — stable in practice); dome early-z reorder (its FBM branch is already gated `el>0.03`); r128 `PositionalAudio` ramps (now dieted, see above); `enterSkyTemple` rebuilding temple geometry each entry; per-hit double forced layout (`void el.offsetWidth` idiom ×2); `bowGlyphPaint` fillStyle strings per dot during the 4 s Mandala; `broadcastAim` payload every 85 ms even when still. Full finder/verifier record: `~/.claude/projects/-home-mrcolson-repos-aim-dojo/6e6a8ce8-…/subagents/workflows/wf_f0cf1ce8-60a/journal.jsonl`.

## 3. OPEN threads (confirm with the user before starting)
- Audio: watch for crackle recurrence → contexts/HRTF work above.
- Nothing else pending from the user. Candidate hygiene if asked: the disabled flick-bonus block, `tankOpen/tankGlow/tankBeatPhase`, unused records helpers.

## 4. Identity (unchanged — do not regress)
First-person **rhythm shooter under a real sky**: Echoes glow open on the beat, you fire a ballistic arc, the kill is judged at **ARRIVAL**, off-beat = CLANK. WASD on the "and". Aim is always the star — no auto-aim. Every visit starts with Moon Sensei's trainer (checker floor / room), graduation opens the full night (the void, the Star Road, star-tethers). Zen feel prized: tune CFG consts, don't add UI (pause SETTINGS is the sanctioned exception). `prefers-reduced-motion` disables motion effects — check it first if "an effect disappeared". Sky is wall-clock/sun driven (`SKY_TIME='natural'`, observer location → true sun; no location → civil-clock fallback).

## 5. PROCESS
- **Harness for evidence, never guesses**: copy index.html to the scratchpad, inject a `window.__dbg={…}` hook right before `renderPrimary(false,false);\nanimate();`, symlink `*.js`/`assets`/`fixtures`, serve with `python3 -m http.server`, drive with puppeteer-core (`npm i puppeteer-core@25` in the scratchpad; Chrome at `/usr/bin/google-chrome`, flags `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`). SwiftShader auto-detects as LOW → add `?hi` for the full-quality path. `?low` forces LOW. Trainer→full night: `__dbg.setTrainPhase(3)`. Fake the clock with a `Date` shim in `evaluateOnNewDocument`.
- Syntax check = the test suite (`index-contract` parses every inline script). Ship: `git add … && git commit && git push` (auto-deploys). Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + the `Claude-Session:` line.
- Ultracode/workflows for audits; adversarial verify every finding at file:line — verifiers repeatedly downgraded plausible-but-marginal items and refuted "already mitigated" ones.
- Audio/feel is ear/eye-judged: ship a first pass behind a const, let the user react.

## 6. Deploy / repo
Vercel primary (push→live seconds), GH Pages mirror, Railway public-sky API (`sidereal-production.up.railway.app`, CORS-blocked from localhost — expected). Repo github.com/robjohncolson/aim-dojo, branch `main`. Machine: Ubuntu, node 24, npm 11, 4 cores (workflow concurrency = 2 agents — plan for it).
