# Personal Planetarium v2 — Coherent Sky

**Status:** approved direction (2026-07-11), **not implemented**  
**Supersedes for next work:** `SPEC_PERSONAL_PLANETARIUM.md` (v1 Parcel A/B shipped; this plan is the coherence pass)  
**Repos:** Moon Chorus (`aim-dojo`) + true-sidereal desk (`sidereal`)  
**Canonical path:** `aim-dojo/SPEC_PERSONAL_PLANETARIUM_V2.md`  
**Sidereal pointer:** `sidereal/SPEC_PERSONAL_PLANETARIUM_V2.md`

---

## 0. Why v2

v1 proved the pipe (skypack + modes + belt glyphs) but **felt wrong in play**:

- Art sun/moon disc ≠ ☉/☽ glyphs (two coordinate systems).
- Natal ghosts reused the same glyphs as movers → “wrong sun.”
- Random procedural stars ≠ constellations; no Ophiuchus stick figure.
- Transit relations existed in data but were faint spaghetti or LOW-culled.
- Lighting clock and pack epoch / body positions were not one honest story.

v2 makes **one sky language**: constellation skeleton, planets glued to **real** geometry, **theatre** earth-spin for gameplay light, Δ + tasteful seals, glyphs *are* the luminaries.

---

## 1. Product intent (unchanged rails)

| Layer | Role |
|--------|------|
| **Moon Chorus** | Pure skill — rhythm, aim, Echoes, World Drum. **Unchanged.** |
| **Sky layer** | Pure aesthetic — coherent personal planetarium. |
| **Floor** | Night grid / day checker only. **No chart on the ground.** |

**Non-goals (still)**

- No weather-as-difficulty DNA.
- No predictions / medical / financial claims.
- No natal on leaderboards, share URLs, Supabase, multiplayer.
- No Swiss Ephemeris in the browser.
- No blocking the rhythm loop for astronomy.
- No full-sky myth imagery or wordy constellation labels (stick figures only).

---

## 2. Locked design decisions (user 2026-07-11)

| # | Decision |
|---|----------|
| 1 | **Constellations:** zodiac **ecliptic-band first**, all **13 Midpoint signs incl. Ophiuchus**. Stars + connecting lines only; no pictures, no words. |
| 2a | Each planet shows **Δ** = difference **now vs natal (same body)**. |
| 2b | Δ = **shortest arc** in degrees (display e.g. `42°` or `Δ42°`). |
| 2c | If angle is **significant** (major aspect in orb), show **aspect glyph** ☌ ☍ △ □ ⚹. |
| 3 | **☉ replaces art sun disc** (same visual weight / glow role); **☽ replaces art moon** at night. |
| 4 | **Hybrid clock:** **planets + constellations + Δ + seals = real epoch**. **Earth rotation / sunrise–sunset lighting = theatre (accelerated)** by default in play so users see full sky / nocturnal chart side, not only daytime planets. |
| 5 | **Day sky ~30% opacity contribution** — atmosphere is scenery; **glyphs center stage**. |
| 6 | Projection: **true ecliptic band** on the dome (not a flat decorative cylinder at fixed elev that ignores the sun path). |
| 7 | Skypack may gain fields; client may also derive Δ from mover−ghost lons. |
| 8 | Hierarchy: sticks always · luminaries as bodies · outer glyphs · Δ always on (soft) · seals for significant · dotted arcs optional/later. |
| 9 | Build order S1→S7 as in §8. |
| 10 | **Δ always on** (soft). **Significant hits = any transit→natal** (not same-body only), **tasteful** (top-N, orb-sorted, alpha by tightness). **Theatre lighting default for play.** **Constellations = ecliptic-band only first.** |

---

## 3. Hybrid clock model (critical)

