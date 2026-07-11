# Fable prompt — coherent sky (Parcel D)

Copy everything below the line into Fable. Working directory: **aim-dojo** repo.

---

## Mission

Turn the personal planetarium into a **coherent sky**: zodiac stick-figure constellations (13 incl. Ophiuchus), **☉/☽ as the luminaries**, planets on a **true ecliptic band**, **Δ always on**, **tasteful any-hit seals**, **theatre lighting** for sunsets while **positions stay real**. Skill game untouched.

You own **visual craft** within hard rails. Do not implement Swiss Ephemeris. Do not ship personal natal files.

## Required reading (first)

1. **Plan (source of truth):** `SPEC_PERSONAL_PLANETARIUM_V2.md`  
   Read §0–8, §10 Parcel D, §12 acceptance. **Plan wins** on conflict.

2. **Identity / process:** `CONTINUATION_PROMPT.md` (arrival timing, zen, LOW, single-file, syntax-check).

3. **v1 context (already shipped):** sky modes, `buildChartSky`, skypack loader, hybrid lessons from user feedback (disc ≠ glyph, faint spaghetti arcs).

4. **Pack:** prefer  
   `/mnt/c/Users/rober/Downloads/Projects/sidereal/data/fixtures/skypack_bobby_sample.json`  
   when v2 lands; until then compute Δ client-side from v1 `movers` + `natal_ghosts` shortest arc. Accept `schema_version` 1 or 2.

## Scope — Parcel D

| ID | Deliverable |
|----|-------------|
| D1 | Hybrid clock: theatre lighting ≠ planet motion |
| D2 | ☉/☽ replace art discs; real lon; glow/weight parity |
| D3 | True ecliptic band shared by bodies + sticks |
| D4 | Zodiac-13 sticks JSON + render; no procedural stars in clocked* |
| D5 | Δ always-on soft labels (shortest arc) |
| D6 | Any-hit seals, max 8, tightness styling |
| D7 | Day atmosphere ~30% weight; glyphs center stage |
| D8 | LOW / reduceMotion / decorative isolation |
| D9 | Dotted arcs optional, **default off** |

## Hard rails

1. Aesthetic only — no spawn/fire/groove/score/leaderboard reads of chart data.  
2. Floor stays grid/checker — not a chart.  
3. `decorative` default preserves public feel (legacy discs + random stars OK).  
4. **Positions never lie** — planets/☉/☽/Δ use real pack epoch longitudes; theatre only spins atmosphere / dayPhase lighting.  
5. Privacy — no upload of skypack; gitignore personal `skypack.json`.  
6. Single-file product + small static fixtures OK.  
7. Sacred rhythm loop untouched.  
8. Zen: no toast spam; no big new settings panel required (URL/CFG fine).

## Creative latitude

You **may** invent:

- Exact stick-figure star lists (plausible ecliptic-band geometry; Ophiuchus required).
- Glyph glow recipes so ☉/☽ feel as good as old discs.
- Type size/placement for `Δ42°` so it doesn’t fight the reticle.
- Seal placement (prefer at transit body).
- How theatre sun altitude tints the dome while ☉ sits elsewhere on the band (document in a short code comment).
- LOW simplifications (fewer sticks, no Δ text, top-3 seals only, etc.).

You **may not**:

- Accelerate planets with `dayCycleSec`.
- Draw 44 full arcs by default.
- Put labels/words on constellations (no “Sagittarius” text required).
- Couple aspects to difficulty.
- Block the boot path on localhost API.

## Technical guidance

### Hybrid clock (D1)

- Keep something like accelerated `dayPhase` for **dome/fog/floor dayAmt** in `clocked` / `clocked_chart` (theatre default).
- Place chart bodies from pack longitudes on ecliptic band; update only if pack epoch changes — **not** each theatre frame from dayPhase.
- Freeze: pin theatre phase; chart stays at pack epoch (or freeze epoch if you later add live refresh — not required).

### Luminaries (D2)

- Hide or stop drawing old sun/moon **discs** in clocked* modes when glyphs active.
- ☉/☽ sprites ~former sun/moon scale; additive glow OK.
- Directional light may follow **theatre** sun height for sunset drama; comment that glyph position is real.

### True band (D3)

- Replace fixed-elevation “chart cylinder” mental model with ecliptic great-circle (or thin strip) shared by sticks + planets.
- `sign_band` may still dimly mark Midpoint sectors without text.

### Sticks (D4)

- New fixture e.g. `fixtures/zodiac_sticks_v1.json`: 13 figures, stars + edges, caps on counts.
- Include **ophiuchus**.
- In `clocked` / `clocked_chart`: do not use random procedural starfield (or opacity 0 / skip build).
- `decorative`: leave legacy stars.

### Delta (D5)

```js
// shortest arc degrees [0,180]
function shortestArcDeg(a,b){ let d=Math.abs(((a-b)%360+360)%360); return d>180?360-d:d; }
```

- Prefer pack `same_body_delta` if present; else compute from mover/ghost lons.
- Always on when chart layer active; soft alpha; canvas text or tiny sprite.

### Seals (D6)

- Use `resonance_rank` if present, else sort `resonances` by `orb/orb_limit`.
- Show at most 8; alpha by tightness; pulse only top few if `!reduceMotion`.
- Aspect glyphs: ☌ ☍ △ □ ⚹.

### Day ~30% (D7)

- Reduce daytime dome/haze dominance so sticks + glyphs read; target “atmosphere is scenery.”
- Don’t force chart opacity to 0 at day.

### Loader note

- Fix or extend `?skyApi` to pass `natal_id` **only if you touch that path**; drop-in `skypack.json` remains primary for personal use.
- Accept schema 1 and 2.

### Verify

```bash
F=index.html
o=$(grep -nE "^<script>$" "$F" | tail -1 | cut -d: -f1)
c=$(grep -nE "^</script>$" "$F" | tail -1 | cut -d: -f1)
sed -n "$((o+1)),$((c-1))p" "$F" > /tmp/g.js && node --check /tmp/g.js
```

Grep proof: chart identifiers absent from spawn/fire/groove/score paths.

Do **not** push unless user asks; leave commit-ready.

## Definition of done

- [ ] D1–D8 done (D9 optional) per plan  
- [ ] Theatre sunsets exist; planets don’t carousel with them  
- [ ] ☉ is the sun, ☽ is the moon (no double sun)  
- [ ] 13 sticks incl. Ophiuchus; no random stars in clocked*  
- [ ] Δ always on; seals capped and tasteful  
- [ ] Day quieter (~30% sky weight)  
- [ ] decorative default OK; `node --check` clean  

## Suggested order

D1 → D2 → D3 → D4 → D5 → D6 → D7 → D8 → (D9)

## Collaboration

- Codex Parcel C adds `same_body_delta` / `resonance_rank`; you can ship Δ math client-side first.
- Stick catalog is yours (public), not natal privacy-sensitive.

**Begin:** read `SPEC_PERSONAL_PLANETARIUM_V2.md`, then implement D1.
