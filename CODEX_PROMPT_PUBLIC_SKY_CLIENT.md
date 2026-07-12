# Codex prompt — Public sky client (Parcel N)

Copy everything below the line into Codex.  
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

---

## Mission

Wire Moon Chorus to the **public sky-day API** and an **in-game glossary** so every Vercel player gets:

1. **All major planets** on the constellation sphere from `/api/sky-day` (not only Meeus ☉/☽).  
2. **Listen** on `clocked` (and as fallback on `clocked_chart`) using **static glossary** text — **no server required for definitions**.  
3. **Graceful degrade** if Railway/local API is down: sticks + Meeus ☉/☽ + glossary still work.

Personal natal Listen (desk `:8742` sky-listen with YOUR CHART) stays as **optional enrichment** when local pack + API available — do not remove it.

Be **literal**. Follow the plan. Do not break combat or orb-over-sky priority.

## Required reading (first)

1. **Plan:** `SPEC_PUBLIC_SKY_DAY.md` §0–2, §4 Parcel N, §7 acceptance for game.  
2. **Parent vision:** `SPEC_WEB_SKY_PROFILE.md` (guest sky, theatre setting — already shipped).  
3. Code: `index.html` — `SKY_MODE`, `buildLuminaries`, `loadSkypack`, `skyListenTry`, `_lsnOrbBlocksSky`, `showListenCard`, `CFG.skyListen`.

## Scope — Parcel N

| ID | Task |
|----|------|
| N1 | Add `fixtures/sky_glossary_v1.json` (13 Midpoint signs + major planets/nodes + key planet_in_sign entries; short symbolic text, no predictions) |
| N2 | Load glossary on boot (like sticks); fail soft if missing |
| N3 | `CFG.skyDayApi` (or reuse base URL): default **`http://127.0.0.1:8742`** for local; document prod Railway override via URL `?skyApi=https://…` or `localStorage` / build-time comment |
| N4 | On boot for `clocked` **and** `clocked_chart`: `GET {base}/api/sky-day?tz=<device_tz>` → place **all movers** on the sphere (reuse chart mover placement / luminaries path). Prefer day-pack lons over Meeus when present |
| N5 | Expand Listen: allow **`clocked`** (not only `clocked_chart`) when glossary and/or day movers exist; still block if orb on aim ray |
| N6 | Card text order: (1) personal desk block if natal pack + sky-listen succeeds (2) else glossary planet_in_sign / planet + sign (3) geometry fallback |
| N7 | Server down: no throw; keep sticks + Meeus; glossary Listen works |
| N8 | `node --check`; no gameplay coupling; do not push unless user asked in same thread (default: commit-ready tree OK if they asked push — user said commit push all; **push this repo if clean**) |

## Glossary content guidelines

- `type: "sky_glossary"`, `schema_version: 1`, `system: "midpoint_v1"`  
- Signs: all 13 including **ophiuchus**  
- Planets: sun…pluto + north_node, south_node  
- `planet_in_sign`: at least a **useful subset** (current-sky combos can be filled generically: one short template-quality note per planet×sign is ideal but large — minimum: all signs + all planets, and planet_in_sign for common pairs OR generate short combinatorial stubs like `"{Planet} in {Sign} symbolically joins [planet keywords] with [sign keywords]…"` from keyword tables to avoid 13×12 empty misses)  
- Tone: symbolic study, “traditionally read as,” no medical/financial/fate claims  

## Config sketch

```js
// near CFG.skyListen
skyDay: {
  api: '',  // empty → try CFG.skyListen.api, then http://127.0.0.1:8742
  path: '/api/sky-day',
  timeoutMs: 8000,
},
```

URL override examples (implement at least one):

- `?skyApi=https://xxx.up.railway.app` sets base for sky-day (and optionally listen)  
- Persist to `localStorage aimdojo.skyApi` if from URL  

## Listen gates (update)

```text
// OLD: only clocked_chart + natural + _lsnMeta (natal pack)
// NEW:
canListen =
  (SKY_MODE === 'clocked' || SKY_MODE === 'clocked_chart')
  && !orbBlocksSky()
  && (publicSkyReady || glossaryReady || natalMeta)
```

- **Theatre:** allow glossary Listen (definitions don’t need natural time).  
- Personal desk fetch: only when `natalId` / skypack natal present; else skip and use glossary.

## Day pack placement

- After fetch, build mover sprites for all bodies (similar to `buildChartSky` movers but **without** requiring natal ghosts/Δ/seals).  
- If `clocked_chart` also loads personal skypack later, personal pack may **override** day pack for chart mode only — document order: day pack first for public bodies, natal pack adds ghosts when present.  
- Simplest solid approach:  
  - `clocked`: day pack → public movers only  
  - `clocked_chart`: day pack for movers if no pack yet; if personal pack loads, use pack movers + listen personal  

## Out of scope

- Railway deploy itself (document `CFG` only)  
- Supabase birth forms  
- Removing local personal Listen  
- Changing orb-block combat priority  

## Verify

```bash
F=index.html
o=$(grep -nE "^<script>$" "$F" | tail -1 | cut -d: -f1)
# prefer extract script AFTER three.js tag
python3 - <<'PY'
from pathlib import Path
import re, subprocess
html=Path('index.html').read_text()
m=re.search(r'three\.min\.js"></script>\s*<script>\n', html)
start=m.end(); end=html.find('</script>', start)
Path('/tmp/g.js').write_text(html[start:end])
print(subprocess.run(['node','--check','/tmp/g.js'], capture_output=True, text=True).returncode)
PY
```

Manual:

1. No API: sticks + ☉/☽ + glossary Listen on a sign.  
2. API up: all 12 movers visible on `clocked`.  
3. Orb in front of sky → projectile, not Listen.  
4. Theatre: sky spins fast; Listen still glossary-OK.  
5. Personal pack + desk (dev): YOUR CHART still works when available.

## Definition of done

- [ ] N1–N7 complete  
- [ ] Glossary file committed  
- [ ] `node --check` clean  
- [ ] Summary: how to point at local vs Railway API  

**Begin:** read `SPEC_PUBLIC_SKY_DAY.md` §4, add glossary fixture, then boot sky-day fetch.
