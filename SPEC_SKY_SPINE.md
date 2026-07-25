# The Sky Spine — Redesign Wave 3 (every voice is a star; the chorus is the save file)

**Version:** 1.1 · 2026-07-25 (1.0 body preserved; wave-3 review resolutions are marked "1.1 amendment" in place)
**Branch:** `redesign/moon-chorus` (continues from waves 1-2, both merged; merge to `main` after user playtest)
**Files touched:** `index.html` (+ regenerated `tools/index-inline.mirror.js` per commit). No new assets, no build, no server, no new fixtures — the star data is `fixtures/zodiac_sticks_v1.json`, already shipped and rendered.
**Origin:** 2026-07-24 redesign panel — the judges' #1 synthesis: merge "Every Voice Is a Star" with "The Standing Chorus" into one accretion spine. This is the wave that changes why you return.

---

## 0. Product intent

A landed rescue stops being a transient event. Each Echo now calls from the bearing of a REAL star the game already draws — one of the ~120 zodiac-band stick stars — and returning its voice permanently brightens that star in YOUR sky, in the dojo and the Temple, forever. Every brightened star also contributes a voice to the Standing Chorus: the ambient music of your dojo, playing when you load in, audibly richer for every night you have played. The sky is the save file you see; the chorus is the save file you hear. No counters, no lists, no completion percentages — ever.

## 1. Constitutional rules (from the design panel's judges — violating these kills the wave)

- **The star sets DIRECTION ONLY.** Spawn azimuth comes from a real risen star; distance stays strictly beat-quantized (flight time = k sixteenths) and pitch/elevation stays within the existing spawn-pitch law. The sacred quantization is never bent to fit a star.
- **Star/constellation names NEVER touch the play HUD.** No labels mid-run. (Temple naming is a future wave.)
- **No counters, no fractions, no checklists.** "Lyra 4/6" is forbidden anywhere. The lit sky and the audible chorus are the ONLY ledger. Completability is never surfaced or promised.
- **Accretion is permanent.** Levels only rise. No decay, no upkeep, nothing can be lost. localStorage is the source of truth (Supabase sync = a later wave; leave a comment hook, build nothing).
- **The sky never lies.** Brightening happens at the star's TRUE rendered position, on the existing stick-star draw path. No fabricated glows, no invented stars.
- **Chorus stays out of combat's ears.** Stems are audible ONLY at the start/pause overlay, during mercy bars (the tide bloom), and the Bow's HOLD. During active play they are silent. Hard cap on concurrent stems; deterministic nightly rotation of which lit stars sing.
- **Kill-switches:** `CFG.stars.on` and `CFG.chorus.on` — each `false` restores today's behavior exactly (hot call-sites read the raw boolean first, house style). Waves 1-2 hard constraints (rhythm-safe, trainer/temple mechanics inertness, no new UI/toasts/strings, flat CFG literals, mirror regen per commit, gitnexus impact before edits, tests 133/133) all inherit.

## 2. Existing substrate (read before designing)

- `fixtures/zodiac_sticks_v1.json`: 13 figures, ≤120 stars as `[lon_deg, lat_deg]` approximate J2000 ecliptic; edges index per-figure star lists. Find the loader + renderer in `index.html` (search `zodiac_sticks` / `signArt` / stick draw) — it already converts ecliptic→horizontal per frame for the clocked sky, which is the transform this wave reuses.
- Spawn direction today: `spawnTarget` rolls yaw/pitch around the player (spawnField 'full'), constrained by `spawnMinDeg` from current aim.
- Persistence conventions: `localStorage['aimdojo.*']` reads with try/catch, versioned plain objects.
- Audio: THEME/PENTA arrays, `pad`/`arp`/`bass` voices, `tideBloom` mercy hook (wave 1), Bow HOLD stage (wave 1).

## 3. Parcel H — THE LIT SKY (catalog identity + persistence + rendering)

### Design
- **Identity:** each stick star gets a stable id `"<figureKey>:<starIndex>"` derived from the fixture (no fixture edits).
- **State:** `starChorus = { [id]: level }`, level 1..`stars.levels` (5). Loaded at boot from `localStorage['aimdojo.starChorus']`, saved on change (throttled). Accretion-only: level never decreases; malformed storage → empty (never throws).
- **Rendering:** on the existing stick-star draw path, a recovered star renders brighter/larger by level — scale the existing point/vertex brightness by `1 + level*stars.glowStep`, with a soft warm tint at full level. Visible in BOTH dojo and Temple skies (the Temple is the trophy room; this is sky content, not a run mechanic). `reduceMotion` unaffected (static brightness, no pulsing — do not add pulsing for anyone).
- **Kill-switch:** `stars.on:false` → sticks render exactly as today; storage untouched.

