# SPEC_PERF_V1 — Aim Dojo / Moon Chorus performance

**Status:** draft for agent handoff (2026-07-14)  
**Surface:** static Vercel deploy (`aim-dojo` / `aim-dojo.vercel.app`) + browser WebGL client  
**Not in scope:** gameplay feel redesign, DeepSeek/Railway API latency (separate service)

## 0. What we measured (baseline)

| Item | Evidence |
|------|----------|
| App shape | Static site: `index.html` (~534 KB) + a few JS modules + `assets/sky/*` |
| Sky textures | `assets/sky` ≈ **12 MB** (milky shell alone **~1.9 MB** “8k” JPEG) |
| Zodiac PNGs | **13 files ≈ 3.9 MB** (always-on belt loads all when sticks boot) |
| Planet maps | ~8 MB total if every body were loaded; **lazy on focus** today (good) |
| HTML payload | ~547 KB over the wire; full game logic in one HTML file |
| CDN scripts | THREE r128 + Tone 14 from cdnjs (external) |
| Vercel cache | Live headers: `cache-control: public, max-age=0, must-revalidate` on **HTML and JPEGs** |
| Existing cost controls | `LOW` / `MOBILE` tiers, adaptive DPR, skip reflection pass on LOW, idle-deferred loads |

**Implication:** first temple visit can easily pull **several MB** of textures after the already-large HTML parse. Cache headers mean returning visitors re-download sky art more often than necessary. Runtime cost is dominated by WebGL (milky shell, sign planes, globe enhance) and the monolithic script parse.

**Vercel plugin note:** project is linked (`.vercel/project.json` → `aim-dojo`). CLI/MCP not available in this environment; agents should run `vercel` after local auth for headers/inspect.

## 1. Goals

| Goal | Target (first ship) | How to verify |
|------|---------------------|---------------|
| **G1** Faster second visit | Cache immutable assets ≥ 7d (ideally 1y + hash or content-addressed) | `curl -sI` on jpg/png/js shows long `max-age` or `immutable` |
| **G2** Smaller first temple paint | Zodiac + milky first-fetch budget ≤ **~2.5 MB** combined (from ~5.8 MB) | Network panel / `du` of shipped paths |
| **G3** HTML/JS parse lighter | Critical path scripts ≤ **~200 KB** compressed before “ENTER”; rest deferred | Coverage / Network |
| **G4** Stable 60/30 fps | Desktop 60; mobile/LOW 30+ with sign art + milky on | Manual / rAF budget log |
| **G5** No gameplay regression | Rhythm, temple, chat, save-my-sky unchanged | Existing `node --test tests/*.test.js` |

## 2. Non-goals

- Next.js / React rewrite  
- Changing Midpoint ephemeris or chat product rules  
- Replacing THREE version unless a parcel explicitly scopes it  
- Uploading secrets or committing `.vercel/`

## 3. Architecture (keep)

```
Browser
  index.html (bootstrap + main loop)
  observer-location / local-sky / sky-temple / sky-maps / save-my-sky
  THREE (CDN) + Tone (lazy CDN)
  assets/sky/* (static on Vercel)
  Railway personal API (chat / skypack) — out of band for PERF parcels
```

Optimization must preserve: static open-in-browser model, `LOW`/`MOBILE`/`?low`/`?hi`, temple always-on sign art **behavior** (may change resolution/load timing).

## 4. Parcels (dependency-aware)

### P1 — CDN cache & static headers (Vercel) — **first, low risk**
**Owner:** Codex or Claude  
**Files:** `vercel.json` (new), optional `README.md` note  
**Work:**
1. Add `vercel.json` `headers` for long-lived cache on:
   - `assets/**` → `public, max-age=31536000, immutable` (or 7d if no content-hash filenames)
   - `*.js` modules, `fixtures/**` → long cache if content-stable
2. Keep **HTML** short-cache or `max-age=0, must-revalidate` so deploys update immediately
3. Optional: `Content-Type` already correct; consider `Accept-Encoding` (Vercel does gzip/brotli by default)
4. Document: if assets change without rename, either bust query (`?v=`) or use shorter max-age for unhashed files

**Acceptance:**
- [ ] `curl -sI https://…/assets/sky/2k_mars.jpg` shows long `max-age` after deploy  
- [ ] `index.html` still revalidates so ship is visible without hard-purge  
- [ ] No gameplay code change  

### P2 — Asset pipeline (images)
**Owner:** Codex (image tooling)  
**Depends on:** none (can parallel P1)  
**Work:**
1. **Milky shell:** ship `2k` or `1k` default for mobile/LOW; keep current file as desktop optional or downsample once
2. **Zodiac:** export half-res (~512 max edge) or WebP/AVIF with PNG fallback; keep alpha; target **&lt; 80 KB/sign** median
3. **Planets:** optional 1k maps for LOW; desktop can keep 2k
4. Update `sky-maps.js` paths / `CFG.skyMaps` tier keys (`milkyPath`, `zodiacRes`) without nested CFG braces if contract tests require flat `skyMaps`
5. Do **not** break `allAssetPaths()` disk tests — required assets must exist