```
┌─────────────────────────────────────────────────────────┐
│ REAL EPOCH (truth)                                        │
│  wall clock / freeze / skypack epoch_utc                  │
│  → planet longitudes, constellation frame, Δ, seals       │
│  → ☉ and ☽ sky positions                                  │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ THEATRE SPIN (feel) — default in play                     │
│  accelerated dayPhase / dayCycleSec-like driver             │
│  → sky dome blue/haze, fog, floor day-night crossfade     │
│  → “which way is up for lighting” may track theatre sun   │
│    altitude for sunsets OR sample brightness from theatre │
│    while ☉ glyph stays on REAL ecliptic position          │
└─────────────────────────────────────────────────────────┘
```

**Invariant:** *Lights may perform; positions never lie.*

- Theatre must **not** drag planet glyphs around the ecliptic at `dayCycleSec` speed.
- Optional later mode `skyTime=natural`: theatre off — lighting also from real solar altitude (study). Not required for v2 ship if theatre default is solid.
- Sky freeze: freeze **theatre phase** and/or **real epoch** together when frozen (document choice: freeze both so sunset pause + chart pause match player expectation).

---

## 4. Projection: `ecliptic_band_v2`

Replace conceptual `ecliptic_dome_v1` fixed-elevation belt with:

- Ecliptic as a **true great-circle band** (or thin strip) on the celestial sphere in the scene.
- Zodiac stick-figure stars projected onto / near that band (band-only catalog in v2).
- Body position: longitude → point on ecliptic (+ optional small lat for moon later; v2 may set lat=0 for all).
- ☉/☽ sit **on** that band at real longitudes (from pack or live).
- Midpoint **sign_band** arcs still available for faint sector emphasis (no text).

Skypack field: `"projection": "ecliptic_band_v2"` (builder may still emit v1 fields for back-compat during transition; consumer prefers v2).

---

## 5. Constellations (ecliptic-band only first)

### 5.1 Content

- One stick figure per Midpoint zodiac id: aries … ophiuchus … pisces (13).
- Each: list of stars `{ lon_j2000 or ra/dec, optional lat }` + edges `[[i,j],…]`.
- Render: small additive points + thin `Line` segments; alpha low; no labels.

### 5.2 Source / ownership

- **Static JSON in aim-dojo** (public astronomy geometry, not natal): e.g. `fixtures/zodiac_sticks_v1.json`.
- Positions should be **consistent with Midpoint ecliptic frame** as far as practical (document approximation if stars are tropical/IAU converted roughly — prefer J2000 ecliptic lon/lat).
- Ophiuchus required and equal visual weight to Sagittarius.
- Procedural random starfield **discarded in `clocked` / `clocked_chart`** (and any new chart-facing modes). `decorative` may keep old random stars + art discs for public default.

### 5.3 Performance

- LOW: fewer stars per figure or lines only for sun-sign + neighbors; never blow draw calls.
- Cap total stick stars (e.g. ≤120) and edges (e.g. ≤80) in schema.

---

## 6. Planets, Δ, seals

### 6.1 Bodies

| Body | Render |
|------|--------|
| Sun | **☉ glyph** replaces disc; scale/glow ≈ former sun; drives or co-drives “sun brightness” but **position = real lon** |
| Moon | **☽ glyph** replaces disc; night-weighted opacity; position = real lon |
| Others | Glyphs on ecliptic band, smaller than luminaries |

Natal: optional **very dim** same-body ghost **or** omit full second ☉ — Δ carries birth offset. If ghosts remain, they must not match luminary scale (dots/rings, not second sun).

### 6.2 Delta (always on, soft)

For each mover id that has a natal ghost:

- `delta_deg = shortest_arc(mover.lon_j2000, natal.lon_j2000)` ∈ [0, 180]
- Display near glyph: `Δ42°` (ASCII/small canvas text), soft alpha, always on when chart layer active (user preference).
- Client may compute if pack omits; pack may include `same_body_delta[]` for tests.

### 6.3 Significant seals (any-hit, tasteful)

- Source: skypack `resonances[]` (transit body → **any** natal point).
- **Tasteful rules (hard):**
  1. Sort by `orb / orb_limit` ascending (tightest first).
  2. Show at most **`SEAL_MAX = 8`** (tunable CFG).
  3. Optionally require `orb <= 0.75 * orb_limit` to drop weak hits.
  4. Alpha scales with tightness; only top 2–3 may pulse (`!reduceMotion`).
  5. Seal glyph at planet (transit body) or midpoint of optional arc — prefer **at transit body** to reduce clutter.
