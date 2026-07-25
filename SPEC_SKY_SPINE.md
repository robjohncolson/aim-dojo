# The Sky Spine — Redesign Wave 3 (every voice is a star; the chorus is the save file)

**Version:** 1.0 · 2026-07-25
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

### Acceptance
- `stars.on:false` byte-equivalent stick rendering; no storage reads/writes.
- Persistence round-trips; corrupt/missing storage yields empty state silently.
- No per-frame allocations added to the sky draw; brightness applied where the sticks already write vertex data.

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

### Acceptance
- Beat-quantized distance, open-window timing, grading, scoring: untouched (verify by diff read — the star contributes ONLY the azimuth used where the old random azimuth was used).
- Trainer and Temple: no star binding, no flights.
- Flight lines never draw during any open window; only in beat gaps.
- Fallback (no risen qualifying star) is silent and seamless.

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

### Acceptance
- Zero audible change during active combat (outside mercy/Bow) with any collection size.
- Menu ambience with 0 recovered stars = exactly today's silence/theme behavior.
- Stem count never exceeds `maxStems`; ensemble choice is deterministic for a given date + collection.
- Quiet Tick, target tones, and all combat audio unaffected.

## 6. Build order & review

Sequential H → I → J (one commit each, Sonnet verify between, gitnexus impact before edits), then Codex read-only review of the wave-3 diff, fix rounds to GREEN, push branch for user playtest. Feel values are first guesses; the user tunes by ear/eye.

## 7. Playtest questions (post-build)

- H: do brightened stars read at a glance under the real sky without breaking its honesty? (`glowStep`)
- I: does the voice-flight in the beat gap feel like ceremony or clutter? (`lineAlpha`, `lineBeats`) Does star-bearing spawning change how the field feels (bearings cluster along the ecliptic band — good "the sky is calling" or too directional?)
- J: load the game the morning after a session — does the boot chorus land as "my history is singing"? Is `maxStems:8` rich or muddy?
- The big one: after two evenings, do you feel the pull the panel promised — "my sky will be one voice brighter tonight"?