**Acceptance:**
- [ ] `du -sh assets/sky` drops meaningfully (target: total sky tree **≤ 6 MB**)  
- [ ] Visual: temple still readable; Neptune contrast pass still works  
- [ ] Tests green  

### P3 — Load scheduling (runtime)
**Owner:** Claude or Codex  
**Depends on:** P2 paths if paths change  
**Work:**
1. **Zodiac always-on:** do not block boot — load sign textures **idle / after first frame**, or progressive (visible signs first if cheap)
2. Cap concurrent `TextureLoader` (e.g. 2–3 at a time)
3. Defer `ensureMilkyShell` texture until temple enter **or** first `dojoShell` need (today builds on temple blend — verify no double work)
4. Keep planet maps **on focus only**; avoid preloading all planets
5. Optional: skip `enhancePlanetTexture` on LOW (use raw map) to save main-thread canvas cost

**Acceptance:**
- [ ] First interactive paint does not wait on 13 zodiac PNGs  
- [ ] Temple still shows full belt within ~2s on desktop broadband  
- [ ] Contract tests updated for new load hooks if named functions change  

### P4 — HTML / script budget (optional, higher risk)
**Owner:** Claude  
**Depends on:** none  
**Work (choose minimal first):**
1. Extract main IIFE from `index.html` → `aim-dojo-main.js` (or split `sky-temple-orbs.js`) loaded `defer` after THREE  
2. Keep language/seen boot script inline (tiny)  
3. Do **not** introduce a bundler unless a later parcel requires it  
4. Update all contract tests that `readFileSync index.html` for function bodies — either keep functions in HTML or teach tests to read the extracted file

**Acceptance:**
- [ ] Game boots on Vercel  
- [ ] `node --test tests/*.test.js` green  
- [ ] HTML file size **&lt; 150 KB** if extract succeeds  

### P5 — Frame budget (WebGL)
**Owner:** Claude  
**Depends on:** P2/P3 preferred  
**Work:**
1. Sign art: share one material when possible; avoid per-frame full belt work if positions only need attitude updates  
2. Globe: don’t re-run canvas enhance if cache hit (already partially cached)  
3. Document GPU cost of always-on 13 transparent additive planes; on LOW reduce to **glyph-only** or **focused sign only** via `CFG.skyMaps.signArtAlways` / `signArtLowMode:'focus'`  
4. Optional rAF hitch counter behind `?perf=1` (dev only)

**Acceptance:**
- [ ] LOW path stays playable with temple open  
- [ ] No change to combat timing constants  

## 5. Vercel-specific checklist

| Action | Why |
|--------|-----|
| Add `vercel.json` headers | Fix `max-age=0` on heavy static assets |
| Keep project static (no serverless required for client) | Match current deploy |
| Use Git push → production (existing) | Zero new CI unless desired |
| After P1 deploy: `curl -sI` assets + HTML | Prove cache split |
| Optional later: Analytics / Speed Insights | Real RUM — only if user wants dashboard |

## 6. Parcel order (recommended)

```
P1 CDN headers     ──┐
P2 Asset pipeline  ──┼──► P3 Load scheduling ──► P5 Frame budget
P4 HTML extract (optional, can wait)
```

## 7. Test matrix

```bash
cd aim-dojo
node --test tests/*.test.js
# After deploy:
curl -sI https://aim-dojo.vercel.app/ | grep -i cache
curl -sI https://aim-dojo.vercel.app/assets/sky/8k_stars_milky_way.jpg | grep -i cache
```

Manual: cold load → enter dojo → temple → sign art + planet + chat still work.

## 8. Risks

| Risk | Mitigation |
|------|------------|
| Long-cache serves stale maps after git change | Content hash filenames **or** 7d max-age + deploy note |
| Extracting HTML breaks contract tests | Update tests to multi-file scan |
| Aggressive downsample looks muddy | Keep desktop 2k; only LOW/mobile 1k |
| Lazy zodiac flashes empty sky | Placeholder opacity 0 until ready (already soft-fail) |

## 9. Out of scope follow-ups

- Service worker / offline pack  
- THREE r15x migration  
- WASM audio  
- Railway chat latency  

## 10. Shipped

| Date | Parcel | Notes |
|------|--------|-------|
| 2026-07-14 | **P1** CDN headers | `vercel.json`: assets/fixtures/js 7d + SWR; HTML revalidate. Specs + agent prompts checked in. |
| 2026-07-14 | **P2** Asset pipeline | In-place re-encode, filenames unchanged (contract strings pinned). Milky `8k_stars_milky_way.jpg` 1861→180 KB (8192×4096→3072×1536 q88). Zodiac ×13 3911→~660 KB (edge-512, FASTOCTREE-128 PNG). First-temple sky fetch ~5.8→0.84 MB (G2 ✓, budget 2.5 MB). Sky tree 11.5→6.7 MB (planets untouched — lazy + tuned globe pass; ≤6 MB deferred). Tests 131/131. Recipe: `scratchpad/p2/encode_p2.py`; inventory in `assets/sky/README.md`. |
