# CODEX / CLAUDE PROMPT — PERF P5: WebGL frame budget

**Repo:** `aim-dojo`  
**Spec:** `SPEC_PERF_V1.md` §P5  
**Depends on:** P2/P3 preferred  

## Problem

Temple adds: milky equirect shell + up to **13** additive transparent sign planes + optional planet globe (canvas contrast pass). Combat already has LOW/MOBILE DPR and reflection skip; temple path needs the same discipline.

## Tasks

| ID | Task |
|----|------|
| F1 | On `LOW`: default `signArtAlways` off **or** `signArtLowMode:'focus'` (only focused sign) — document in CFG comment |
| F2 | Avoid redundant work in `placeAllSignArt` when sphere attitude unchanged (cheap dirty flag OK) |
| F3 | Globe: ensure enhance cache hits; skip enhance on LOW |
| F4 | Optional `?perf=1`: log average frame ms once per 2s to console (dev only; no HUD clutter in production default) |
| F5 | Confirm milky `segmentsFor('shell')` already tiers; do not raise segments |

## Constraints

- No change to beat timing, pocket, or projectile physics  
- Flat `CFG.skyMaps`  
- Desktop always-on belt remains the default when not LOW  

## Acceptance

- [ ] LOW + temple playable on weak GPU narrative (manual)  
- [ ] Tests green  
- [ ] Desktop visual quality not intentionally degraded  

## Out of scope

Asset re-encode, Vercel headers, HTML split.
