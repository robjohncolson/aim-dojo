# Codex prompt — Daily Sky Brief (copy-paste export)

Copy everything below the line into Codex.  
Implement **server first**, then **client**, unless you can do both in one session with clear commits per repo.

---

## Mission

Add a **pause-only “Today’s Sky Brief”**: a daily plain-text export of **natal placements + today’s transit movers + transit→natal contacts** (optional essay appendix if ready) so the player can **copy-paste into another LLM**.

- Facts from existing `build_transit_essay_facts` — **no DeepSeek required** for the brief.  
- Floor/gameplay/pocket code: **do not touch**.  
- Privacy: never share link, leaderboard, or dojo body.

**Spec wins:**  
`/mnt/c/Users/rober/Downloads/Projects/sidereal/SPEC_SKY_BRIEF.md`

---

## Parcel S1 — Server (sidereal)

**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/sidereal`

### Required reading

1. `SPEC_SKY_BRIEF.md`  
2. `src/sidereal/transit_essay.py` — `build_transit_essay_facts`, cache_date, essay get  
3. `src/sidereal/web/app.py` — `/api/me/natal`, `/api/me/transit-essay` auth patterns  
4. Existing tests for transit essay / me routes  

### Tasks

| ID | Task |
|----|------|
| S1 | Pure `format_sky_brief_text(facts, essay=None) -> str` per spec §4 (no lat/lon/email) |
| S2 | `GET /api/me/sky-brief` Bearer-only; load natal; build/reuse facts; attach ready essay section if available |
| S3 | Response: `{ status, cache_date, timezone, text, has_essay, epistemic }` |
| S4 | Invalidate with natal clear/update same as transit essay |
| S5 | Unit tests: format content sections; no coordinates; route 401 without auth; chart gate |
| S6 | Do not change public sky-day or Listen contracts |

### Out of scope (server)

- DeepSeek enqueue solely for brief  
- Multi-day history API  
- Changing essay generation pipeline except reuse/read  

### Verify (server)

```bash
# from sidereal project — use project’s usual test command
python -m pytest tests/ -q --tb=short -k "sky_brief or transit_essay" 
# or whatever the repo uses; ensure new tests pass
```

---

## Parcel C1 — Client (aim-dojo)

**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

### Required reading

1. `SPEC_SKY_BRIEF.md` §6–7  
2. Pause SAVE MY SKY / transit essay block in `index.html`  
3. `save-my-sky.js` — `getTransitEssay` / auth patterns  
4. Contract tests pattern in `tests/index-contract.test.js`  

### Tasks

| ID | Task |
|----|------|
| C1 | `save-my-sky.js`: `getSkyBrief()` + normalize helper |
| C2 | Pause UI: gated block, status, scrollable preview, **COPY BRIEF** |
| C3 | Fetch when pause opens / chart available; fail soft |
| C4 | Clipboard copy + toast `BRIEF COPIED`; fallback if needed |
| C5 | i18n chrome via `T` + `window.JA`; paste body stays server EN |
| C6 | Contract tests: control gated in pause; not in share; no dojo brief fields |
| C7 | Do not block PLAY/training; do not open during combat |

### Out of scope (client)

- Groove pocket / LAW HUD / combat  
- Generating geometry client-side  
- Auto-open brief  

### Verify (client)

```bash
node --test tests/*.test.js
```

---

## Critical product rules

1. **Pause-only**, user-initiated COPY.  
2. **Daily** via `cache_date` (natal tz).  
3. **Floor hue / pocket:** untouched.  
4. Brief is **ready without essay**; essay is optional appendix.  
5. **No lat/lon** in `text`.  
6. Epistemic line always present in `text`.

---

## Suggested commit messages

**sidereal:**  
`Add GET /api/me/sky-brief daily copy-paste export from transit facts.`

**aim-dojo:**  
`Add pause Today’s Sky Brief with copy for external LLM study.`

---

## Checklist

### Server
- [ ] S1–S6  
- [ ] Spec §9 acceptance 2–3, 5–6  

### Client
- [ ] C1–C7  
- [ ] Spec §9 acceptance 1, 4, 7–8  
- [ ] Full client test suite green  

### Both
- [ ] Spec wins on conflicts  
- [ ] No share/leaderboard leakage  
