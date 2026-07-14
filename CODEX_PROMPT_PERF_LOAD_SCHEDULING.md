# CODEX PROMPT — PERF P3: Load scheduling (lazy / idle textures)

**Repo:** `aim-dojo`  
**Spec:** `SPEC_PERF_V1.md` §P3  
**Depends on:** P2 preferred (smaller files); can ship without P2  

## Problem

`ensureAllSignArt()` (always-on Midpoint belt) starts loading **13 PNG textures** when sticks load. That competes with first paint, Tone, sky-day, and milky shell.

Planet globes are already lazy-on-focus (keep that).

## Tasks

| ID | Task |
|----|------|
| L1 | Decouple stick boot from bulk zodiac texture I/O: call a **queued** loader, not 13 parallel unlimited loads |
| L2 | Implement a small texture queue (max **2–3** concurrent `loadSkyTexture` for zodiac) |
| L3 | Prefer `requestIdleCallback` / staged timeouts so ENTER THE DOJO is not blocked |
| L4 | Milky shell: ensure texture load is **temple-first** (or first time shell opacity &gt; 0); no preload on decorative mode |
| L5 | LOW: either skip always-on art (`signArtAlways` false on LOW) **or** load only when temple opens |
| L6 | Optional: skip `enhancePlanetTexture` when `LOW` (raw map) |
| L7 | Update contract tests if function names change; keep `ensureAllSignArt` / soft-fail semantics |

## Constraints

- Always-on **behavior** on desktop: full belt still appears; only **when** bytes load may change  
- Missing PNG still soft-fails (no throw, no blank opaque plane)  
- Flat `CFG.skyMaps` only  
- Do not break `node --test tests/*.test.js`  

## Acceptance

- [ ] Network waterfall: zodiac not all in first 500 ms of document  
- [ ] Temple within ~2 s on desktop shows art as textures arrive  
- [ ] LOW remains playable  

## Out of scope

Image re-encode (P2), HTML split (P4), CDN headers (P1).
