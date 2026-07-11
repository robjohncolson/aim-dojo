# Personal Planetarium — Implementation Plan (v1, shipped)

**Status:** Parcel A/B shipped (2026-07-11).  
**Next work:** see **`SPEC_PERSONAL_PLANETARIUM_V2.md`** (coherent sky — constellations, hybrid clock, Δ, ☉=sun).  
**Repos:** Moon Chorus (`aim-dojo`) + true-sidereal desk (`sidereal`)  
**Canonical path (v1 historical):** `aim-dojo/SPEC_PERSONAL_PLANETARIUM.md`  
**Sidereal pointer:** `sidereal/SPEC_PERSONAL_PLANETARIUM.md`

---

## 1. Product intent

| Layer | Role |
|--------|------|
| **Moon Chorus** | Pure skill game — rhythm, aim, Echoes, World Drum. **Unchanged.** |
| **Sky layer** | Pure aesthetic — real clock + optional natal/transit glyphs. |
| **Floor** | Keep night grid / day checker. **No natal chart on the ground.** |

**Product shape:** personal planetarium *above* the dojo. You train under a real (or clocked) sky; your chart appears only as faint sky glyphs and aspect seals.

**Explicit non-goals**

- No weather-as-difficulty DNA (no spawn bias, no BPM, no glow-window changes from aspects).
- No predictive or medical copy in-game.
- No natal wheel / houses painted on the floor.
- No blocking or slowing the rhythm loop for astronomy.
- No natal data on leaderboards, share URLs, Supabase, or multiplayer payloads (v1).
- No synastry multiplayer in v1 (future temptation only).
- No Swiss Ephemeris inside the single-file game.

---

## 2. Player-facing sky modes

Config / URL / localStorage (names exact — both agents use these strings):

| Mode id | Behavior |
|---------|----------|
| `decorative` | **Default for strangers / public deploy.** Current artistic sky: stylized sun–moon opposition, `dayCycleSec` drift, random stars. Rhythm feel identical to today. |
| `clocked` | Sky clock = real civil time (UTC epoch → local solar altitude for lighting). Sun/moon (and later stars) follow real-ish geometry. No natal chart layer. |
| `clocked_chart` | `clocked` + natal ghosts + transit movers + aspect arcs/glyphs from a **skypack**. Local/private only. |

**Toggle UX (minimal — zen rule)**

- Prefer URL flags: `?sky=decorative|clocked|clocked_chart`
- Optional localStorage key: `aimdojo.skyMode` (persist last choice).
- Pause settings may gain a single three-way control later; not required for v1 if URL + localStorage work.
- Right-click **sky freeze** remains: freezes the *sky clock* (decorative phase or clocked epoch), not gameplay.

**LOW mode:** chart glyphs/arcs may simplify or hide; clocked sun/moon still OK if cheap. Never regress LOW performance invariants.

---

## 3. Projection model (v1)

**Chosen for v1: ecliptic dome (chart-like, simple).**

- Map body **J2000 ecliptic longitude** → position on a large sphere / ring around the Listener.
- Latitude on the sky sphere: small fixed elevation band above horizon for readability (planets near an “ecliptic belt”), not full scientific alt/az yet.
- Sun lighting / day–night: derived from **solar longitude + approximate time-of-day** so the dojo’s ambient day/night still feels right. Exact alt/az horizon astronomy is **v2**.
- Midpoint **13 signs** (incl. Ophiuchus) as faint labels on the ecliptic band when `clocked_chart` is on.
- Natal ghosts use the **same** longitude→position map as movers so a conjunction is two glyphs stacking.

**Coordinate contract field:** `"projection": "ecliptic_dome_v1"`.

---

## 4. Skypack contract (`skypack_v1`)

Single JSON document. Geometry only for gameplay-adjacent use; short glyph metadata allowed; **no essay paragraphs**.

### 4.1 Top-level schema

```json
{
  "schema_version": 1,
  "type": "skypack",
  "projection": "ecliptic_dome_v1",
  "generated_at": "2026-07-11T18:09:00+00:00",
  "epoch_utc": "2026-07-11T18:09:00+00:00",
  "timezone": "America/New_York",
  "location": null,
  "natal_id": "bobby-19831129T132400Z-e1d0a0c471",
  "natal_label": "bobby",
  "system": "midpoint_v1",
  "privacy": "local_only",
  "sign_band": [ /* 13 arcs */ ],
  "movers": [ /* transit / live sky bodies */ ],
  "natal_ghosts": [ /* fixed natal longitudes */ ],
  "resonances": [ /* transit body → natal point aspects in orb */ ]
}
```

### 4.2 `sign_band[]` entry

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | e.g. `aries` … `ophiuchus` (sidereal Midpoint ids) |
| `glyph` | string | Unicode sign glyph or short label |
| `lon_start_j2000` | number | [0, 360) |
| `lon_end_j2000` | number | [0, 360) — may wrap |