- Same-body major aspects appear naturally inside any-hit when present; no separate system required.

### 6.4 Dotted arcs (optional, default off)

- `CFG.chartDottedArcs` or freeze-only: dotted line transit→natal for seals in the top K (K≤3).
- Default **off** to avoid busy sky; implement as easy flag if cheap, else defer.

---

## 7. Day atmosphere ~30%

- Daytime sky dome / haze / blue should read as **~30% visual weight** vs night (glyphs + sticks dominate).
- Chart elements: reduce aggressive “melt to zero by day”; keep sticks + ☉ + Δ readable in theatre daytime.
- Floor day checker can still fade for arena readability — floor is not the chart.

Exact uniforms are craft: target **glyphs center stage**, atmosphere secondary.

---

## 8. Modes (v2 mapping)

Keep URL key `aimdojo.skyMode` / `?sky=`:

| Mode | Lighting | Stars | Chart (Δ, seals, 13 sticks) | ☉/☽ |
|------|----------|-------|------------------------------|-----|
| `decorative` | Accelerated art (v1) | Random procedural | Off | Art discs (legacy) |
| `clocked` | **Theatre** default | Zodiac sticks only (no natal) | Sticks only; no Δ/seals | Glyph luminaries on **real** sun/moon lon if pack or live sun available; else theatre-only fallback documented |
| `clocked_chart` | **Theatre** default | Zodiac sticks | Full personal layer | Glyph luminaries @ real lon + Δ + seals |

**Pack load** for `clocked_chart` unchanged channels: `?skypack=` → `skypack.json` → `?skyApi` (fix natal_id in v2 if touching API client) → mock sample with announcement.

Privacy rules unchanged.

---

## 9. Skypack contract delta (`skypack_v2` additive)

Prefer **additive** fields; do not break v1 readers mid-migration.

```json
{
  "schema_version": 2,
  "type": "skypack",
  "projection": "ecliptic_band_v2",
  "epoch_utc": "...",
  "privacy": "local_only",
  "sign_band": [ "...v1..." ],
  "movers": [ "...v1..." ],
  "natal_ghosts": [ "...v1..." ],
  "resonances": [ "...v1..." ],
  "same_body_delta": [
    { "id": "sun", "delta_deg": 137.1, "mover_lon_j2000": 109.0, "natal_lon_j2000": 247.0 }
  ],
  "resonance_rank": [
    { "transit_body": "pluto", "natal_point": "moon", "aspect_id": "trine", "aspect_glyph": "△", "orb": 0.32, "orb_limit": 8.0, "rank": 1 }
  ]
}
```

| Field | Owner | Notes |
|-------|--------|------|
| `schema_version: 2` | Codex | Builder emits 2 when deltas present |
| `same_body_delta[]` | Codex | Shortest arc [0,180]; all bodies with both mover+ghost |
| `resonance_rank[]` | Codex optional | Pre-sorted tightest-first convenience; client may sort `resonances` itself |
| `projection` | Codex | `ecliptic_band_v2` |
| Constellation sticks | **Fable static file** | Not inside personal skypack (public geometry) |

CLI/API: regenerate bobby fixture at fixed epoch; tests for Δ math and sort stability.

---

## 10. Work parcels

### Parcel C — Codex (sidereal) — literal, contract-first

**Repo:** `sidereal`  
**Prompt:** `sidereal/CODEX_PROMPT_SKYPACK_V2.md`

| ID | Task | Done when |
|----|------|-----------|
| C1 | Shortest-arc helper + `same_body_delta` on build | Unit tests vs known lon pairs |
| C2 | Emit `schema_version` 2, `projection: ecliptic_band_v2` | Fixture + tests |
| C3 | Optional `resonance_rank` (orb-sorted, stable tie-break) | Deterministic tests |
| C4 | Regenerate `data/fixtures/skypack_bobby_sample.json` | Checked in |
| C5 | CLI/API still work; README note for v2 fields | Smoke |
| C6 | Keep v1 fields populated for back-compat | Old consumer can ignore new keys |

