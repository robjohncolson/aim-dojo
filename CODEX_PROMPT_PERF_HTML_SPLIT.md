# CODEX / CLAUDE PROMPT — PERF P4: Split monolithic index.html (optional)

**Repo:** `aim-dojo`  
**Spec:** `SPEC_PERF_V1.md` §P4  
**Risk:** HIGH — almost every contract test greps `index.html`  
**Do only after P1–P3** unless parse time is still the top complaint.

## Problem

`index.html` is ~**534–547 KB** of HTML+inline game code. The browser must download and parse it before the main IIFE runs (after THREE).

## Tasks

| ID | Task |
|----|------|
| H1 | Move the large game IIFE / script body into `aim-dojo-main.js` (name flexible) |
| H2 | Keep tiny pre-paint inline script (lang / `seen` class) in HTML |
| H3 | Load order: modules (`observer-location`, `local-sky`, `sky-temple`, `sky-maps`, `save-my-sky`) → THREE → `aim-dojo-main.js` (`defer` or end-of-body) |
| H4 | Update **all** tests that `readFileSync("index.html")` for `function foo(` to scan `index.html` **and** the new JS file |
| H5 | Prefer shared test helper `function sourceFor(name)` used by sky-chat / temple-orbs / index-contract |
| H6 | No bundler, no TypeScript, no build step |

## Constraints

- Public API of window globals (`AimDojoSkyMaps`, etc.) unchanged  
- Gate / overlay HTML stays in `index.html`  
- Japanese / EN `T()` table can move with the main JS  

## Acceptance

- [ ] Site works on static open + Vercel  
- [ ] `node --test tests/*.test.js` green  
- [ ] `index.html` **&lt; 150 KB** if extract is complete  

## Out of scope

CDN headers, image re-encode, THREE upgrade.