### 4.3 `movers[]` / `natal_ghosts[]` entry

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | `sun`, `moon`, `mercury`, … `pluto`, `north_node`, `south_node` |
| `name` | string | Display name |
| `glyph` | string | ☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇ ☊ ☋ |
| `lon_j2000` | number | [0, 360) |
| `sign` | string | Midpoint sign id |
| `degree_in_sign` | number | |
| `kind` | string | `planet` \| `luminary` \| `node` |
| `retro` | bool | optional, movers only |

Natal ghosts omit speed; movers may include `speed_long` optional.

### 4.4 `resonances[]` entry (transit → natal only)

| Field | Type | Notes |
|-------|------|--------|
| `transit_body` | string | mover id |
| `natal_point` | string | natal ghost id |
| `aspect_id` | string | `conjunction` \| `opposition` \| `trine` \| `square` \| `sextile` |
| `aspect_glyph` | string | ☌ ☍ △ □ ⚹ |
| `separation` | number | degrees |
| `orb` | number | degrees from exact |
| `orb_limit` | number | orb allowance used |
| `applying` | bool \| null | |

Only major aspects already used by sidereal transit engine. No minor aspects in v1.

### 4.5 Privacy rules (hard)

- `privacy: "local_only"` always for packs that include `natal_ghosts` or `resonances`.
- Never POST skypack to Supabase / leaderboard / share endpoint.
- Public static deploy ships **without** personal natal packs; `clocked_chart` without a pack degrades to `clocked` + quiet toast/log.
- Sample fixture packs used in tests must use synthetic or already-local chart ids; do not invent birth data.

### 4.6 Delivery channels

| Channel | Producer | Consumer |
|---------|----------|----------|
| CLI | `python -m sidereal skypack --natal <id> [--when …] [-o path]` | files / agents |
| API | `GET /api/skypack?natal_id=…&when=…` (localhost only) | dojo `fetch` when `?sky=clocked_chart` |
| Drop-in | write `skypack.json` next to game or `?skypack=url` | offline / Pages without Python |
| Fixture | `sidereal/data/fixtures/skypack_bobby_sample.json` | tests + Fable without live server |

---

## 5. Visual design constraints (Moon Chorus)

**Tone:** symbolic glyphs, soft seals — not desktop astrology software.

| Element | Treatment |
|---------|-----------|
| Ecliptic band | Very faint ring / arc; Moon Chorus palette (cool rail / moon milk), low alpha |
| Sign labels | Tiny glyphs or 1–2 letter Midpoint abbreviations; optional, dim |
| Movers | Brighter sprites + planet glyph billboard; Moon slightly larger |
| Natal ghosts | Same glyph, ~40–50% opacity, smaller scale, no bloom spam |
| Resonances | Thin additive line (Moonline family) between positions; aspect glyph at midpoint of arc; brighter when orb is tight |
| Floor | Untouched night grid / day checker |
| HUD | No permanent transit panel. Optional: pause-only line “SKY · CLOCKED+CHART” |
| Essays | **Out of game.** Full text stays in sidereal transit MD / agent context |

**Glyph set (use these Unicode forms unless canvas rasterization requires draw-call substitutes)**

- Planets: ☉ ☽ ☿ ♀ ♂ ♃ ♄ ♅ ♆ ♇  
- Nodes: ☊ ☋  
- Aspects: ☌ ☍ △ □ ⚹  
- Signs: traditional 12 + Ophiuchus label `⛎` or text `Oph` if font lacks glyph  

---

## 6. Architecture

```
┌────────────────────────────────────┐
│ sidereal (source of truth)         │
│  Swiss Ephemeris, Midpoint map,    │
│  natal library, transit aspects    │
│  → skypack_v1 JSON                 │
└────────────────┬───────────────────┘
                 │ CLI / localhost API / fixture file
                 ▼
┌────────────────────────────────────┐
│ aim-dojo index.html                │
│  skyMode loader                    │
│  decorative | clocked | +chart     │
│  aesthetic layer only              │
│  NEVER reads skypack in gameplay   │
│  scoring / spawn / groove paths    │
└────────────────────────────────────┘
```

**Invariant:** `grep`-able proof that spawn, fire, groove, tank, leaderboard, and WASD paths do not reference skypack fields.

---

## 7. Work parcels

### Parcel A — Codex (sidereal) — **literal, contract-first**

**Owner:** Codex  
**Repo:** `/mnt/c/Users/rober/Downloads/Projects/sidereal`  
**Prompt file:** `sidereal/CODEX_PROMPT_SKYPACK.md`

| ID | Task | Done when |
|----|------|-----------|
| A1 | Define `skypack_v1` builder module (pure functions from chart + transit geometry) | Unit tests for schema shape, lon range, glyph presence |
| A2 | Wire CLI `skypack` command | `python -m sidereal skypack --natal <id> -o …` writes valid JSON |
| A3 | Wire `GET /api/skypack` on local web app | Returns same JSON; 404 on missing natal; no essay blobs |
| A4 | Emit fixture `data/fixtures/skypack_bobby_sample.json` from real bobby chart + fixed epoch | Checked in; documented epoch in fixture meta |
| A5 | Document one-line usage in sidereal README | Copy-paste for dojo / agents |

**Codex must not:** edit `aim-dojo/index.html`; add weather/difficulty fields; include interpretation essay text in skypack; change Midpoint astronomy formulas without tests.

