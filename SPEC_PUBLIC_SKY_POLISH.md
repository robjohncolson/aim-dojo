# Public Sky Polish — Theatre Default + Guest Experience

**Status:** approved direction (2026-07-12), **not implemented**  
**Repo:** `aim-dojo` (Moon Chorus)  
**Canonical path:** `aim-dojo/SPEC_PUBLIC_SKY_POLISH.md`  
**Depends on (already shipped):** clocked default, Railway sky-day, glossary Listen, SKY MOTION settings, orb-over-sky combat  
**Out of scope:** Save my sky, Supabase, personal natal on Railway, sidereal code changes  

---

## 0. Goals

| # | Goal |
|---|------|
| **0** | **Theatre is the public default** sky motion (spectacle first; natural still one tap away) |
| **1** | **Guest polish:** clear that the sky is “here now,” empty-sky Listen feels intentional, one quiet “sky updated” cue when day pack lands |

Non-goals: birth forms, auth, changing skill loop, changing Railway API contract.

---

## 1. Phase 0 — Theatre default

### 1.1 Behavior

| Situation | Result |
|-----------|--------|
| First visit / no `aimdojo.skyTime` | **`theatre`** |
| User already chose natural or theatre | **Keep** their saved preference |
| URL `?skyTime=natural` / `?theatre=0` | Natural + persist |
| URL `?skyTime=theatre` / `?theatre=1` | Theatre + persist |
| Pause **SKY MOTION** toggle | Still flips live and persists |

### 1.2 Implementation notes

- Change the default return of the `SKY_TIME` resolver from `'natural'` to **`'theatre'`**.  
- Do **not** bump `skyGen` solely to force theatre on existing natural users (respect choice).  
- Optional: one-time `aimdojo.skyTimeGen` only if product later wants a forced re-default — **not** required for this parcel.  
- Update comments / URL matrix strings that still say “natural is default.”  
- `refreshSettings()` labels stay accurate (THEATRE ▸ tap for NATURAL when in theatre).

### 1.3 Acceptance

- [ ] Incognito / cleared storage → loads in **theatre** (accelerated sphere).  
- [ ] After switching to natural in pause, reload → stays natural.  
- [ ] Decorative mode unchanged (art day cycle; sky motion row hidden).

---

## 2. Phase 1 — Guest polish

### 2.1 Empty-sky / glossary Listen clarity

When Listen fires **without** personal natal (public path):

| Element | Behavior |
|---------|----------|
| Gold highlight | Sign sticks and/or planet glyph (existing) |
| Card header | Prefer **SKY · NOW** first for guests (personal block omitted or single quiet line if no natal) |
| Body of card | Glossary: planet_in_sign if available, else planet + sign texts |
| Footer | Keep epistemic line (“symbolic study notes · not predictions”) |
| Missing glossary | Geometry-only line (name, sign, lon) — no “desk down” scare if they never needed a desk |

When personal natal **is** available (local pack + desk), keep **YOUR CHART** first + seals (existing personal path).

**Guest layout preference (when `!_lsnNatalId()`):**

```text
SKY · NOW
  <title / glyph line>
  <glossary text>
  symbolic study notes · not predictions
```

Do not show “need local pack natal_id + desk :8742” for pure public Listen — that copy is for developers who expected personal data. Use softer fallbacks only when a natal id exists but desk failed.

### 2.2 “Sky updated” toast (once per day pack)

When `loadSkyDay()` succeeds and applies geometry:

- Show a **single quiet** ghost toast, e.g.  
  `SKY · 12 JUL · 12 BODIES` or `TODAY'S SKY LOADED`  
- At most **once per browser tab session** (module flag), not every resume.  
- Optional: include `cache_date` from skyday payload if present.  
- `!reduceMotion` not required (toast is already soft); skip toast if `LOW` optional — prefer **always show once** (informational).  
- Failures: **no** error toast spam; silent Meeus fallback is fine.

### 2.3 Copy / discoverability (light)

| Surface | Suggestion |
|---------|------------|
| Pause SKY MOTION | Keep labels; ensure title/hint explains theatre vs natural (existing or one-line improve) |
| Optional start-card | **Do not** add a long sky tutorial. Training flow stays skill-first. |
| README (short) | One line: public sky defaults to theatre; natural in pause settings; positions from Railway sky-day |

### 2.4 Empty sky combat

Unchanged: if no celestial pick and no orb → normal fire (projectile).  
If orb on ray → combat.  
If clear sky pick → Listen.

### 2.5 Acceptance

- [ ] Public `clocked` + no pack: Listen on sign/planet shows glossary, no desk scare.  
- [ ] Day pack load: one toast per session when successful.  
- [ ] Personal Listen path still works with local natal + desk.  
- [ ] Theatre default + settings toggle + persistence.  
- [ ] `node --check` clean; no gameplay coupling.

---

## 3. Config touchpoints

```js
// SKY_TIME default → 'theatre'
// CFG.skyDay.api already Railway production
// optional CFG.skyDay.announce:true  // toast on successful day pack
```

---

## 4. Parcel O — Codex (aim-dojo)

**Prompt:** `aim-dojo/CODEX_PROMPT_PUBLIC_SKY_POLISH.md`

| ID | Task |
|----|------|
| O1 | Theatre default for new visitors |
| O2 | Guest Listen card layout / softer fallbacks |
| O3 | Once-per-session sky-day success toast |
| O4 | Comment/README micro-copy sync |
| O5 | Syntax check; do not break orb-block or training |

**No sidereal / Railway changes** in this parcel.

---

## 5. Relationship to larger roadmap

| Spec | Role |
|------|------|
| `SPEC_WEB_SKY_PROFILE.md` | Future Save my sky / accounts |
| `SPEC_PUBLIC_SKY_DAY.md` | Railway sky-day + glossary (shipped) |
| **This doc** | Public mood defaults + guest UX polish |

---

## 6. Agent index

| Agent | File |
|-------|------|
| **Codex** | `CODEX_PROMPT_PUBLIC_SKY_POLISH.md` |

**This document wins** if older comments still say natural is the public default.
