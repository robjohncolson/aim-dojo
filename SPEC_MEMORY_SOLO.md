# The Memory Layer, Solo Half — Redesign Wave 5a (the world keeps your place)

**Version:** 1.1 · 2026-07-26 (wave-5a review round: H1 + M2–M5, marked **1.1 amendment** in place)
**Branch:** `redesign/moon-chorus` (waves 1-4 merged; merge to `main` after user playtest)
**Files touched:** `index.html` (+ regenerated `tools/index-inline.mirror.part<N>.js` per commit). No assets, no build, **no server** — wave 5b (ghost duets, class chorus wall, chorus lending) is the Supabase half and is NOT this spec.
**Origin:** 2026-07-24 redesign panel, memory/social layer, judges' constitutional rule: **competition ephemeral, accretion permanent** — and for this half: nothing here competes at all; everything accretes.

---

## 0. Parcels

1. **M — PHASES WITNESSED**: each night played stamps that night's real moon phase in a Temple ring; all eight stamps complete the lunar ring, once, forever.
2. **N — THE SKY REMEMBERS YOU**: returning after nights away is a reunion, not a penance — one warm threshold line, zero guilt mechanics.
3. **O — NIGHT CARDS**: a session leaves a beautiful, zero-number artifact — tonight's sky with your rescues as stars plus your timing glyph — offered quietly from the overlay, shareable as an image.

## 1. Hard constraints

- **No guilt, no loss, no counts.** Stamps only accumulate; gaps in the calendar are ordinary dark sky; the comeback line never says "missed"; the card carries no numeric score. "Lyra 4/6"-style fractions remain forbidden everywhere.
- **The text budget, now with priorities (enforced in code, one line per boundary, total):**
  - **Threshold:** comeback line (parcel N, first session after a gap) **>** deal line (wave 4). One or the other, never both.
  - **Bow:** eighth-stamp line (parcel M, exactly once ever) **>** Sensei diagnosis (wave 4) **>** sky fact (wave 1).
