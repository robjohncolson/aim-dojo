# CLAUDE PROMPT — PERF orchestration (Aim Dojo)

You are coordinating **performance work** for **aim-dojo** (Moon Chorus), a **static** WebGL game on **Vercel**.

## Read first

1. `SPEC_PERF_V1.md` — baseline sizes, goals, parcels P1–P5  
2. Existing patterns: `LOW` / `MOBILE` / adaptive DPR in `index.html`  
3. `sky-maps.js`, always-on zodiac in `ensureAllSignArt` / `ensureSignArtSlot`  

## Your job

1. **Do not** implement everything at once. Dispatch or execute **one parcel at a time**.  
2. Prefer order: **P1 → P2 → P3 → P5**; P4 only if HTML size still hurts after P1–P3.  
3. After each parcel: `node --test tests/*.test.js` and a short manual temple check.  
4. Hand Codex the matching `CODEX_PROMPT_PERF_*.md` when the work is mechanical (headers, image resize, load queue).  
5. Keep **Claude** for cross-cutting runtime / contract-test fallout / LOW-path policy.

## Agent map

| Parcel | Prompt file | Best agent |
|--------|-------------|------------|
| P1 CDN headers | `CODEX_PROMPT_PERF_CDN_CACHE.md` | Codex |
| P2 Images | `CODEX_PROMPT_PERF_ASSET_PIPELINE.md` | Codex |
| P3 Load schedule | `CODEX_PROMPT_PERF_LOAD_SCHEDULING.md` | Codex or Claude |
| P4 HTML extract | `CODEX_PROMPT_PERF_HTML_SPLIT.md` | Claude |
| P5 Frame budget | `CODEX_PROMPT_PERF_FRAME_BUDGET.md` | Claude |

## Hard rules

- Static site: no required Next.js rewrite  
- `CFG.skyMaps` stays **flat** (no nested braces)  
- Do not regress temple chat, free-mouse, always-on sign **semantics** (load timing OK)  
- Do not commit `.vercel/` or secrets  
- Preserve `node --test tests/*.test.js` green  

## Vercel

- Project name: `aim-dojo` (see `.vercel/project.json` locally; don’t commit it)  
- After P1: verify with `curl -sI` on HTML vs `/assets/sky/…`  
- Live site historically used `max-age=0` on assets — P1 is the highest ROI fix  

## Done when

P1 + (P2 or P3) merged and documented in a short `SPEC_PERF_V1.md` “Shipped” note at the bottom (append-only).
