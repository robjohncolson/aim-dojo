# Codex prompt — Save my sky UI (Parcel R)

Copy everything below the line into Codex.
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

---

## Mission

Add **optional Save my sky** to Moon Chorus pause settings and wire personal sky to Railway when the user has a chart. Guests without a chart keep public sky-day + glossary (already shipped). Training / PLAY flow unchanged.

Be **literal**. Do not require chart before play. Do not put birth data on leaderboards.

## Required reading (first)

1. **Program plan:** `SPEC_PUBLIC_TRANSITS_AND_AI_SEEDS.md` §§2–3, §7 Parcel R.
2. **Public sky:** `SPEC_PUBLIC_SKY_DAY.md`, current `CFG.skyDay`, Listen, SKY MOTION.
3. Existing pause settings patterns (resolution, sky motion, name input).

## Scope — Parcel R

| ID | Task |
|----|------|
| R1 | Pause UI: **Save my sky** form (date, time, “time unknown”, tz, place label, lat/lon fields v1) |
| R2 | Auth: Supabase magic link **or** documented interim; must obtain JWT for `/api/me/*` |
| R3 | `POST /api/me/natal` on save; `DELETE` clear chart |
| R4 | If chart present: fetch `GET /api/me/skypack`, enable personal Listen path |
| R5 | If no chart: public sky-day + glossary only |
| R6 | Soft toasts; never block PLAY/training |

## Config

```js
CFG.skyDay.api = 'https://sidereal-production.up.railway.app' // already
CFG.supabaseUrl = '...'   // from env/build or placeholder + README
CFG.supabaseAnonKey = '...'
// personal API base: same host as skyDay unless CFG.personalApi set
```

Use env-less placeholders with clear README if keys can’t be committed; prefer `window.__SIDEREAL__` inject pattern or existing project convention.

## UX copy

- Section title: **SAVE MY SKY**
- Helper: optional; play works without it
- Epistemic: symbolic study, not predictions
- Success toast: `CHART SAVED` / `SKY LINKED`
- Failure: soft, one line

## Listen

- Keep orb-block combat priority.
- Personal seals when skypack natal present; else glossary.
- Desk scare only when user expected personal and API failed.

## Out of scope

- AI seed worker
- Full place autocomplete (lat/lon text fields OK for v1)
- Family multi-chart
- Changing theatre default

## Verify

- `node --check` on main script
- Guest path unchanged without form submit
- With mocked API, save → personal mode flag set

## Definition of done

- [ ] R1–R6
- [ ] README: how to set Supabase + Railway URLs
- [ ] No birth fields in dojo board submit payload

**Begin:** read program SPEC §3 and §7, add pause form shell, then wire save API.

**Dependency:** Prefer Parcel P routes live (or mock). If P incomplete, implement UI + fetch against documented paths and feature-flag with `CFG.saveMySky:true`.
