# The Visitor — Wave 15 (phase 0c client: a stranger's night takes the other seat)

**Version:** 1.0 · 2026-08-22
**Origin:** the chorus design, user-approved end to end. The Ghost Relay is DEPLOYED (sidereal main `17e46db` → Railway): anonymous token upsert, longitude-bucket fetch, read-once mail, sigil-only identity. This wave is the client half: your nights go up, a stranger's night comes down into the seat at −90, your gifts reach them, and their catches of YOUR dropped notes arrive in your next session.
**Files touched:** `index.html` (+ regenerated mirrors). Relay API base = the existing `CFG.skyDay.api` host.
**Follows:** Wave 14 (`ca6348d`). The gift/ghost machinery is law; this wave GENERALIZES it over seats without changing the own-ghost seat's rendering one byte.

## 0. What ships, in one breath

Behind one flat knob (`ghostShare:1`), a finished worthy night also uploads to the relay under a random 32-hex token minted once into localStorage; at every session reset the client asks the relay for one nearby night (longitude bucket derived from the TIMEZONE ONLY — never geolocation) and seats it as **the visitor** at `GH_VISITOR_X = −90`: same veiled-choir reveal, same beacon law, its own night's true-seeded ghost-pale chalk, and a moon-sigil identity (its `moonBucket` as a phase glyph — never a name). Your gift machinery works on its flares exactly as on your own ghost's; catches on the visitor batch to its mailbox at session end. At session start, your own mail is fetched read-once: the threshold says **"N of your notes were caught · 🌒"**, and each caught note returns during the night as a shooting star arriving on your road at the very beat where you dropped it.

## 1. Parcel T — THE TOKEN AND THE BUCKET

- `GH_TOKEN` minted once (crypto-random 32 hex, `localStorage['aimdojo.ghostToken']`); regenerate only if absent/malformed. It is a bearer credential: it appears ONLY in the `X-Ghost-Token` request header (the relay's contract) — never in URLs, never in any artifact, never rendered.
- `lonBucket` derived from `Intl` timezone offset only (`bucket = ((round(−offsetMinutes/60) + 36) % 24)` — implementer verifies the mapping against the relay's 0–23 law with a table test). Geolocation is NEVER read for this — a decision comment states it. No other identity of any kind is sent.

## 2. Parcel U — THE UPLOAD

- On successful `ghostRecordFinalize` (a worthy night just stored locally), fire-and-forget `POST /api/ghost` `{token, lonBucket, artifact}` — the exact local artifact, no more. Fail-soft absolutely: no toast, no retry storm (one attempt; one quiet retry after 30 s), never blocks or delays the bow, never touches the frame path. The relay 413/422/429 outcomes are silently accepted (the local night is the real one; the relay is a courtesy copy).

## 3. Parcel V — THE VISITOR SEAT

- **The multi-seat refactor**: the singleton `_ghost*` seat state generalizes to per-seat structures (own seat at `GH_SEAT_X=+90`, visitor at `GH_VISITOR_X=−90`). THE HARD LAW: the own-ghost seat's build, palette, replay, reveal, beacon, and draw behaviour stay **byte-identical** — the existing wave-13/14 fixtures and the eight-combo matrix must pass untouched, and the refactor adds a fixture asserting own-seat scene state equality with `ghostShare:0`.
- At session reset (after `ghostSeatReset`), fetch `GET /api/ghosts?lon=<bucket>&n=1` with the token header; timeout ~4 s; ANY failure → no visitor, silently. A returned artifact is validated with the client's own `ghostArtifactValid` before one byte of it is used — the server is not trusted.
- The visitor renders exactly as a ghost seat renders (veil, reveal by MY uK authority, beacon always, LOW arm, reduceMotion arm) with its palette seeded from ITS artifact's date/moonBucket (the wave-13 prior-night law). Its replay clock is its own recording's, aligned to my session start.
- **Sigil identity**: the visitor's moonBucket renders as a moon-phase glyph — in the threshold line ("a visitor rides tonight · 🌘") and nowhere else this wave. Threshold precedence stays one line: comeback > mail > visitor > deal.
- Gifts generalize: the flare lock scans BOTH seats' giftable rows (nearest-to-aim wins; real targets still outrank all charity); a catch on a visitor flare appends to a visitor mail ledger. `GH_GIFT_SPEED`, the honest lock, the road-clock flight — all shared machinery, zero duplication.

## 4. Parcel M2 — THE MAIL, BOTH WAYS

- Session end (same fail-soft boundary as upload): if visitor catches exist, ONE `POST /api/ghost-mail` `{token, toId, catches}` batch (the server's one-batch-per-revision ingress law makes retries pointless — one attempt only).
- Session start: `GET /api/ghost-mail` read-once. If catches arrive: threshold line "N of your notes were caught · <sigil>" (TF-localized EN+JA), and each `[roadT, lane]` schedules a **returning star**: at that road-clock beat of the new session (mod the session's length), a single pooled shooting-star streak arrives on MY road in that lane's colour (derived from `WASD_COL`), visual only, capped (`GH_RETURN_MAX=16`, drop-extras), reduceMotion → a standing glint. Nothing reads back into gameplay.
- The mail fetched is spent: it exists this session only (the relay already cleared it — read-once is the contract; a crash loses mail and that is accepted ephemerality, stated in a comment).

## 5. Contracts

- `ghostShare:0` → wave-14 byte-identical: no token mint, no network call of any kind, no visitor structures allocated, no mail, no returning stars — extend the knob matrix (now ×2 over the eight combos where meaningful; at minimum ghostShare alone and with ghostGift/ghostSeat/ghostRecord). Construct the network-call-at-share:0 mutant and the token-in-URL mutant.
- All network strictly OUTSIDE the frame path (reset/finalize boundaries only), fail-soft, with the 30 s single-retry law for upload only. One clock (road clock; the wave-14 lesson is fresh — construct the state.t sneak mutant again). Isolation: visitor/mail/returning stars write nothing into grading, streak, difficulty, spawning, RNG. Lane law via `WASD_COL` only. Named `GH_*` consts for every number. Comment-swallow re-scans on touched dense lines. Mirrors LAST. No gitnexus CLI (dispatcher owns impact).
- Perf: dispatcher measures visitor-on/off at the staged reveal (two seats revealed is the new worst case); LOW arm identical to the own seat's.

## 6. Playtest questions

Does a stranger's pale night beside you feel like company or clutter (the −90 side is new peripheral weight)? Does "N of your notes were caught" land as the mail it is? Do the returning stars read as answers arriving, and is 16 the right cap? And does the seat pair (you at +90's ghost, them at −90) make the road feel like the middle lane of something larger — the chorus line beginning?
