# CODEX PROMPT — PERF P2: Sky asset pipeline (smaller images)

**Repo:** `aim-dojo`  
**Spec:** `SPEC_PERF_V1.md` §P2  
**Depends on:** none (parallel to P1)  
**Tools:** Python Pillow / ImageMagick OK; no new npm app runtime.

## Problem

| Path | Approx size | Load |
|------|-------------|------|
| `assets/sky/8k_stars_milky_way.jpg` | 1.9 MB | Temple milky shell |
| `assets/sky/zodiac/*.png` (13) | 3.9 MB total | **Always-on** belt |
| `assets/sky/2k_*.jpg` planets | ~8 MB total | Lazy on body focus |

First temple experience can exceed **5 MB** of sky-only images. Target: ship a leaner tree while keeping look “good enough” on desktop and cheap on LOW/mobile.

## Tasks

| ID | Task |
|----|------|
| A1 | Inventory: document before/after sizes in commit message or `assets/sky/README.md` |
| A2 | **Milky:** produce `assets/sky/2k_stars_milky_way.jpg` (or `1k_…`) via high-quality downsample of the 8k file; keep original or replace — prefer **tiered paths** |
| A3 | Wire `CFG.skyMaps.milkyPath` / `SKY_MAPS.MILKY_PATH` so **LOW or MOBILE** use the smaller map; desktop may keep larger |
| A4 | **Zodiac:** re-encode each PNG: max edge **512–768**, preserve alpha, optimize; optional WebP + PNG fallback if you touch loader |
| A5 | Update `sky-maps.js` + tests (`allAssetPaths` must still list **required** maps that exist on disk) |
| A6 | Optional: 1k planet set for LOW (`1k_mars.jpg` …) only if time allows; else skip planets in P2 |
| A7 | Visual smoke: gold transparent zodiac still correct; milky still equirect on sphere |

## Constraints

- `CFG.skyMaps` must stay a **flat** object (no nested `{}`) — contract tests use `/skyMaps\s*:\s*\{[^}]+\}/`  
- Do not break Midpoint sign ids or `mapForSign` / `mapForSignPng`  
- Do not change gameplay / chat / temple focus rules  
- Prefer **new files + path switch** over destroying the only high-res original if disk allows both  

## Suggested path table

| Tier | Milky | Zodiac max edge | Planets |
|------|-------|-----------------|---------|
| desktop | current or 2k | 768 | 2k (as today) |
| mobile | 1k–2k | 512 | 2k lazy |
| low | 1k | 512 or off | 1k or raw |

## Acceptance

- [ ] `du -sh assets/sky` significantly reduced (goal **≤ 6 MB** total tree if both milky + zodiac optimized)  
- [ ] `node --test tests/sky-maps.test.js tests/temple-orbs-contract.test.js` pass  
- [ ] No blank zodiac / broken milky in manual temple check  

## Out of scope

`vercel.json` (P1), lazy load logic (P3), HTML extract (P4).
