# Public Sky Day + In-Game Glossary — Implementation Spec

**Status:** approved direction (2026-07-12), **not implemented**  
**Repos:** Moon Chorus (`aim-dojo`) + sidereal on **Railway** (public geometry) + local personal chart (optional, not this ship)  
**Canonical path:** `aim-dojo/SPEC_PUBLIC_SKY_DAY.md`  
**Sidereal pointer:** `sidereal/SPEC_PUBLIC_SKY_DAY.md`  
**Parent product vision:** `SPEC_WEB_SKY_PROFILE.md` (accounts / Save my sky — later)

---

## 0. Goals

| Goal | Detail |
|------|--------|
| **Public sky positions** | Accurate-enough planet longitudes for **today**, served from **Railway sidereal**, cached **once per calendar day** |
| **No birth required** | Response is **anonymous** — no natal, no personal seals |
| **In-game glossary** | Static JSON in the game: planet / sign / planet-in-sign study notes for Listen **without** any server |
| **Offline / server-down** | Glossary always works; positions fall back to client Meeus ☉/☽ (+ sticks) |
| **Personal transits** | Stay **local / optional** — out of scope for this parcel (you keep desk + skypack on your machine) |
| **Theatre / natural** | Unchanged client spin; day pack only sets **where** bodies sit on the sphere |

---

## 1. Non-goals (this parcel)

- Supabase birth profiles / “Save my sky” UI  
- Personal `sky-listen` essays on Railway for random users  
- Shipping Swiss Ephemeris inside the browser  
- Changing combat / training / records  
- Forcing `clocked_chart` on the public site  

---

## 2. Architecture

```
┌──────────────────────────┐         GET /api/sky-day
│ aim-dojo (Vercel)        │ ──────────────────────────► ┌─────────────────────┐
│  sticks fixture          │ ◄──── skyday_v1 JSON ───────│ sidereal @ Railway  │
│  sky_glossary_v1.json    │                             │  Swiss Ephemeris     │
│  sphere + theatre        │                             │  day cache           │
│  Listen → glossary       │                             └─────────────────────┘
│  (optional local pack)   │
└──────────────────────────┘
         │
         │ optional local only (you)
         ▼
   localhost:8742 sky-listen + natal skypack
```

---

## 3. Public API: `GET /api/sky-day` (Codex / sidereal)

### 3.1 Purpose

Return **one day’s** public sky geometry for Moon Chorus. No auth. No natal.

### 3.2 Query parameters

| Param | Required | Meaning |
|-------|----------|---------|
| `tz` | no | IANA tz for **calendar day** boundary of the cache key (default `UTC`) |
| `date` | no | `YYYY-MM-DD` in that tz for study/debug; default = **today** in `tz` |
| `when` | no | If set, ISO local/UTC moment for computation; still cached under that date’s key |

Production game: omit `date`/`when` → server uses now.

### 3.3 Response: `skyday_v1`

Compatible with existing skypack consumers where possible, but **explicit type**:

```json
{
  "schema_version": 1,
  "type": "skyday",
  "projection": "ecliptic_band_v2",
  "system": "midpoint_v1",
  "privacy": "public",
  "cache_date": "2026-07-12",
  "timezone": "UTC",
  "epoch_utc": "2026-07-12T12:00:00+00:00",
  "generated_at": "2026-07-12T12:00:01+00:00",
  "sign_band": [ /* same shape as skypack sign_band */ ],
  "movers": [
    {
      "id": "sun",
      "name": "Sun",
      "glyph": "☉",
      "lon_j2000": 110.2,
      "sign": "gemini",
      "degree_in_sign": 12.5,
      "kind": "luminary",
      "retro": false
    }
  ],
  "natal_ghosts": [],
  "resonances": [],
  "same_body_delta": [],
  "resonance_rank": []
}
```

**Hard rules:**

- `privacy` must be `"public"`.  
- `natal_ghosts`, `resonances`, `same_body_delta`, `resonance_rank` must be **empty arrays** (never omit if game expects keys; empty is fine).  
- Include major bodies: sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto, north_node, south_node (same set as skypack movers).  
- No `natal_id`, no personal fields.

### 3.4 Day cache (least frequent)

```
cache_key = f"{tz}:{cache_date}"   # cache_date = civil date in tz
if cached: return cached payload
else:
  compute sky at representative moment (prefer local noon of that date in tz,
    or exact `when` if provided)
  store in process memory and/or file under data/cache/skyday/
  return payload
```

- First request of the day computes; subsequent requests are cheap.  
- Do **not** recompute every HTTP hit.  
- Optional: `Cache-Control: public, max-age=3600` (game may also cache in memory for the session).

### 3.5 CORS

Allow game origins:

- `https://aim-dojo.vercel.app`  
- `https://robjohncolson.github.io` (if still used)  
- `http://127.0.0.1:8931`, `http://localhost:8931` (dev)  
- Configurable via env `SKY_DAY_CORS_ORIGINS` (comma-separated)

Same spirit as sky-listen CORS, but **public** route.

### 3.6 Implementation notes (sidereal)

