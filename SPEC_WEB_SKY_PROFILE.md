# Web Sky Profile — Product Spec

**Status:** approved direction (2026-07-12), **not fully implemented**  
**Ship now (public game):** guest **clocked** sky + theatre setting — no birth chart, no ephemeris server required  
**Later:** Railway sidereal + Supabase birth profile + daily skypack  

**Canonical path:** `aim-dojo/SPEC_WEB_SKY_PROFILE.md`  
**Related:** sky sphere / Listen / visual simplify specs under `aim-dojo/SPEC_*.md`

---

## 1. Goals

| Goal | Notes |
|------|--------|
| **Web-first** | Everyone on Vercel/Pages gets the new sky without running sidereal locally |
| **Play without chart** | Username/name enough; birth optional via “Save my sky” later |
| **Anonymous + optional save** | Train and play first; chart in pause |
| **Transits = now** | When personal chart exists, recompute least often of login vs once/day |
| **Theatre** | Settings toggle (like resolution), not a hidden URL-only feature |
| **One chart per user** | When accounts exist |

Non-goals for the **public ship without backend:** personal Listen seals, birth form, Supabase chart rows.

---

## 2. Player tiers

| Tier | Auth | Chart | Sky default | Listen |
|------|------|-------|-------------|--------|
| **Guest** | Name only (existing) | None | **`clocked` + natural** | Optional later: basic placement text only (no YOUR CHART) |
| **Saved sky** (future) | Account / name session | One natal | **`clocked_chart` + natural** | Placement + transit seals with essays |
| **Theatre on** | Any | Any | Same content, **accelerated spin** | Same content rules |

---

## 3. First-run & pause

```
PLAY — WAKE THE MOONLINE  →  always training
  → Full Night
  → Pause:
       RESOLUTION (existing)
       SKY MOTION: Natural | Theatre  (ship now)
       AUDIO OFFSET (existing)
       (later) Save my sky / edit chart
```

No skip-training button.  
No birth required before play.

---

## 4. Public sky without ephemeris server (ship now)

| Feature | Works offline/static? |
|---------|------------------------|
| Zodiac stick figures | Yes — `fixtures/zodiac_sticks_v1.json` |
| Sphere spin natural | Yes — device clock |
| Sphere spin theatre | Yes — `CFG.skyTheatreSec` |
| ☉/☽ glyphs | Yes — Meeus approx in client |
| Outer planets / natal / seals | **No** — needs desk skypack + API |
| Personal Listen essays | **No** — needs Railway sidereal |

**Default for all public visitors:** `SKY_MODE=clocked` (not decorative).  
Legacy decorative remains via `?sky=decorative` or future setting.

**skyGen:** bump stored gen once so existing `localStorage` decorative prefs do not block the new default.

---

## 5. Theatre setting (ship now)

| Item | Spec |
|------|------|
| UI | Pause **settingsBox**, sibling of RESOLUTION |
| Labels | `SKY MOTION` · `NATURAL ▸ tap for THEATRE` / `THEATRE ▸ tap for NATURAL` |
| Persist | `localStorage aimdojo.skyTime` = `natural` \| `theatre` |
| Apply | Live toggle preferred (no full reload); reseed phase when switching |
| Default | `natural` |
| URL | Keep `?theatre=1` / `?skyTime=` as overrides that persist |

When `SKY_MODE===decorative'`, theatre control can hide or no-op (decorative uses art `dayCycleSec`).

---

## 6. Future: Supabase + Railway (not this ship)

### 6.1 Identity

- Username required for records (existing pattern).  
- Chart optional.  
- Anonymous play fully valid.

### 6.2 Birth profile (one per user)

- birth_date, birth_time?, birth_tz, lat/lon, place_label, time_unknown  
- RLS: owner only  

### 6.3 Transit refresh

```
recompute skypack if last_computed_date < today (user tz)
// login twice same day → reuse
// first session next day → recompute
```

Always **current time** for the pack epoch when recomputing.

### 6.4 Backend

- Sidereal on **Railway** (ephe + seed DB + skypack + sky-listen).  
- Game points API base at Railway URL in prod.  
- Guest: optional **global** sky-of-day pack later; until then client Meeus + sticks.

### 6.5 Save my sky

- Pause form → Supabase → server natal → daily pack → `clocked_chart`.

---

## 7. Ship checklist (this PR)

- [x] SPEC written  
- [ ] Default sky **clocked** for public  
- [ ] skyGen bump clears stale decorative default  
- [ ] Theatre toggle in pause settings  
- [ ] Fixtures for sticks on Vercel  
- [ ] Commit + push `main` for Vercel  

---

## 8. Acceptance (public Vercel)

- Open site with no query: **constellation sky + ☉/☽**, natural day pace (or user’s saved theatre).  
- Pause → SKY MOTION → Theatre: accelerated full-sky spin without birth data.  
- Skill loop / training / records unchanged.  
- No requirement for local `:8742` or `skypack.json`.  
- Personal chart Listen remains local/dev until Railway phase.

---

## 9. Agent / impl notes

- Game-only ship: **aim-dojo** `index.html` + fixtures + this SPEC.  
- Sidereal Railway work: separate parcel later (`CODEX` on sidereal repo).
