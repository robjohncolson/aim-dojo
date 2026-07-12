# Codex prompt — Public sky polish (Parcel O)

Copy everything below the line into Codex.  
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

---

## Mission

Ship **Phase 0 + Phase 1** public sky polish:

1. **Theatre is the default** sky motion for new visitors.  
2. **Guest Listen** is clean (glossary first, no “is :8742 up?” scares for people without a chart).  
3. **One quiet toast** when today’s sky-day pack loads successfully.

Be **literal**. Small, safe changes. Do not touch combat ballistics, training, or Railway.

## Required reading (first)

1. **Plan (source of truth):** `SPEC_PUBLIC_SKY_POLISH.md` — entire file. **Plan wins.**  
2. Code: `index.html` — `SKY_TIME` resolver, `refreshSettings` / sky motion toggle, `loadSkyDay`, `showListenCard`, `skyListenTry`, `showGhostToast`.

## Scope — Parcel O

| ID | Task |
|----|------|
| O1 | Default `SKY_TIME` → **`theatre`** when no URL override and no saved `aimdojo.skyTime` |
| O2 | Guest Listen card: if no natal id, **SKY · NOW** + glossary only; remove/soften desk-scare strings for guests |
| O3 | On successful sky-day apply (first time per tab session), `showGhostToast` once with date/body count |
| O4 | Update comments that still claim natural is the public default; short README note if README already documents sky |
| O5 | `node --check`; preserve orb-over-sky block; preserve natural persistence after user toggle |

## Out of scope

- sidereal / Railway / Supabase  
- Changing `CFG.skyDay.api` production URL (already Railway)  
- Forcing theatre on users who already saved `natural`  
- Birth forms, clocked_chart requirements  
- Push only if the user’s conversation already asked for push; otherwise leave commit-ready  

## Implementation notes

### O1 — Theatre default

Find the `SKY_TIME` IIFE (or equivalent). Final fallback must be:

```js
return 'theatre';
```

not `'natural'`.

URL + `localStorage aimdojo.skyTime` still win when set.

Update any nearby comment block that says natural is the locked default.

### O2 — Guest card

In `showListenCard` (or helpers):

- When `!_lsnNatalId()` (and no personal available):  
  - Do **not** show “need local pack natal_id + desk :8742” as the main guest path.  
  - Prefer **SKY · NOW** block first with glossary text (`_lsnGlossary` / existing glossary resolver).  
  - Skip empty YOUR CHART scare, or one soft line only if you must reserve the section.  
- When natal id exists and desk fails: keep a short desk-failure line (developers / you).  
- When personal data exists: keep current YOUR CHART + seals behavior.

### O3 — Toast once

```js
let _skyDayAnnounced = false;
// after successful loadSkyDay + queueSkyGeometry / apply:
if (!_skyDayAnnounced) {
  _skyDayAnnounced = true;
  showGhostToast('…'); // e.g. include cache_date from pack if present
}
```

Do not toast on failure. Do not toast every geometry re-apply.

### O4 — Copy

Pause SKY MOTION labels can stay; ensure tooltips/titles still make sense with theatre default (e.g. “THEATRE ▸ tap for NATURAL” when in theatre).

## Verify

```bash
python3 - <<'PY'
from pathlib import Path
import re, subprocess
html=Path('index.html').read_text()
m=re.search(r'three\.min\.js"></script>\s*<script>\n', html)
start=m.end(); end=html.find('</script>', start)
Path('/tmp/g.js').write_text(html[start:end])
r=subprocess.run(['node','--check','/tmp/g.js'], capture_output=True, text=True)
print(r.returncode, r.stderr)
assert "return 'theatre'" in html or 'return "theatre"' in html
PY
```

Manual checklist for write-up:

1. Cleared storage → theatre spin.  
2. Toggle natural → reload stays natural.  
3. Guest Listen on constellation → glossary, no desk panic.  
4. Sky-day success → one toast.  
5. Orb in front of sky → still shoots.

## Definition of done

- [ ] O1–O5 complete per SPEC  
- [ ] `node --check` clean  
- [ ] Summary of files + default behavior  

**Begin:** read `SPEC_PUBLIC_SKY_POLISH.md`, then change the `SKY_TIME` default to theatre.