**Suggested order:** A1 → A4 (fixture) → A2 → A3 → A5.

### Parcel B — Fable (aim-dojo) — **visual sky, latitude on craft**

**Owner:** Fable  
**Repo:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`  
**Prompt file:** `aim-dojo/FABLE_PROMPT_CLOCKED_SKY.md`

| ID | Task | Done when |
|----|------|-----------|
| B1 | Introduce `skyMode` (`decorative` \| `clocked` \| `clocked_chart`) with URL + localStorage | Decorative path pixel/logic-equivalent to current sky for default |
| B2 | **Clocked:** drive sun/moon (and sky rotation) from real time instead of pure `dayCycleSec` spin; keep freeze | Day/night tracks real clock; freeze holds epoch |
| B3 | Load skypack (fixture path / `?skypack=` / localhost API); validate `schema_version` | Fail soft → `clocked` |
| B4 | Draw ecliptic band + mover glyphs from pack | Visible in `clocked_chart` only |
| B5 | Natal ghosts + resonance arcs + aspect glyphs | Aesthetic only; no gameplay reads |
| B6 | LOW / reduceMotion / zen: simplify chart layer; no new toast spam | Still playable on weak GPU |

**Fable must not:** put chart on floor; couple aspects to difficulty; ship personal natal in repo; break arrival-timing / fire-quant / groove; add heavy UI panels; block on network in the render loop.

**Suggested order:** B1 → B2 (can start before Codex finishes) → B3–B5 once fixture exists (or mock minimal JSON matching §4) → B6 polish.

### Parcel C — Integration (either agent after A+B, or human)

| ID | Task |
|----|------|
| C1 | End-to-end: sidereal serve → dojo `?sky=clocked_chart` loads bobby skypack |
| C2 | Confirm score/spawn/groove unchanged (manual play + static review) |
| C3 | Optional: save transit snapshot + skypack same epoch for agent conversation parity |

---

## 8. Dependency graph

```
A1 (schema + builder)
 ├─► A4 fixture ──────────────────────────┐
 ├─► A2 CLI                               │
 └─► A3 API                               │
                                          ▼
B1 skyMode ──► B2 clocked ──► B3 load ──► B4 movers ──► B5 ghosts/arcs ──► B6 LOW
                                          ▲
                                          └── fixture or mock from §4

A* ∥ B1–B2   (parallel OK)
B3+ needs A4 or hand-written mock
C* after A3 + B5
```

---

## 9. Existing code anchors

### aim-dojo (`index.html`)

- Sky block ~`/* ========================= SKY: stars, sun, moon, day/night */`
- `skyGroup`, `buildStars`, sun/moon sprites, `skyDomeMat`
- `dayPhase`, `skyFrozen`, `CFG.dayCycleSec`, `updateSky(dt)`
- Floor: `nightGrid`, `dayFloor` — **do not turn into a chart**
- Freeze: `toggleSkyFreeze`
- Process: syntax-check inline script via `node --check` (see `CONTINUATION_PROMPT.md`)
- Core loop identity: arrival-timing, fire quant, WASD steady — **sacred**

### sidereal

- Chart compute: `src/sidereal/chart.py`, points with `lon_j2000`, `sign`, glyphs via reports
- Transit aspects: `src/sidereal/transit.py`, `interpret/transit.py`
- Saved charts: `charts/bobby-….json`
- Web API patterns: `src/sidereal/web/app.py` (`/api/transits`, etc.)
- Transit snapshots (agent essays): `charts/transits/*.md` — **orthogonal** to skypack (skypack is geometry for the game; MD is conversation)

---

## 10. Acceptance checklist

- [ ] Default load (no flags) = decorative sky, current game feel.
- [ ] `?sky=clocked` = real-time-driven lighting/sun path; no natal glyphs.
- [ ] `?sky=clocked_chart` + fixture/API = ecliptic band, movers, natal ghosts, ⚹□△☌☍ arcs.
- [ ] Floor remains night grid / day checker only.
- [ ] No skypack fields referenced from spawn/fire/groove/score/leaderboard code.
- [ ] LOW mode still runs; chart layer degrades gracefully.
- [ ] `python -m sidereal skypack --natal bobby-…` writes valid `skypack_v1`.
- [ ] Personal natal never uploaded by new code paths.
- [ ] Epistemic: no “prediction” strings added to player-facing UI.

---

## 11. Future (out of scope for this plan)

- Local alt/az Stellarium projection (needs lat/lon).
- Synastry arcs between two players’ ghosts (multiplayer).
- Listen mode / full essay panels.
- Weather DNA (explicitly rejected).
- Baked daily public skypack without natal (global sky only).

---

## 12. Agent prompt index

| Agent | Style | File |
|-------|--------|------|
| **Codex** | Literal, guideline-heavy, contract tests | `sidereal/CODEX_PROMPT_SKYPACK.md` |
| **Fable** | Visual craft latitude within hard rails | `aim-dojo/FABLE_PROMPT_CLOCKED_SKY.md` |

Both prompts **must** treat this document as the source of truth. If a prompt and this plan disagree, **this plan wins**.