**Must not:** edit aim-dojo; put constellation star catalogs in sidereal unless shared math only; essays in pack; weaken privacy.

### Parcel D — Fable (aim-dojo) — visual craft within rails

**Repo:** `aim-dojo`  
**Prompt:** `aim-dojo/FABLE_PROMPT_COHERENT_SKY.md`

| ID | Task | Done when |
|----|------|-----------|
| D1 | Theatre lighting vs real body positions (hybrid clock invariant) | Planets don’t accelerate with sunset |
| D2 | ☉/☽ replace discs; glow/size parity; real lon placement | No competing disc+glyph sun |
| D3 | True ecliptic band projection | Band + bodies share path |
| D4 | Zodiac-13 stick catalog + renderer; drop procedural stars in clocked* | Ophiuchus present |
| D5 | Δ always-on soft labels (shortest arc) | Readable, non-blocking |
| D6 | Any-hit seals tasteful (top 8, tightness alpha) | Not spaghetti |
| D7 | Day atmosphere ~30% weight; glyphs dominate | Day still playable |
| D8 | LOW / reduceMotion / decorative isolation | Default strangers OK |
| D9 | Optional dotted arcs flag default off | Easy or skip |

**Must not:** floor chart; difficulty DNA; sacred loop edits; push natal packs; block boot on API; ship personal `skypack.json`.

### Parcel E — Integration (human or either after C+D)

| ID | Task |
|----|------|
| E1 | Local: real bobby pack + `?sky=clocked_chart` visual pass |
| E2 | Confirm theatre sunset while ☉ stays on real lon |
| E3 | Confirm Δ for sun ≈ shortest arc(mover, ghost) from fixture |
| E4 | Vercel: decorative default unchanged; chart uses mock sticks + sample |

---

## 11. Dependency graph

```
C1–C3 (skypack v2 fields) ──► C4 fixture ──► C5–C6
         │
         │  (Fable can mock Δ client-side from v1 lons in parallel)
         ▼
D1 hybrid clock ──► D2 ☉☽ glyphs ──► D3 true band ──► D4 sticks
                                              │
                                              ▼
                                    D5 Δ ──► D6 seals ──► D7 day 30% ──► D8/D9

C* ∥ D1–D4 early; D5–D6 prefer C4 or client-computed Δ
E* after D7 + C4
```

---

## 12. Acceptance checklist

- [ ] `decorative` default unchanged for public feel.
- [ ] Theatre lighting can show full day/night cycle in a session.
- [ ] Planet / ☉ / ☽ positions follow **real** pack/epoch longitudes, not `dayCycleSec`.
- [ ] No second full-size sun disc beside ☉ in `clocked_chart`.
- [ ] 13 zodiac stick figures incl. Ophiuchus; no word labels required.
- [ ] Procedural random stars off in `clocked` / `clocked_chart`.
- [ ] Δ always visible (soft) for bodies with natal counterparts; shortest arc.
- [ ] At most 8 any-hit seals; tightest preferred; no 44-arc spaghetti by default.
- [ ] Day sky atmospheric weight ~30%; glyphs readable.
- [ ] Floor not a chart; no gameplay coupling; privacy intact.
- [ ] `node --check` clean; skypack tests green; fixture regenerated.

---

## 13. Out of scope (later)

- Full-sky non-zodiac constellations.
- True local alt/az horizon (lat/lon).
- Synastry multiplayer.
- Default-on dotted arcs.
- Live multi-minute pack refresh (nice-to-have; freeze label of epoch is enough for v2).
- Natural lighting mode polish.

---

## 14. Agent prompt index

| Agent | File |
|-------|------|
| **Codex** | `sidereal/CODEX_PROMPT_SKYPACK_V2.md` |
| **Fable** | `aim-dojo/FABLE_PROMPT_COHERENT_SKY.md` |

**This document wins** over prompts if they conflict. v1 SPEC remains historical for shipped Parcel A/B behavior.
