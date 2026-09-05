# Codex prompt — THE DOORS REMEMBER (the ghost lanes go; chalk marks on the doorways replace them) · plus THE ORB IS A PING (the chip hum, second try)

**Working directory:** `C:/Users/rober/Downloads/Projects/aim-dojo` (branch `main`, HEAD `ad8a9a9` = live). Never touch `state/`. **One local commit per parcel, in order. Do not push. Do not run `gitnexus analyze`. Do not edit `CLAUDE.md`/`AGENTS.md`/`CONTINUATION_PROMPT.md`.** Re-read every site before editing — line numbers drift; grep by symbol name.

Hard editing rules are unchanged from `CODEX_PROMPT_DRY_CHALK_AND_THE_CHIP.md` §Hard rules (no code after `//`, regenerate mirrors last with `node tools/extract-inline.mjs`, house style, flat CFG knobs, `node --test tests/*.test.js` green — **385 at baseline** — swallow scans 0, Tone 14.8.49 pinned, no worklets, no assets).

---

## Why (the user's verdicts, 2026-09-04, on the live build)

- The chip works: "I did the chip thing and it sounds a lot better." Lead + dry + bass are the sound now (`?chip=lead,dry,bass`).
- The chip hum (`?chip=…,hums`) "sounds like a mosquito." A 12.5 % pulse at gain 0.32 with the old tremolo LFO and a detuned gold twin IS a mosquito. Second try below.
- The ghost lanes: "in low res the other ghost lanes are unintelligible… there's no way I'll ever shoot one of the orbs of a ghost, it's simply too far, too extra… the whole ghost thing feels pretty messy now." They have never knowingly seen a stranger's ghost, only their own. They are ready to lose their own past-night road as well. They do NOT want to hear other players (chaotic). They want the chalk tick.

**The replacement, in one breath.** Other players are no longer a second road ninety metres away. **The doorways remember.** Every door you pass carries chalk marks: your own last night's mark for that door and up to three strangers' marks, each a short vertical chalk stroke offset left or right by how early or late that shot landed. A stranger is a sigil and a tick, nothing more. Reaching back is **leaving a mark**: at the mercy door, a WASD tap on the beat leaves your mark, which travels to the strangers whose chalk you passed tonight through the relay's existing mail shape. Marks received appear on your doors tomorrow in the sender's hue with one threshold line. No lanes, no replays, no flares, no gift shots, no returning stars, no silhouettes, no visitor sound.

