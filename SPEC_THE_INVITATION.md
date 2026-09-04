# The Invitation — Waves 19–22 (friends arrive, the chorus line lengthens, the night is felt, the house is swept)

**Version:** 1.0 · 2026-09-03
**Origin:** the 2026-09-03 brainstorm after wave 18 landed the user's first real night on the relay and cleared them to invite friends. The user's word: "all of it — spec it out." This spec is the whole menu in build order, each item a parcel with anchors at `index.html:LINE`, a flat knob, a stream/byte-identity law, and acceptance. Every parcel is build-blind in the house way: syntax + logic + tests + probes; the user judges feel.
**Files touched:** `index.html` (+ regenerated mirrors), `tests/*`, `tools/relay-scan.mjs`, `.github/workflows/tests.yml`; the relay half of parcel G lives in the sidereal repo (`src/sidereal/ghost_relay.py`, `tests/test_ghost_relay.py`).
**Follows:** wave 18 (`2e885b0`, live). Everything here generalizes shipped machinery; nothing renames a storage key, adds a mode, adds a settings row, or reintroduces anything from the kill list (HUD counters, boards, terrain floors, lore panels, fabricated presence).

## 0. What ships, in one breath

**Wave 19 — THE INVITATION** makes a friend's first night go right: the lesson calibrates their audio offset without a word, the night card carries the link, the cold load is measured against a budget, a scan tool shows their first night on the relay, and two holes close (trainer runs stop writing records; a CI job runs the suite on every push). **Wave 20 — THE CHORUS LINE** widens the relay seating to three strangers, prefers the stranger who reached back for your notes, and seats your own past self from the last night the moon looked like this. **Wave 21 — THE FELT NIGHT** makes doorway crossings events (bloom and a low whoosh toward mercy), orders the chamber chalk warm→cool along the tide, adds a one-line-per-first-time Moon Sensei II for post-graduation dynamics, and writes down the tuning protocol. **Wave 22 — THE SWEEP** deletes the verified-dead helpers and guards the page against a Three.js CDN failure.

Build order is the section order. Each wave ships and goes live before the next starts (Vercel push → live in seconds; the relay leg of G deploys FIRST, per the wave-17 deploy-order law).

---

# WAVE 19 — THE INVITATION

## Parcel A — THE SILENT CALIBRATION

**Why.** The pause card's "calibrate from my taps" (`index.html:10462-10470`) folds the mean WASD tap offset into `_userOffsetSec` and needs 6 taps. A friend will never open it. The accumulator `_tapOffSum/_tapOffN` (`5638`) is fed by every resolved tap at `_wasdResolve` (`1500`) and is never cleared by `resetSession` (`11314` clears only the display trio), so by the first pause a real night has dozens of samples.