### CFG (flat)
```
stars:{ on:true, levels:5, glowStep:0.35, fullTint:0xffe9c4, saveMs:1500 }
```

### 1.1 amendment — storage is untrusted input, and ids must be catalog-backed

Wave-3 review found the loader would accept any object (arrays included), any version, and any key — so a hand-edited or foreign `aimdojo.starChorus` could seed ids the catalog does not contain, and those phantoms would then be ranked and **sung** by the Parcel J chorus. Clarification, in force from 1.1:

- **The loader is a validator.** Envelope must be a plain non-array object with `v === 1` **exactly** (a future `v:2` is not silently down-read); `lv` must be a plain non-array object. Either check failing = empty collection, silently.
- **Per key:** must match the id grammar `^[A-Za-z0-9_-]{1,24}:(?:0|[1-9][0-9]{0,2})$`. **Per value:** coerced to an integer and clamped to `1..stars.levels`; anything non-finite or `< 1` is dropped. A bad entry is dropped; it does not void the collection.
- **Two-stage validation.** The catalog does not exist at boot, so the loader can only check grammar. `starLitBind` runs the second stage the instant the fixture lands and **drops every id the real catalog does not carry**. This reverses 1.0's "kept, never pruned" note: after bind, no id exists in state that the sky cannot draw, which is what render (H) and chorus (J) both assume. The prune is **memory-only** — it never calls the save path, so a temporarily narrower fixture cannot erase the file on its own.
- **Ids are minted inside the grammar.** `buildZodiacSticks` gives a figure a key only when `f.id` matches `^[A-Za-z0-9_-]{1,24}$`; a figure whose key a reload would reject is drawn but never lightable, instead of lightable tonight and forgotten tomorrow.

### Acceptance
- `stars.on:false` byte-equivalent stick rendering; no storage reads/writes.
- Persistence round-trips; corrupt/missing storage yields empty state silently.
- No per-frame allocations added to the sky draw; brightness applied where the sticks already write vertex data.
- (1.1) A storage payload that is an array, a wrong version, or a bag of unknown ids yields an empty or fully-pruned collection; nothing outside the catalog ever renders or sings.

## 4. Parcel I — STAR-BOUND SPAWNS + THE VOICE FLIES HOME