Laws that stand: zen (no UI, no counters, no toasts beyond the existing one-line threshold surface, EN+JA for any new line); LEAD + RHYTHM untouched (marks write nothing into grading, streak, spawning, difficulty, or any RNG stream — the wave-14 isolation law); anonymity is structural (a stranger is `ghostMoonSigil(moonBucket)` and a palette hue seeded from their artifact's date/moonBucket, never an id); competition ephemeral, accretion permanent (marks are tonight-only on the doors; the relay keeps its 10-day TTL); the relay contract is unchanged and deployed (`POST /api/ghost`, `GET /api/ghosts` with boolean `reachedBack`, `POST /api/ghost-mail {toId, catches:[[roadT,lane]…]}` ≤64 rows, one batch per sender→target revision, **4 batches per target revision**, `GET /api/ghost-mail` read-once — never GET it in a test against production).

---

## Parcel H2 — THE ORB IS A PING (before the ghost work; small)

**Today (chip arm of A4):** `pulseWave(ctx)` 12.5 % duty, `humGain 0.32`, and the rest of the hum graph untouched: a 2–4 Hz sine LFO tremolo into the gain, a send into the shared convolver (`makeIR`, the only reverb in the game), gold's detuned twin `o2` at `f·1.004`, mover's slow pitch modulation, the 16th gate.

**Change (CHIP_HUMS):** the NES form of an orb call is a bare gated pulse blip.
- Duty from `CFG.chip.humDuty` (default **0.5** — a round Game Boy square, not the thin 12.5 %), band-limited as today.
- **No tremolo LFO** on the chip arm (do not construct the LFO oscillator/gain; the 16th gate is the only movement).
- **No reverb send** on the chip arm (do not connect the send; the convolver stays for the off arm).
- **No detuned gold twin** on the chip arm; gold keeps its octave-down pitch law (the "old voice" reads from register, not beating).
- Register: `CFG.chip.humOctave` (default **−1**: one octave below today's pentatonic pick; apply to `pickPenta()`'s result and to every later retune so `singDegree`/kind laws still hold relative to it — pitch = k is preserved as an interval structure, only transposed).
- Gain `CFG.chip.humGain` default **0.22** (re-tune by ear).
- Mover's vibrato and SPEED's flutter stay (NES games did vibrato by pitch; it is not a mosquito).
- **Audition overrides, boot-only, no UI:** `?humDuty=0.5&humOct=-1&humGain=0.22` parsed beside `?chip=` in `resolveChip`'s neighbourhood into the same CFG fields (clamp duty to [0.05,0.5], octave to {−2,−1,0}, gain to [0.05,0.6]).

**Tests:** extend `tests/chip-hums.test.js`: chip arm constructs no LFO nodes, connects no send, no `o2`; off arm graph byte-identical to the `589c3db` fixture (existing test); `humOctave` transposition is applied consistently at pick and at retune (a `vm` test on the extracted hum functions with a fake context); URL override parsing and clamps.

---

## Parcel C0 — READ-ONLY: the inventory and the stranger mystery (no commit; findings in the final message)

1. Map every symbol that exists only for seats/lanes/gifts/returning stars: `GH_SEAT_X`/`GH_VISITOR_X` (±90, silhouettes ±270), `ghostSeatCapture/Install/Clear`, `ghostSeatBuild`, `_ghostSeats`/`_ghostVisitorSeats`, `ghostVisitorAccept`, `ghostSilhouetteAccept`, `ghostGiftLockSeats`, `ghostTargetPosition`, the beacon/flare state, the gift shot tag and connection grading, returning stars, ghost walls/underside/deck/bursts/halos, the `GH_*_TARGET_MAX/BURST_MAX` budgets, Parcel H's dormant `ghostPhase` slots (moot without lanes — delete), and their tests (`tests/night-ghosts.test.js`, `tests/the-gift.test.js`, `tests/the-visitor.test.js`, parts of `tests/doorways.test.js`). Note what must SURVIVE: token mint, `lonBucket`, upload at `ghostRecordFinalize`, `ghostVisitorFetch` + artifact validation + strict-boolean `reachedBack`, the read-once mail fetch, the threshold-line precedence (comeback > mail > visitor > deal), `ghostMoonSigil`, the night card, `tools/relay-scan.mjs`, the `ghostShare` knob's network semantics.
2. **Why has the user never seen a stranger?** Read-only diagnosis with `node tools/relay-scan.mjs` (three nights, lon 8) and a fresh-profile headful load of the production site watching the `GET /api/ghosts` request/response and the seat count (never GET `/api/ghost-mail`; never fire). Candidates: all three relay nights are the user's own tokens from different browsers; the fetch fails silently (CORS, timeout, validation reject); LOW seated one visitor that the user could not tell from their own ghost. Report the evidence; do not fix.

---

## Parcel C1 — THE LANES GO (deletion first; the intermediate state is "no ghosts drawn at all")

Delete the seat/lane/gift/returning-star/silhouette machinery and its tests. Keep the survivors from C0 intact and byte-identical (upload, fetch, validation, mail read, sigil, threshold precedence, night card, `ghostShare:0` → no network). After C1, `ghostShare:1` fetches strangers and reads mail exactly as before, and the artifacts sit in memory (`_ghostVisitors[]`, own last night `_ghostOwn`) with nothing drawn. Remove the ghost-only LOW/WEAK budgets (`GH_TARGET_MAX`, `GH_BURST_MAX`, `GH_VISITOR_COUNT` stays as the fetch/seat count = 3 everywhere, `GH_VISITOR_FETCH_COUNT` 4). Threshold lines survive with their current text.

The revival path is git (`ad8a9a9` and the SPEC_THE_VISITOR / SPEC_THE_GIFT / SPEC_THE_INVITATION lineage) — say so in one comment at the ghost section head. Tests: delete the tests of deleted mechanisms; keep and adapt fetch/validation/mail/threshold tests; add a source scan pinning that no `GH_SEAT_X`/`GH_VISITOR_X`/gift/returning-star symbol remains.

## Parcel C2 — YOUR OWN MARK (the doors remember last night)

- **Which door gets which shot: the k-th door remembers the k-th judged arrival.** Doors are the wall slots that already advance with the road (`ML_WALL_N` slots, the doorway events of Parcel I — `doorCross`, `_wallCross`). Number doors from the run's start (`doorIndex`). For an artifact, take its `targets` rows in order (row shape `[spawnT, kind, idx, arrivalT, outcome, hitT]` — verify against the validator), so door k shows arrival k. Tempo-independent, deterministic, no replay clock.
- **The mark:** on the door's fragment shader (`roadWallFragmentShader` and the LOW arm — build the chalk in BOTH arms; the LOW arm is the authored look), one short vertical chalk stroke: height ≈ 0.14 of the door, width ≈ 3 buffer pixels at 0.5 DPR (author for the crunch: constant-width, no derivatives on LOW), lateral offset `x = clamp((hitT − arrivalT) / GH_MARK_WINDOW, −1, 1) · GH_MARK_SPAN` from the door's centreline (early = left, late = right; `GH_MARK_WINDOW = 0.25` beat, `GH_MARK_SPAN = 0.55` of the half-width — both flat consts); `outcome=0` (expired) = a short horizontal dash at the sill instead. Own mark colour = chalk white at the wall's existing chalk alpha. Marks ride the door (same uniforms path as the wall slot update; per-slot `vec4` uniform `uMark[slot] = (x, kind, hue, alpha)` per mark source, up to 4 sources: own + 3 strangers).
- Source: the own last-night artifact already stored locally at `ghostRecordFinalize` (tonight-only law: last night only; nothing older).
- Knob `CFG.ghostChalk:1`; `0` → no marks computed, no uniforms written, shader branch compiled out (build-time boolean).
- Tests: `vm` test of `markFor(artifact, doorIndex)` (k-th row → offset/kind; missing row → no mark; clamps; expired → dash); source scan that the shader carries the mark branch on both arms behind the boolean; frozen-shader fixture unchanged with `ghostChalk:0`.

## Parcel C3 — STRANGERS' MARKS

- The up-to-three validated strangers from `ghostVisitorFetch` become mark sources 1–3, hue seeded from each artifact's date/moonBucket (the existing prior-night palette law), drawn beside the own mark (fixed lateral order: own centre-left, strangers to the right of it in fetch order; overlapping offsets simply overlap — chalk on chalk).
- `reachedBack === true` strangers keep their precedence in the fetch order and their mark is drawn **doubled** (two strokes, 2 px apart) — the only visual acknowledgement, no text change.
- Threshold line text updates (TF keys, EN + JA, JA marked for native review): `ghostVisitorLine` → EN "a stranger's chalk is on the doors tonight · {sigil}" / JA "今夜の戸口には旅人のしるしがある · {sigil}"; the reached-back form → EN "a stranger who reached back has chalked the doors · {sigil}" / JA "手をのばしてくれた旅人が戸口にしるしを残した · {sigil}"; plural forms keep today's structure.
- Tests: mark sources from a fixture of three artifacts; reachedBack doubling; line text and precedence unchanged in order.

## Parcel C4 — LEAVING A MARK (mail out)

- During mercy the walls are down and the mercy inverse pane is the one complete door. A **WASD tap on the beat while the mercy door is on screen** (reuse the existing tap grading: on-beat per `wasdBeatsHeard`'s window; a tap is never punished) records ONE mark row `[roadT, lane]` (road clock time, lane 0–3 = W/A/S/D) — at most one per mercy, the first on-beat tap wins; the tap's normal sound and effect happen exactly as today (isolation law: writes nothing into grading/streak/spawn/RNG).
- The mercy door shows your own mark appear at the tap (same chalk stroke, lateral slot by lane: W/A/S/D → four fixed positions across the pane) — the only feedback.
- At session end (the existing fail-soft mail boundary) POST one batch `{toId, catches:[[roadT,lane]]}` to EACH stranger whose chalk was shown tonight (up to three POSTs; the relay's per-target cooldown and one-batch-per-revision laws make retries pointless; 429/404 fail-soft silently). Never to your own night.
- Knob rides `ghostChalk`; `ghostShare:0` → no POST.
- Tests: tap capture (on-beat only, first wins, mercy only); batch shape per stranger; no POST when no tap or no strangers; isolation source scan (the mark path never touches `state.streak`, `pushEvent`, spawn, RNG).

## Parcel C5 — MARKS RECEIVED (mail in)

- The read-once mail fetch at session start (existing) now yields `[roadT, lane, fromSig]` rows. Each becomes a mark on tonight's doors: the row's `roadT` selects the door whose road-clock span contains it (or the nearest door), lateral slot by lane, hue from `fromSig` (the sender's moonBucket, the sigil law), drawn a little brighter than stranger marks (they were left FOR you).
- Threshold line (replaces "N of your notes were caught"): EN "someone left a mark at your door · {sigil}" / JA "だれかがあなたの戸口にしるしを残した · {sigil}" (JA for native review); with several senders, the plural form lists sigils as today's plural lines do. Precedence unchanged (comeback > mail > visitor > deal).
- Spent mail is tonight-only (the read-once contract; a crash loses it — stated in a comment as before).
- Tests: rows → door/slot/hue mapping; line text; a fixture of two senders; nothing persists past the session.

---

## Verification (after every parcel)

```bash
node --test tests/*.test.js            # green; report the count (it will DROP at C1 — say by how much and which files went)
node tools/extract-inline.mjs          # mirrors, LAST step
# both swallow scans (see the chip prompt) → 0 and 0
node --check aim-dojo-main.js
git status --short
```

Boot smokes on a local server (`python -m http.server 8931`): `/`, `/?chip=lead,dry,bass,hums`, `/?humDuty=0.5&humOct=-1`, `/?hi` — console clean, PLAY lights. A headful staged check that a door carries a mark when `_ghostOwn` is a fixture artifact (call the mark installer directly; fire nothing). Never GET the mail endpoint or POST anything against production during smokes; use a fixture or a scratch stub for the relay.

## Final message format

C0 findings first (inventory table + the stranger diagnosis with evidence). Then per parcel: line ranges, knobs and defaults, tests added/removed (with the suite count after each), JA strings flagged for review, deviations and why. Then the verification output. Then concerns, plainly — especially anything in C1 that could not be removed without touching a survivor, and any door/shot numbering edge (a night with fewer arrivals than doors; a run with more doors than the artifact has rows → later doors carry no mark, by design).