- **Storage is untrusted input** (wave-3/4 lessons): versioned envelopes, strict type gates (the `senseiNum` pattern), silent corrupt-degradation, accretion-only writers, throttled saves.
- **1.1 amendment (M5) — one date authority.** `YYYY-MM-DD` is a *shape*, not a date: the shape regex admits `2026-02-31` and `2026-13-01`. Every date this layer reads from storage goes through **`realCivilDate(s)`** — shape test, then a round-trip through the same local-midnight `Date` the gap math uses, demanding year/month/day back unchanged. Used by all three envelopes (`aimdojo.phases` stamps, `aimdojo.lastNight`, `aimdojo.nightcard`). A failure drops that record (or, for the ring, that one bucket's stamp) silently — a day nobody could have lived is not a night anybody played.
- **1.1 amendment (H1) — post-graduation is judged at the arrival, not at the write.** Any per-hit consumer that is post-graduation-only must read the mode **latched at the top of `gradeRhythmHit`** (`wasTrain`), never live `trainMode`: the scoring hit that completes trainer phase 2 flips `trainMode` false *inside* the same call (via `noteTrainOrb` → `setTrainPhase(3)`), so a live read would let the graduating **lesson** stamp `lastNight`, the phase ring and the Bow's ledger (and through the ledger, the Night Card's stored hits and Sensei's own persisted file). The graduating orb is a trainer orb for the whole of its own grading; the next hit of the now-graduated run stamps normally.
- **Kill-switches:** `CFG.phases.on`, `CFG.remember.on`, `CFG.nightCard.on` — each `false` restores today's behavior exactly (raw-boolean-first; zero storage traffic when off).
- **Surfaces:** the Temple is the only home of the phase ring; the Night Card button joins the EXISTING overlay chrome (beside records/share, same visual language) — no new overlays, no toasts beyond the budget above, no HUD.
- All inherited constraints: post-graduation only, trainer/Temple mechanics inert, rhythm-safe, flat CFG literals with decision comments, full JA coverage for every new string (story voice), mirror parts regenerated per commit, gitnexus impact before edits, tests 133/133.

## 2. Parcel M — PHASES WITNESSED

### Design
- **Stamping:** a session "counts" when a post-graduation run records ≥ 1 scoring hit (the `_bowHits` ledger is the witness — a run you actually played, however briefly). At that run's end (Bow OR any other exit path — stamp at the moment the first scoring hit lands, it is simpler and equally honest), stamp today's phase bucket (REUSE wave 4's elongation→8-bucket function — one phase authority, never two).
- **State:** `localStorage['aimdojo.phases'] = {v:1, st:{"0".."7": "YYYY-MM-DD" first-stamp date}}` — accretion-only, strict envelope, silent degradation.
- **Display (Temple only):** a small ring of eight moon-phase discs drawn into the existing Temple panel chrome near the records plaque — unstamped discs are faint outlines, stamped discs render their actual phase shape in moonlight tint. No labels, no counts, no interaction. Drawn once on temple entry (not per-frame).
- **Completion (once, ever):** when the eighth distinct phase stamps, set a completion flag; that night's Bow line is the one-time line — EN: "The eighth night. The Moon has watched them all." (JA in-voice) — and from then on the Temple ring renders complete with a single continuous circle behind the discs. No further mechanics; the ring is the reward. (The Full Night / Earth-turn belongs to trainer graduation and is NOT reused here.)

### CFG (flat)
```
phases:{ on:true }
```

### Acceptance
- `phases.on:false` → zero storage traffic, no ring drawn, Bow priority chain skips the eighth-stamp line.
- A second session the same night re-stamps nothing (same bucket, same date — idempotent).
- The ring renders identically for a player who stamped over 8 days or 8 months.

## 3. Parcel N — THE SKY REMEMBERS YOU

### Design
- **Detection:** `localStorage['aimdojo.lastNight'] = {v:1, d:"YYYY-MM-DD"}` written once per played day (same "counts" rule as parcel M). At the threshold of the first post-graduation run of a day, if the previous `d` is ≥ `remember.gapDays` (3) days ago, this session's threshold line is the comeback line instead of the deal line.
- **The line:** warm, specific, zero guilt: EN template "『{n} nights turned. {star} held your seat.』" where `{n}` is the gap count (a warmth-number, not a score) and `{star}` is the proper name of one of the player's lit stars — the zodiac figures have anchor-star names in lore (Aldebaran, Regulus, Spica, Antares); if the player's lit set includes an anchor figure use its anchor name, else fall back to the figure's constellation name ("the Bull held your seat"), else (no lit stars) a starless variant ("The dojo kept your place."). JA equivalents, story voice. NOTE: this is the ONLY place a star name is ever spoken outside the Temple — it is a greeting at the threshold, not a HUD label mid-run; spec'd here as a deliberate, judge-consistent exception (the sky-spine rule barred names during PLAY).
- **Never:** "you missed", streak language, red anything, or a second line (the deal still applies mechanically that night, unnamed).

### CFG (flat)
```
remember:{ on:true, gapDays:3 }
```

### Acceptance
- `remember.on:false` → no storage traffic, threshold always the deal line (wave-4 behavior).
- Playing daily never triggers it; the gap math uses local civil dates (the same calendar the deal uses).
- Corrupt/missing `lastNight` = no comeback line (treated as a fresh player, silently).

### 1.1 amendment (M3) — "once per played day", not "once per page life"
The write latch is the **stamped civil date** (`_rememberStampedDay`), not a boolean. A page-lifetime boolean meant a tab left open across local midnight never recorded the new night, so `lastNight` could lag a day that was genuinely played and later fabricate a comeback out of it. The witness re-fires whenever today's date differs from the latch — exactly once per played **day**, tab lifetime irrelevant. (Parcel M's `_phasesRun` is a *per-run* latch reset by `resetSession`, so it does not share the pattern and is unchanged; its accretion-only write is idempotent across a rollover by construction.)

## 4. Parcel O — NIGHT CARDS

### Design
- **Capture:** at each Bow, persist a compact last-night summary: `localStorage['aimdojo.nightcard'] = {v:1, d:"YYYY-MM-DD", phase, rule, hits:[[errMs,k]...capped 60], stars:[ids newly brightened tonight]}` — overwritten nightly (the card is ephemeral by design; the SKY is the permanent record).
- **Offer:** after a Bow completes, the start/pause overlay shows one small button in the existing chrome row (records/share language): "✦ NIGHT CARD" (JA too). It appears only when a summary from TODAY exists. No toast announces it.
- **The card (canvas-rendered on demand):** a tall dark card composing: (1) tonight's sky band — the zodiac stick figures with the player's lit stars brightened and tonight's newly-lit stars haloed, drawn from the same fixture data (honest positions, simplified flat projection is fine for art); (2) the night's Mandala glyph (REUSE `bowDrawMandala`'s drawing logic against the stored hits — one glyph authority); (3) the phase disc and the night's rule name as the only text, plus the date. **No numbers anywhere** (no hit counts, no BPM, no accuracy). Moon Chorus visual language (moonlight monochrome + the ✦).
- **Share:** two existing-pattern actions on the card view: copy-to-clipboard (canvas `toBlob` → ClipboardItem, with graceful fallback) and download PNG. The card view itself lives inside the existing overlay panel system (same slide-in the records board uses — no new overlay class).

### CFG (flat)
```
nightCard:{ on:true, maxDots:60, w:720, h:1080 }
```

### Acceptance
- `nightCard.on:false` → no capture, no button, zero storage traffic.
- The button never appears without a same-day summary; yesterday's card is gone (the sky kept what mattered).

### 1.1 amendment (M2) — every card door re-validates the date
The same-day test used to live only in the offer, so a button or a card view left open **across local midnight** stayed live: clickable, exportable, or painting nothing into a wrapper that stayed on screen. One shared **`cardFresh()`** helper is now called at all four entry points — `cardOpen` (refuses, and hides the button), `cardPaint` (**closes** the view rather than leaving a blank wrapper), `cardCopy` and `cardDownload` (re-check before exporting — `cardDownload` is also the async landing of `cardCopy`'s `toBlob`, where midnight can turn between click and blob). A stale record takes the button and the view down together (`cardStale()`).

### 1.1 amendment (M4) — the whole card envelope is strict
`cardLoad` was lenient in three ways at once: a missing or foreign `hits`/`stars` coerced to empty and **still offered a card**, fractional `phase`/`rule`/`k` were truncated into range, and wild `errMs`/`k` were clamped. Half-trust is worse than no trust (the `senseiLoad` law). Now **any** field failing rejects the whole record, silently: `v` exact; `d` a real civil date (M5); `phase`/`rule` integers in `[-1, 7]` through the strict `cardInt` gate (`-1` is this build's own "the sky named nothing"); `hb` a finite number in `[0, 10000]`; `hits` an `Array` of length ≤ `maxDots` of exact `[errMs, k]` pairs (`errMs` a finite number within ±5000, `k` an integer in `[0, 999]`); `stars` an `Array` of length ≤ `maxDots` of catalog-grammar (`STAR_ID_RE`) id strings. **A record this build wrote always passes** — note the `k` floor is **0**, not 1, because `bowNote` legitimately writes `k:0` for an unquantized (cube-root-fallback) arrival.
- The card renders correctly with 0 newly-lit stars, with reduceMotion (static, it's a still image anyway), and offline.
- Clipboard failure degrades to download; download failure leaves the view intact (no thrown errors to the console path the tests watch).

## 5. Build order & review

Sequential M → N → O (one commit each, Sonnet verify between, gitnexus impact before edits), then Codex read-only review of the wave-5a diff, fix rounds to GREEN, push branch for user playtest.

## 6. Playtest questions (post-build)

- M: does the Temple ring read instantly as "nights I've witnessed" without a single word? Does the second-ever session stamping a new phase feel like quiet progress?
- N: stay away three days (or hand-edit `aimdojo.lastNight` back) — does the comeback line land warm or hokey?
- O: would you actually send someone your Night Card? What's missing from it — and does anything on it secretly read as a score?
- The 5b gate: after living with 5a, do you want the social half (duets, class wall, lending) — and should it target your classroom for the fall term?