### Design
- **Spawn binding:** when `stars.on` (post-graduation, free-play, not temple), `spawnTarget` picks the Echo's AZIMUTH from a real star: compute risen stick stars (altitude > `stars.minAltDeg`) via the existing ecliptic→horizontal transform; prefer stars not yet at full level; respect the existing `spawnMinDeg`-from-aim constraint (if the chosen star violates it, pick another; if none qualify, fall back to today's random direction — silent, no seam). Elevation/pitch and DISTANCE laws untouched (direction only). Selection uses `rnd()` freely (free-play only). Store `tg.starId`.
- **Voice return:** on a landed scoring kill of a star-bound Echo, during the NEXT beat gap (never inside an open window): a thin, low-alpha line traces from the burst position toward the star's true current sky position over ~one beat, fades, and the star ticks +1 level (persisted). Reuse an existing line/trail resource — no new material class if avoidable. `reduceMotion`: no flight line; the star simply brightens on the next beat.
- **Multi-kill beats:** volleys can return two voices in one gap — stagger the lines by a sixteenth; both tick.
- **Tank/gold/speed/mover:** all kinds may be star-bound (the star is a bearing, not a kind).
- **Kill-switch:** `stars.on:false` → spawn path byte-identical to today (the fallback IS today's path).

### CFG (extend `stars`)
```
stars:{ ...H keys..., minAltDeg:8, preferUnlit:true, lineAlpha:0.35, lineBeats:1 }
```

### 1.1 amendment — stream purity by construction, and the gap is the law

Three review findings, all of the same shape: the parcel was reaching into machinery that is not its own.

**(a) Spawn stream purity.** 1.0 said "Selection uses `rnd()` freely". That is withdrawn. Rolling the pitch early and drawing the star from `rnd()` shifted the shared spawn stream, so `beatSpawnDist`, the drift velocity, the kind roll and the tank roll all landed on different numbers than the no-stars build — the "fallback IS today's path" guarantee was false. In force from 1.1:
- **The legacy azimuth/pitch roll happens ALWAYS**, in the legacy order and count, before any star is consulted. When a star binds, its azimuth **overrides** the rolled value after the fact; the rolled azimuth is discarded but *consumed*.
- **Star selection consumes ZERO draws from `rnd()`.** It runs on a stream-external source (a counter + integer hash, seeded from the wall clock, sharing state with nothing).
- Net contract: the fallback path is byte-identical to the no-stars build, and a bound spawn differs from it in the **azimuth value only**, on an identical `rnd()` stream.

**(b) The scoring path only queues.** No `starLitGain` may be called from the scoring path, ever — not even on a cap overflow. Returns go into a small pending ring (16, oldest-first); a ring overflow displaces the *oldest* return into a debt list which is granted, silently and without a line, at the next gap. **Ticks are applied only at beat gaps, and always** — even when no visual flight record is free. The line is optional garnish; the gap-timed tick is the law.

**(c) The flight system freezes while a window is open.** 1.0 only hid the meshes, so stagger waits still ran down, flights still aged, launched and retired inside the scoring window. In force from 1.1: while `starWinOpen()` is true, **nothing advances** — no drain, no wait decrement, no aging, no launch, no retire, no tick. All flight-state advancement happens in gap frames exclusively, so the sixteenth of stagger between two same-beat returns is a real sixteenth of gap time. Visibility is still managed, but as a single set-write at each freeze boundary rather than a per-frame per-flight write (a line already in the air is a scene object the renderer keeps drawing). Accepted consequence: at a fast tempo the gap is a small slice of the beat, so a line takes several beats of wall clock to cross `lineBeats` of gap time. The level still lands, and every teardown grants the debt, the ring and the air before dropping them.

### Acceptance
- Beat-quantized distance, open-window timing, grading, scoring: untouched (verify by diff read — the star contributes ONLY the azimuth used where the old random azimuth was used).
- Trainer and Temple: no star binding, no flights.
- Flight lines never draw during any open window; only in beat gaps.
- Fallback (no risen qualifying star) is silent and seamless.
- (1.1) `rnd()` is called the same number of times, in the same order, whether or not a star binds.
- (1.1) No `starLitGain` call is reachable from the scoring path; a 20-kill volley loses zero levels with the line cap saturated.

## 5. Parcel J — THE STANDING CHORUS (the save file you hear)

### Design
- **Stems:** each recovered star (level ≥ 1) can sing: a soft sustained voice on the existing `pad`/`arp` infrastructure — pitch mapped from the star's figure + index into the active THEME's PENTA (octave spread by level: higher level = an added octave shimmer at most). NO new synth if `pad` + one existing voice can carry it; if one dedicated shared PolySynth is genuinely needed, it is the single sanctioned addition (justify in the CFG comment, keep it ≤ `chorus.maxStems` polyphony).
- **Tonight's ensemble:** a deterministic subset of lit stars sized ≤ `chorus.maxStems` (8), rotated by local date (e.g. hash(date + id) sort) — so a 40-star sky sings a different octet each night. Preference: risen stars first (the chorus you hear is overhead — the sky and the sound agree).
- **When it sings:** (1) the start/pause overlay (menu ambience — this is the "boot chorus": one stem fades in per second, richer with history); (2) mercy bars — stems swell with the existing `tideBloom`; (3) the Bow's HOLD — the chorus holds under the Mandala. NOWHERE else. During active play the stems are hard-silent (gain 0, not just quiet).
- **A new voice joins:** when a star first reaches level 1 mid-run, its stem is added to the ensemble pool immediately — the player hears it for the first time in the next mercy bar (or the Bow): growth is heard within the same session it happened.
- **Kill-switch:** `chorus.on:false` → no stems, menu/mercy/Bow audio exactly as today.

### CFG (flat)
```
chorus:{ on:true, maxStems:8, stemVel:0.10, menuFadeSec:1.0, mercyVelMul:1.6, risenFirst:true }
```

### 1.1 amendment — the lifecycle, not just the call sites

Wave-3 review found four defects that share one root: the parcel stated its guarantees as properties of *where it is called from* and left the *lifetime* of a moment unowned. Clarifications, in force from 1.1:

- **The mercy gate hard-closes at the mercy→rise boundary.** 1.0 gave every moment `CHORUS_TAIL_SEC` (2.5 s) of slack past its stated length so the stems' own release would not be chopped. For the mercy bar that slack lands squarely inside the next swell: the chord is struck with a length of one bar, so its release *begins* where the rise begins, and up to 2.5 s of chorus was audible under live combat. "Hard-silent during active combat" is literal — **zero audible chorus energy once the rise's first beat sounds**. The tide's existing mercy→rise latch in `onGrid` (the same one that steps the BPM — no second clock) now ramps the chorus bus to silence over ≤120 ms and cancels the pending tail outright. The tail slack survives for the overlay and the Bow, which are the only places it was ever the player's.
- **Polyphony is EXACTLY `chorus.maxStems`.** 1.0 set `maxPolyphony = maxStems*2` as "release-tail headroom for the one handover the game has". That headroom is not headroom, it is the sixteen-stem pile the cap exists to forbid: a handover put a fresh ensemble on top of eight still-releasing ones and all sixteen sounded. The cap is now the stated number. **Consequence the implementation must own:** Tone's `PolySynth` does not voice-steal — past `maxPolyphony` it *drops* the note, and a released voice does not rejoin the pool until its oscillator stops one full release later. A hard cap therefore only works if a replacing moment takes the pool back first (a short borrowed release), and waits for it before striking. A scheduled moment never waits — the mercy downbeat outranks the chorus. The audible cost is a fraction of a second between an outgoing and an incoming ensemble, on the overlay and the Bow only; that is the accepted artifact.
- **A moment that is already singing what it is asked for does nothing.** The overlay is re-entered constantly (tab return, Temple exit, ESC, pause). Re-picking the identical ensemble and re-striking it was both an audible swallow and the main producer of handovers. When a *held* moment's requested ensemble is unchanged and still sounding, the call is a **no-op**. Stated-length moments (mercy, Bow) always re-strike.
- **The boot chorus sings from the first user gesture the browser permits.** 1.0's "boot chorus" could never play on the initial start overlay: the only caller of the audio init was PLAY, so before PLAY there was no graph, and the instant PLAY built one it entered the run and hushed. No autoplay policy anywhere lets a page sing untouched, so the honest contract is not "at load" but **"at the first gesture"** — one pointerdown/keydown while the start card is up builds the graph (the existing init path, callable without entering the run) and walks tonight's ensemble in. If that first gesture *is* the PLAY activation, the run proceeds exactly as today and that visit has no menu chorus. Pause/Bow/menu-return keep their existing sing calls.
- **Nothing is allocated inside the audio scheduler.** The chorus voice is built where the rest of the audio graph is built, so a mercy downbeat only ever *attacks* pre-built voices; the nightly date salt is computed once per session at the main-thread moments (overlay, Bow, first gesture) and read from cache by the pick.

### Acceptance
- Zero audible change during active combat (outside mercy/Bow) with any collection size.
- Menu ambience with 0 recovered stars = exactly today's silence/theme behavior.
- Stem count never exceeds `maxStems`; ensemble choice is deterministic for a given date + collection.
- Quiet Tick, target tones, and all combat audio unaffected.
- (1.1) The rise's first beat sounds into a chorus bus already at zero; no mercy tail is audible in the swell.
- (1.1) No sequence of moments can put more than `maxStems` stems in the air, and no handover is silent.
- (1.1) Re-entering the pause card with an unchanged collection neither swallows nor re-attacks the chorus.
- (1.1) A returning player with a lit sky hears the chorus on the start overlay, before PLAY; `chorus.on:false` arms no listener and starts no audio before PLAY.
- (1.1) No `new` of a synth or a `Date` occurs inside a Transport callback.

## 6. Build order & review

Sequential H → I → J (one commit each, Sonnet verify between, gitnexus impact before edits), then Codex read-only review of the wave-3 diff, fix rounds to GREEN, push branch for user playtest. Feel values are first guesses; the user tunes by ear/eye.

## 7. Playtest questions (post-build)

- H: do brightened stars read at a glance under the real sky without breaking its honesty? (`glowStep`)
- I: does the voice-flight in the beat gap feel like ceremony or clutter? (`lineAlpha`, `lineBeats`) Does star-bearing spawning change how the field feels (bearings cluster along the ecliptic band — good "the sky is calling" or too directional?)
- J: load the game the morning after a session — does the boot chorus land as "my history is singing"? Is `maxStems:8` rich or muddy?
- The big one: after two evenings, do you feel the pull the panel promised — "my sky will be one voice brighter tonight"?