- Reuse chart/ephemeris/skypack glyph maps — prefer factoring a `build_skyday(...)` next to `build_skypack` that **never** loads a natal chart.  
- Representative moment: **local noon** of `cache_date` in `tz` is fine for a day pack (stable, simple). Document it.  
- Railway: document env `EPHE_PATH`, `BOUNDARY_PATH`, port, healthcheck; ephe files must be present in the image or volume.

### 3.7 CLI (nice for you / CI)

```bash
python -m sidereal sky-day [--tz UTC] [--date YYYY-MM-DD] [-o path.json]
```

Writes the same JSON as the API (for inspection or optional static mirror).

### 3.8 Tests

- No natal keys populated.  
- Cache: two calls same date → same `epoch_utc` / movers (or identical payload).  
- Date rollover: different `date` → different cache key.  
- CORS header on allowed origin.  
- Movers non-empty; each has finite `lon_j2000` and glyph.

---

## 4. In-game glossary (aim-dojo — can be same or follow-up pass)

### 4.1 Asset

`fixtures/sky_glossary_v1.json`:

```json
{
  "schema_version": 1,
  "type": "sky_glossary",
  "system": "midpoint_v1",
  "signs": {
    "ophiuchus": { "glyph": "⛎", "title": "Ophiuchus", "text": "…" }
  },
  "planets": {
    "saturn": { "glyph": "♄", "title": "Saturn", "text": "…" }
  },
  "planet_in_sign": {
    "saturn:pisces": { "title": "Saturn in Pisces", "text": "…" }
  }
}
```

- Short symbolic study language; no predictions.  
- Prefer distilling from existing seeds offline; stubs OK with honest “short note” text.  
- All 13 Midpoint signs; major planets + nodes.

### 4.2 Listen behavior (public)

| Gate | Value |
|------|--------|
| Mode | **`clocked` or `clocked_chart`** |
| Sky time | Prefer **natural** for Listen; theatre may disable Listen or allow glossary-only (recommend: **allow glossary in both** — definitions don’t need real-time) |
| Orb block | Existing ray/sphere block — combat wins |

**Resolution order for card text:**

1. If local desk personal available (optional, local only) → YOUR CHART block as today  
2. Else glossary: planet_in_sign if known, else planet + sign texts  
3. Geometry-only fallback if glossary miss  

**Fetch day pack:** on boot for `clocked` / `clocked_chart`, `GET {SKY_API}/api/sky-day` — place all movers. On failure: keep Meeus ☉/☽.

### 4.3 Config

```js
CFG.skyDayApi: ''  // prod: https://<railway-host> ; empty = skip fetch
// or reuse CFG.skyListen.api base URL
```

---

## 5. Work parcels

### Parcel M — Codex (sidereal) — **this prompt**

| ID | Task |
|----|------|
| M1 | `build_skyday` pure builder (no natal) |
| M2 | Day cache by `tz:date` |
| M3 | `GET /api/sky-day` + CORS |
| M4 | CLI `sky-day` |
| M5 | Tests + README (curl + Railway env notes) |
| M6 | No aim-dojo requirement in this parcel (game can follow) |

**Prompt file:** `sidereal/CODEX_PROMPT_SKY_DAY.md`

### Parcel N — Game (aim-dojo) — follow-up (optional same session / later)

| ID | Task |
|----|------|
| N1 | `sky_glossary_v1.json` + load |
| N2 | Listen on `clocked` with glossary |
| N3 | Boot fetch `/api/sky-day` when `CFG.skyDayApi` set |
| N4 | Fallback Meeus if fetch fails |
| N5 | Deploy notes: set API URL for prod |

**Prompt file (when ready):** `aim-dojo/CODEX_PROMPT_PUBLIC_SKY_CLIENT.md` (optional; create with Parcel N)

---

## 6. Railway notes (for Codex README)

- Start: `python -m sidereal serve --host 0.0.0.0 --port $PORT ...`  
- Include `data/ephe` SE files and boundary JSON  
- Seed DB or generate on boot if needed for other routes; **sky-day does not require interpretation seeds**  
- Health: existing or `/api/sky-day?tz=UTC`  
- Do not commit personal charts into the image  

---

## 7. Acceptance

### Sidereal (M)

- [ ] `GET /api/sky-day` returns `type: skyday`, empty natal arrays, 12 movers  
- [ ] Same day cache hit does not recompute (observable via stable `generated_at` or mock clock in tests)  
- [ ] CORS works for Vercel origin  
- [ ] CLI writes valid JSON  
- [ ] pytest green  

### Game (N) — when done

- [ ] Public site without desk: sticks + multi-planet day pack (if API up) or ☉/☽  
- [ ] Listen shows glossary text offline  
- [ ] Personal chart path still local-only  

---

## 8. Privacy

- Public sky-day: **no PII, no natal**  
- Personal transits: **not on this endpoint**  
- Your local desk remains the home for Bobby-style charts until you choose otherwise  

---

## 9. Agent index

| Agent | File |
|-------|------|
| **Codex (sidereal sky-day)** | `sidereal/CODEX_PROMPT_SKY_DAY.md` |

**This document wins** on conflicts with older “static only day pack” brainstorm notes — Railway is the chosen home for public positions.