**What.**
- Extract the button's arithmetic into one pure-ish function `calibApply(avg)` (clamp `[-0.12,+0.32]` s, set `_userOffsetSec`, `rebasePocketMissTracking()`, write `localStorage['aimdojo.offsetMs']` as rounded ms, `queueCloudPrefs({offset_ms})`, reset the accumulator). The button handler calls it (byte-identical behaviour, one authority for the arithmetic).
- New `calibSilent()`: fires when ALL hold — `CFG.calibSilent` on; `!_calibSilentDone`; no stored offset (`localStorage.getItem('aimdojo.offsetMs')===null` AND `_userOffsetSec===0` — a cloud-applied or hand-set offset is never overridden); `_tapOffN>=CALIB_SILENT_MIN_TAPS` (**12**, twice the button's bar: the lesson's forgiving windows and a newcomer's noise need the larger sample); `|avg|>=CALIB_SILENT_MIN_MS` (**12 ms**: a mean inside the noise floor is not a latency, and the accumulator is then LEFT INTACT so the button still works). When it fires it calls `calibApply(avg)` and sets `_calibSilentDone=true`. No toast, no hint, no copy: the friend is simply on time from then on.
- Two call sites, both session boundaries where the button itself is allowed to move the heard timeline: the graduation branch of `setTrainPhase` (`5826-5838`, after `resetPocketState()` at `5829`, before `ghostSessionStart()` at `5833`) and the top of `showPause` (`11588`) guarded `!trainMode`. Graduation usually has fewer than 12 taps (the lesson needs only 3 graded steps; `_tapOffN` counts every resolved tap) so the pause site is the one that normally fires; both exist so a long lesson calibrates before the night.
- The pause-card slider/hint reflect the new value on the next `refreshSettings` (`10412-10419`) with no change to that code.

**Laws.** `calibSilent:0` → byte-identical (the function is not called; `calibApply` refactor must leave the button path's stored ms and cloud payload identical — pin with a vm test on the extracted function). Never fires twice per page life. Never fires with a stored key. The three clamps that already exist for this value (`5630` boot ±(300,400), `10460` slider, `10464` button) stay as they are; the silent path uses the button's.

**Tests.** vm: (1) no key + 12 taps avg +40 ms → offset 40, key written, accumulator zeroed, `_calibSilentDone`; (2) key present → no-op, accumulator untouched; (3) 11 taps → no-op; (4) |avg|=8 ms → no-op AND accumulator intact; (5) avg +900 ms → clamped 320; (6) second call → no-op. Source: `calibSilent(` appears at exactly the two sites, both inside a `CFG.calibSilent` guard. Mutants to construct: reset-accumulator-before-store; clamp bounds swapped; `_userOffsetSec===0` test dropped (cloud override clobbered).

## Parcel B — THE LINK ON THE CARD

**Why.** The night card (`cardCompose`, `7412-7434`) is the thing a friend pastes into a group chat; it carries the mark, the moon, the deal, the sky band, the glyph and the date — and no way back to the game. The share overlay's URL (`linkUrl()`, `11640`: `origin+pathname`, query and hash deliberately stripped) is the right text.

**The sigil is NOT added, and here is why.** A ghost's sigil is `ghostMoonSigil(moonBucket)` (`9181`) — the phase bucket of the night it was recorded, which the card already draws as the moon disc (`phasesDrawDisc`, `7427`). Every player in the same ~3.7-day window wears the same sigil; it identifies a week, not a person, by design (anonymity is structural). A friend who sees "a visitor rides tonight · 🌒" and a card with a waxing crescent can already make the guess the design permits. Nothing more precise may enter the card.

**What.**
- Hoist `linkUrl()` out of the share IIFE into a module-level `shareLinkUrl()`; the share overlay calls it unchanged.
- `cardCompose` gains one line under the date: `cardLinkText()` = `shareLinkUrl()` with protocol stripped and a trailing `/` trimmed (`aim-dojo.vercel.app`), font `Math.round(W*0.020)+'px '+CARD_FONT`, fill `rgba(198,216,246,.30)`, y `H*0.972`, max width `W*0.8`. Under `file:` the line is omitted (a local path is not an invitation). The date line moves nowhere — it stays at `0.945`.
- Knob `CFG.nightCard.link:1`; 0 → `cardCompose` byte-identical (frozen-canvas test: paint both arms into an offscreen canvas stub that records draw calls; assert the call log with `link:0` equals HEAD's).

**Laws.** Zero numbers still (a hostname is not a number; the date-line law at `7373-7374` stands). No token, no query, no identity. `cardFresh()` gating untouched.

## Parcel C — THE COLD LOAD, MEASURED

**Why.** `index.html` is ~1 MB raw with Three r128 and Tone 14 from cdnjs, sky textures behind it. A friend's first impression is the seconds before PLAY lights. `SPEC_PERF_V1.md` already has the goals (G3: critical path ≤ ~200 KB compressed before ENTER) and the parcels (P1 CDN cache, P2 load scheduling, P4 HTML split — briefs exist as `CODEX_PROMPT_PERF_*`). What is missing is the number.

**What.**
- `tools/coldload.mjs` (puppeteer-core, production origin, no `__dbg`): cold cache, two profiles — desktop unthrottled and "friend laptop" (4× CPU slowdown, 10 Mbit / 40 ms RTT). Records: bytes transferred before PLAY is enabled; **T_play** = time until `beginTrainBtn.disabled===false` (`setGateReady`, `11181`); **T_frame** = time from a synthetic PLAY click to the first `requestAnimationFrame` after `state.running`; worst frame in the first 5 s of the lesson. Five runs, median. Output a markdown row for CONTINUATION_PROMPT.
- **Budget (friend profile):** T_play ≤ 4.0 s, T_frame ≤ 1.5 s, bytes-before-PLAY ≤ 1.5 MB. If the budget fails, execute P2 (load scheduling: defer sky textures, planet maps, QR, Supabase client until after the lesson starts) and re-measure; only if still over, P4 (the split — HIGH risk, every contract test greps `index.html`).
- No gameplay change in this parcel; it is a measurement with a decision rule attached.

## Parcel D — THE RELAY SCAN

**Why.** After each friend plays, the way to see their night is to query the relay. Wave 16/17 did it by hand. The relay's read surface is `GET /api/ghosts?lon=<0-23>&n=<1..4>` with `X-Ghost-Token`, ordered by circular bucket distance then recency, excluding the caller's own token (sidereal `ghost_relay.py` `nearby_ghosts`, `426-476`). There is no list endpoint and none is added.

**What.** `tools/relay-scan.mjs` (Node 18+, no deps):
- Mints a THROWAWAY 32-hex scan token per run (so the user's own night is included — the relay excludes only the caller's token). `--token <hex>` opts into a real token (then that night is excluded, as the relay intends). The user's stored token is never read from anywhere by the tool.
- For each `lon` 0..23, sequentially (the relay allows 8 concurrent reads and 120/min per address; 24 sequential GETs is far under both), `n=4`; dedupe by `id`. Prints one row per night: id (first 8), lonBucket, postedAt, artifact `date`, sigil, `dur` s, targets/taps/fires counts, serialized bytes, and a **SMOKE** tag when `bytes` is one of the known smoke sizes (2338, 2000±20) or `dur<50` — a real human night is the row without the tag.
- Documents the cap honestly: the relay returns at most 4 nearest per query, so a bucket holding more than 4 nights shows its 4 most recent; friends in different time zones enumerate fully.
- **LAW: the tool never touches `/api/ghost-mail`.** GET on that path is read-once and would destroy the user's unread mail. Pin with a source test on the tool file (no `ghost-mail` literal).
- `--api <base>` overrides the default `https://sidereal-production.up.railway.app` (the relay does NOT follow `?skyApi`; `ghostRelayUrl` reads the raw `CFG.skyDay.api` literal at `8902-8906` — the tool mirrors that: one fixed base).

## Parcel M — THE LESSON LEAVES NO RECORD

**Why.** `submitDojo` (`11478`) is called unconditionally from the last line of `showPause` (`11628`) and has no `trainMode` gate; `cardSave` (`7328`) does. Graduation (`5826-5838`) resets neither `state.t` nor `state.hits`, so an Esc during the lesson can publish a lesson to Railway `/dojo` and Supabase `aimdojo_dojo`, and every graduated night's `runtime` includes its lesson seconds. Flagged 2026-07-09, never closed.

**What.**
- `submitDojo`: `if(trainMode || state.hits<1) return;` — the trainer publishes nothing and touches neither `_dojoBest` nor `aimdojo.rtmap`.
- A graduation snapshot `_gradSnap={t:state.t, hits:state.hits}` taken in the graduation branch (next to `resetPocketState()`, `5829`) and zeroed in `resetSession` (`11319`). `dojoSession()` (`11437`) reports `dur:Math.round(state.t-_gradSnap.t)` and `kills:(state.hits-_gradSnap.hits)|0`. `state.t` itself is NOT reset mid-run (it feeds spawn scheduling, flash timers and the road; the ghost recorder already solved this the same way with a road clock based at graduation, `9476-9482`). `maxBpm`, `far`, `high`, `streak` stay as they are: legacy/unranked columns, and the trainer's bpm can only be ≤ the night's.
- The `state.hits<1` gate reads the post-graduation count.

**Tests.** Source: the gate literal in `submitDojo`. vm on `dojoSession` with a snapshot: lesson 61 s / 3 hits then night 120 s / 9 hits → `dur 120, kills 9`. Mutant: snapshot taken at `resetSession` instead of graduation (would report the lesson again).

## Parcel N — THE SUITE RUNS ON EVERY PUSH

**Why.** No `.github/`. Today's host-time-zone-dependent oracle (`tests/index-contract.test.js:50`, fixed 2026-09-03 for hosts west of UTC) would have been caught the day it was written. The comment-swallow regression class (`d906ccf`) is exactly what an always-on suite guards.

**What.** `.github/workflows/tests.yml`: on `push` and `pull_request`; `actions/checkout` + `actions/setup-node` (node 22); steps: `node --check` on the five root modules; `node tools/extract-inline.mjs && git diff --exit-code -- tools/` (**the mirror-freshness gate**: an `index.html` edit without regenerated mirrors fails the build, which is the CLAUDE.md law made mechanical); `node --test tests/*.test.js`. Runs on `ubuntu-latest` and `windows-latest` (the second host is what found today's bug). No secrets, no deploy step (Vercel deploys on push independently).

---

# WAVE 20 — THE CHORUS LINE

## Parcel E — THREE SEATS (phase 0d)

**Why.** Wave 15 seats one stranger at `GH_VISITOR_X=-90` (`8849`); the multi-seat refactor already generalized the `_gh*` live registers through `ghostSeatCapture/Install/Clear` (`9161-9179`) and iterates `_ghostSeats` (`9310-9315`); the relay serves up to `n=4`. Wave 13's approved phase 0d asked for ±2 seats; the road stays the middle lane of something larger.

**What.**
- `GH_VISITOR_COUNT` 1→**3** on HIGH, stays **1** on LOW (each seat is a geometry+material family; LOW already omits the deck quad, the wall mesh, and bursts — `9387`, `9428`, `9439-9442` — and gets one stranger only). Seat x positions in fill order: `GH_SEAT_XS=[-90, 180, -180]` (own ghost keeps +90). Spacing stays 90 m by the wave-13 law.
- `_ghostVisitorSeat` → `_ghostVisitorSeats[]` (capture bags, one per accepted stranger); `ghostVisitorAccept` fills the next free x; `_ghostSeats` order: own, then visitors in fill order; `ghostGiftLockSeats` (`9316-9331`) and `ghostSeatRememberRows` already iterate seats — extend, do not duplicate.
- Mail: one `POST /api/ghost-mail` per visitor with catches at `bowFinish` (`6756`), still one attempt each; the relay's ingress law (≤4 batches per target revision, one per sender revision) is satisfied.
- Threshold line generalizes: one visitor → unchanged line; two or three → `TF('ghostVisitorsLine','{n} visitors ride tonight · {sigils}')` with sigils joined by a thin space (EN) / `{n}人の旅人が今夜ならぶ · {sigils}` (JA draft — native review before announcing). Precedence chain (`11453-11465`) unchanged: comeback > mail > visitor(s) > deal.
- **Silhouette line: REDUCED to the honest form.** Any 4th returned ghost (`n=4` requested on HIGH) renders as an avatar-only seat at `±270` — cone, halo, bow replaying its `fires` rows (`9587`), no road, no targets, no beacons, no gifts. Silhouettes represent only real nights; nothing is ever fabricated to look populated (the constitution's line, and the reason the "ghost-filled empty chairs" phrase from wave 13 is retired — empty seats stay empty unless parcel H fills one with YOUR OWN past night).
- Perf: the dispatcher measures the staged reveal with 3 seats + silhouette on HIGH (two seats was the wave-15 worst case). Budget: reveal-open median ≤ +2 ms over wave 18 on the reference machine; if over, `GH_VISITOR_COUNT` HIGH drops to 2 and the number is recorded.

**Laws.** `ghostShare:0` → wave-18 byte-identical (extend the knob matrix). One stranger returned → scene state identical to wave 18 (fixture: seat count 2, visitor x −90). The own seat's build/palette/replay/reveal never changes (wave-15 hard law; the existing fixtures must pass untouched). No lane-colour literal; palettes per seat from each record's `ghostNightSeed` (`9348`).

## Parcel G — THE CHORUS REMEMBERS WHO REACHED BACK (relay + client)

**Why.** `nearby_ghosts` orders by circular lon distance, then `postedAt DESC` (`ghost_relay.py:439-443`). With two friends in one bucket the most recent always wins and the third friend is never met. The relay already records who caught whose notes: `ghost_mail_batch(senderId, targetId, targetToken, rowCount, postedAt)` (`266-274`).

**What — relay (sidereal, deploy FIRST).**
- Selection order becomes: **reached-back first** (candidate's current `id` — or a live alias — appears as `senderId` in `ghost_mail_batch` rows whose `targetToken` = caller token within the 10-day TTL), then **unseen-by-caller first**, then lon distance, then recency. "Unseen" needs one new table `ghost_seen(viewerToken TEXT, ghostToken TEXT, seenAt REAL, PRIMARY KEY(viewerToken, ghostToken))`, upserted on every successful `GET /api/ghosts`, TTL 10 days, purged with the others, `secure_delete` like everything in this DB. It links two anonymous tokens and nothing else; it is deleted with either token's TTL. The privacy line ("no name, email, IP, precise location") is untouched; state a decision comment.
- Each returned ghost gains `reachedBack: true|false` (boolean, absent → false on old clients).
- Tests in `test_ghost_relay.py`: reached-back ordering beats recency; unseen beats seen; a seen ghost returns once every other candidate is seen (rotation, not exclusion); TTL clears `ghost_seen`; the alias path counts; old-shape clients ignore the new field.

**What — client (after the relay is live).**
- `ghostVisitorFetch` (`9271-9277`) validates `reachedBack` as a strict boolean if present; the seat bag stores it.
- Threshold line for a reached-back visitor: `TF('ghostVisitorBack','a visitor who reached back rides tonight · {sigil}')` / JA draft `手をのばしてくれた旅人が今夜ならぶ · {sigil}`. Same precedence slot as the visitor line; if any of the seated visitors reached back, this line replaces the plain visitor line.
- Nothing else reads the field: no gameplay, grading, spawning or RNG consequence.

**Laws.** Deploy order: relay before client. Client with old relay: the field is absent → the plain line (byte-identical to wave 18). `ghostShare:0` → no request, unchanged.

## Parcel H — THE MOON REMEMBERS YOU (your past self by phase)

**Why.** `aimdojo.ghost` holds one slot: last night (`GH_STORE_KEY`, `8840`; finalize `9030-9048`; read `9102-9115`). The card and the Temple ring already think in the eight phase buckets (`moonPhaseBucket`, `6804`). The cheapest new memory the sky can deal is: the last time the moon looked like this, this is how you played.

**⚠ Ruling needed.** Wave 8 locked "tonight-only solo self-ghost". This parcel keeps a per-phase ghost for up to one lunar month (the next same-phase night overwrites it). It ships behind `ghostPhase:1` in this spec because the user said "all of it"; if the wave-8 ruling stands, flip the default to 0 before shipping and the parcel is dormant.

**What.**
- `localStorage['aimdojo.ghostPhase']` = `{v:1, slots:{"<0-7>": artifact}}`, each slot a bare v1 artifact validated by `ghostArtifactValid` (`9060`), written at `ghostRecordFinalize` right after the worthy local night is stored (`9047`): `slots[r.moonBucket]=r` (latest wins — the ghost is ephemeral by constitution; accretion is the sky's job, not the ghost's). Size: ≤8 × 100 KB; the write is wrapped in the same fail-soft try; a quota failure loses the phase copy, never the night.
- At `ghostShareReset`/`ghostSeatReset` time: if `slots[moonPhaseBucket()]` exists AND its `date !== ` the +90 own ghost's date (otherwise it is the same night and stays unseated), it fills the **first empty visitor seat after the strangers** (parcel E's order; with no strangers it sits at −90). It is a seat like any other: own-night palette from its record, veil/reveal law, beacons, gifts (catches land in the normal `_ghostGiftMail`, i.e. mail to yourself — worthless and harmless; simpler than a special case, state the decision).
- Threshold line, lowest precedence among visitor lines: `TF('ghostPhaseLine','the last {sigil} night rides with you')` / JA draft `このまえの{sigil}の夜がとなりを走る`.
- On LOW (one seat) a stranger outranks your past self.

**Laws.** `ghostPhase:0` → wave-18 byte-identical (no key read or written, no seat). Never uploaded; never leaves the browser (the README's "lit sky … live in localStorage only" paragraph gains this key). Strict validation on read; an invalid slot is dropped silently, never repairs itself.

## Parcel F — THE VISITOR, WEIGHED (tuning parcel)

**Why.** The visitor at −90 shares every alpha, scale and lead constant with the own seat (`GH_VIS*` has exactly two members, `8847/8849`); the user's judgement on the −90 peripheral weight is still owed. Gift feel (`GH_GIFT_LEAD=2.6`, `9128`) and the gift LOW cost were flagged for remeasure in wave 14 and never remeasured.

**What.**
- One new per-seat multiplier applied at `ghostSeatInstall` for visitor seats only: `GH_VISITOR_ALPHA=1.0` scaling `GH_AVATAR_*_ALPHA`, `GH_BEACON_ALPHA` and the road/wall material opacities of that seat. Default 1.0 = byte-identical; the user auditions 0.8 and 0.65 (two short nights each).
- Remeasure on a quiet machine (the wave-15 environment law: `pkill` zombie Chromes, load < 5): gift-on vs gift-off LOW median and p90 at a staged reveal (probe kit `mercy-stall-probe.mjs` / `gift-storm.mjs`; regenerate from the §5 harness recipe in CONTINUATION_PROMPT if the scratchpad is gone). Record both numbers; the wave-14 "+8–11 ms" sample is either confirmed (then the catch birds on LOW stay absent — they already are, `9532-9538` writes into a null pool) or retired.
- `GH_GIFT_LEAD`: audition 2.2 and 3.0 with the honest-lock band test as the safety net (a lead shorter than the 1.4 s flight at 72 m/s is the wave-14 trap).

---

# WAVE 21 — THE FELT NIGHT

## Parcel I — THE DOORWAYS ARE EVENTS

**Why.** The enfilade walls sit every bar (`ML_ARCH_EVERY=4`, `1983`; station beats `b0+4k` inside `roadArchFill`, `2695-2705`), and the walls already hear play (`uWallHit/uWallMiss` stamps at `7960`/`8022`, consumed at `2565-2568`). But nothing in gameplay knows when the player passes THROUGH a doorway: the only per-frame quantization is beat-granular (`n0!==_roadBeat0`, `3045-3046`). The user's open item since wave 11: doorway crossings as felt events — bloom and whoosh on bar lines.

**What.**
- A bar latch beside the beat gate in `roadSync` (`3046`): `bar=Math.floor(r/ML_ARCH_EVERY)`; on change → `doorCross(bar)`, once per bar, only when `roadLive()` and `!trainMode && !templeActive`.
- **Bloom (visual).** A third shared stamp `_wallCross={value:-1e9}` in the road clock, borrowed by the wall AND arch materials exactly as `_wallHit` is (`2069`, `2600`). Fragment: a warm-white lift on the chamber just entered — reuse the hit-echo front (`ML_WALL_ECHO_WIDTH`, `ML_WALL_ECHO_SPEED`) but keyed from the doorway plane outward, amplitude `ML_CROSS_LIFT=0.18` over `ML_CROSS_BEATS=1.0`; the arch you just passed brightens by the same envelope through `uBreath`'s existing path (arches take 45 % of breath, `1990/2346` — the cross lift adds to that term, it does not replace it). `reduceMotion` → the stamp is written to `uPulse` time like the echo does (`3056`) and the lift is a still +0.06 for one beat.
- **Whoosh (audio).** A new voice `doorWhoosh` beside `arcWhoosh` (`6004`): triangle, `DOOR_WHOOSH_DB=-26`, one downward sweep 520→140 Hz over `DOOR_WHOOSH_SEC=0.22`, scheduled at `beatSnap()` (`5905`) so it lands on the bar line. **Gated by the tide so the quiet stays the reward:** silent at bars-to-mercy ≥3 (`roadTideAt`, `2079-2093`, `cb` reconstructed as `bar % cyc`), −6 dB at 2 bars out, full at 1 bar out, and the mercy doorway itself gets the sweep plus one `pad` tonic grace note at velocity `CFG.tide.padPeakVel` (`998`) — the door into mercy is the loudest thing the walls ever say. `soundOn` and `toneReady` gates as everywhere.
- Knob `CFG.moonline.doorCross:1`; consts `ML_CROSS_LIFT`, `ML_CROSS_BEATS`, `DOOR_WHOOSH_DB`, `DOOR_WHOOSH_SEC`, `DOOR_WHOOSH_HZ=[520,140]`.

**Laws.** `doorCross:0` → wave-18 byte-identical shaders (extend the frozen-shader fixture; test the switch ALONE — the coupling-blindness pattern has bitten every wave). No RNG, no grading, no spawn consequence; the stamp is a sink like the echo stamps. Lane law untouched (the lift is white). The half-space hazard is audited: the lift must be bounded on the wall's dissolve tail and below the deck.

## Parcel J — THE TIDE ORDERS THE CHALK

**Why.** Chamber pigments come from a seeded 512-bar private walk (`roadWallPalette`, `2071-2078`) keyed on absolute bar index at `2704` — the tide is computed four times on the line above (`2699`) and never consulted for colour. The user's open item: warm→cool toward mercy.

**What.**
- The palette walk is untouched (THE STREAM RULE: the private draws stay byte-identical). At `2704`, after `roadWallPaletteAt(bar)`, apply `tideTint(hex, cb)`: `mix(chalk, ML_TIDE_COOL, k)` with `ML_TIDE_COOL=0x6f91bc` (the powder pigment, already night-corrected) and `k = ML_TIDE_COOL_MAX * smoothstep(0, rise+peak-1, cb)` — 0 at the trough, `ML_TIDE_COOL_MAX=0.45` in the peak bars; the mercy bar is the inverse pane and is not tinted. `_wallNext[k]` uses `cb+1` so the crossfade in the shader stays continuous across the bar line.
- `cb` comes from exposing the cycle-bar position on `_roadTideR` (`2070`; add `.cb`), not from a second modulo.
- The ghost seats' twin palette (`9353`) is NOT tinted: a ghost wears its own night's chalk (wave-13 law), and its tide is not yours.
- Knob `CFG.moonline.tidePalette:1`; 0 → `_wallCol/_wallNext` values byte-identical to wave 18 (fixture over one full 9-bar cycle).

## Parcel K — MOON SENSEI II (one line, once, at the first time)

**Why.** The lesson is locked at seven steps (wave 16, user-locked). The dynamics that make the night — the tide's mercy bar, the drum fill, the holster-to-bow, the first lit star — are all discovered, and the season-2 backlog asked for a secondary stage teaching them. Not a stage: a sentence, each once, ever.

**What.**
- `localStorage['aimdojo.sensei2']` = `{v:1, seen:{mercy:0|1, fill:0|1, bow:0|1, star:0|1}}`, strict validation, accretion-only.
- Four hooks, post-graduation only (`!trainMode && !templeActive`), each firing `showTrainCoach(line, true)` (the slow variant, `11348-11358` sibling) the first time ever and marking `seen`:
  - `mercy` — the first frame `tideMercy` turns true (`6538`): `THE WALL OPENS · MERCY · BREATHE` / JA `壁がひらく · なさけの一小節 · 息をして`.
  - `fill` — the first tank/fill spawn (the `tg.fill16` tag): `A DRUM FILL · STATE IT, DON'T FLURRY` / JA `ドラムフィル · あわてず 言い切る`.
  - `bow` — when the holster timer first passes half its bow threshold (the Bow's own constant), before the Bow begins: `HOLSTER TO BOW · THE NIGHT ENDS ON PURPOSE` / JA `構えを解けば 礼になる · 夜はみずから終わる`.
  - `star` — the first star lit to level 1 (parcel I of wave 3, the bind at drain): `A VOICE CARRIED HOME · THAT STAR IS YOURS NOW` / JA `声がかえった · あの星はもう きみのもの`.
- Lines respect the existing coach surface's one-line law; none overlaps the threshold flash (they fire mid-night, the flash is at the door). JA drafts need native review before announcing to JP players (the SPEC_MOON_CHORUS_UI law).
- Knob `CFG.sensei2:1`; 0 → no key, no line.

## Parcel L — THE TUNING PROTOCOL (document parcel)

The by-ear tuning session has been deferred since season 2. It is a procedure, not code: one knob per evening, two short nights per value, the verdict written in CONTINUATION_PROMPT as `knob: old → new (why)`. The matrix, in order of expected leverage:

| Knob (anchor) | Now | Audition | Feel for |
|---|---|---|---|
| `CFG.tide.riseBars/peakBars` (`998`) | 6 / 2 | 5/2 · 7/3 | does a swell arrive before you want it to end |
| `moonline.breathMax` (`1039`) | 0.45 | 0.35 · 0.6 | the beat felt in the road without strobing |
| `moonline.wallDissolve` | 95 | 80 · 120 | chalk reads as rooms, not fog |
| `GH_GIFT_LEAD` (`9128`) | 2.6 | 2.2 · 3.0 | a flare you can honestly reach |
| `GH_VISITOR_ALPHA` (parcel F) | 1.0 | 0.8 · 0.65 | company, not clutter, at −90 |
| `ML_TIDE_COOL_MAX` (parcel J) | 0.45 | 0.3 · 0.6 | the cool arriving with mercy, not before |
| `DOOR_WHOOSH_DB` (parcel I) | −26 | −30 · −22 | heard on the mercy door, forgotten elsewhere |
| `quietTick` family | as shipped | ± one step | silence as reward, never as absence |

Rule from the wave-10 lesson: never one-variable-at-a-time by feel alone when a perf number is in play — measure four variants.

---

# WAVE 22 — THE SWEEP

## Parcel O — THE DEAD HELPERS

Verified by call-site count on 2026-09-03 (definition line · sites): `avgReaction` (`7930` · 0), `classifyPocket` (`1294` · 0), `showTempleSignArt` (`3835` · 0), `placeTempleSignArt` (`3873` · 0 — its comment says tests may name it: grep `tests/` first and update any that do), `starLitLevel` (`4258` · 0), `showListenGhost` (`4646` · 0), `eighthSec` (`6526` · 0), `timingErrorMs` (`6527` · 0), `setClassName` (`9901` · 0), `liveCount` (`11368` · 0); knobs `CFG.decoyChance` (`1065`) and `CFG.decoyDistMul` (`1087`) with 0 reads (decoy code stays — `tg.kind===2` at `7953` is live, the roll simply never happens; the `:1054`-era comment claiming decoys are revivable is corrected, not defended); the three write-only `tg.lifeBeatsEff` sites (`7821`, `7822`, `7868`) whose comments name a reader `orbRed` that does not exist. **Keep** `pushReaction` (2 sites) and `hideListenGhost` (1 site).

**Laws.** Each deletion is a whole statement on its own line or the line is rewritten by hand — never a mechanical delete on a multi-statement line (memory `aim-dojo-comment-swallow-hazard`; `d906ccf`). Run the comment-swallow contract test after every deletion. Mirrors regenerated LAST. No behaviour change: the suite and the frozen fixtures pass untouched.

## Parcel P — THE STARS DID NOT LOAD (Three.js CDN guard)

**Why.** `three.min.js` (`904`) is a blocking classic script with no `onerror`; the main IIFE (`906-907`) constructs THREE objects at module init, so a blocked or failed CDN leaves a blank page — no greyed PLAY, no line (only Tone is gated: `setGateReady(!!window.Tone)`, `11184`; `showToneBlock`, `11155-11162`).

**What.**
- The script tag gains `onerror="window.__threeFailed=1"`.
- The first statement inside the IIFE: `if(typeof THREE==='undefined'){ threeBlock(); return; }` where `threeBlock()` writes `T('threeFailedHtml','<b>The sky did not load.</b> Check your connection or unblock cdnjs, then reload.')` / JA `<b>星空を読みこめなかった。</b>通信かブロックを確かめて、ページを読みなおしてね。` into `#ovLede` and disables PLAY via the same `setGateReady(false)` shape (defined before the guard, or inlined — the function must not depend on anything past the guard).
- The start card is already in the markup, so the message renders without THREE. Nothing else changes; a normal load is byte-identical past the guard.

**Tests.** Source: the guard is the first statement after the IIFE opens and precedes the first `new THREE.` textually. A vm smoke: evaluate the guard region with `THREE` undefined and a stub `#ovLede` → the string is set and no exception escapes.

---

## Contracts (all waves)

- Every parcel has a flat knob and a byte-identity law at 0; each switch is tested ALONE and in the matrix where it couples (ghostShare × ghostPhase × ghostGift for wave 20; doorCross × tidePalette × wallsOn × mercyInverse for wave 21).
- THE STREAM RULE: no parcel adds, removes or reorders an `rnd()` draw; palette and course seeds are untouched; parcel J tints AFTER the draw.
- One clock: everything wave 20 does rides the road clock (`ghostRoadTime`); nothing new reads `state.t` for ghosts (construct the sneak mutant again).
- Network only at session boundaries, fail-soft, bounded JSON with byte ceilings before validation (the wave-15 reviewer laws); the tool in D and the CI in N never touch mail.
- Every string EN+JA through `T`/`TF`; JA drafts marked for native review.
- Lane colours only via `WASD_HEX`/`_roadLaneCol`; no literal anywhere new.
- Comment-swallow scans after any edit on a dense line; `node tools/extract-inline.mjs` after any `index.html` edit, mirrors committed with it; GitNexus `impact` before touching a symbol and `detect_changes` before every commit; a `--force` re-analyze (`GITNEXUS_MAX_FILE_SIZE=4096`) when the FTS index complains.
- Acceptance for anything touching the ghost topology walks the REAL door at least once: `beginAs(true)` → incantation → graduation → night → bow (the wave-15 lesson: the harness's `trainMode=false` staging bypasses the arming site).

## Playtest questions

Wave 19: does a friend's first night feel on time without them knowing why? Is the card, pasted into a chat, an invitation now? What is T_play on the worst laptop in the room? Wave 20: with three strangers and a silhouette, is the road the middle lane of a chorus line or a crowd? Does "a visitor who reached back" land as the mail it is? Does your past self under the same moon feel like memory or like a stats screen wearing a robe? Wave 21: is the mercy door the loudest thing the walls say, and everything else forgotten? Does the chalk cool toward mercy or just go blue? Do the four Sensei II lines arrive exactly when you would have asked?
