# Fable prompt — clocked sky + chart layer (Parcel B)

Copy everything below the line into Fable. Working directory must be the **aim-dojo** repo.

---

## Mission

Give Moon Chorus a **personal planetarium sky**: real-time clocked heavens, and optional natal/transit **glyphs in the sky only**. The game stays a pure skill rhythm trainer. You own the **look and feel** of the sky layer; stay inside the hard rails below.

## Required reading (do this first)

1. **Plan (source of truth):**  
   `SPEC_PERSONAL_PLANETARIUM.md` (this repo root)  
   Also: `/mnt/c/Users/rober/Downloads/Projects/aim-dojo/SPEC_PERSONAL_PLANETARIUM.md`  
   Read sections **1–3, 5–7 (Parcel B), 9 (aim-dojo anchors), 10**.  
   If a cool idea fights the plan, **the plan wins**.

2. **Game identity (do not regress):**  
   `CONTINUATION_PROMPT.md` — arrival-timing kills, fire quant, WASD steady, zen UI, LOW mode, single-file `index.html`.

3. **Skypack shape:** plan §4. Fixture (when Codex lands it):  
   `/mnt/c/Users/rober/Downloads/Projects/sidereal/data/fixtures/skypack_bobby_sample.json`  
   Until then, you may ship a **minimal mock** JSON in-repo under something like `fixtures/skypack_mock.json` matching §4 (synthetic positions OK for layout). Prefer the real fixture when present.

## Scope — you own

| ID | Deliverable |
|----|-------------|
| B1 | `skyMode`: `decorative` \| `clocked` \| `clocked_chart` (URL `?sky=` + `localStorage aimdojo.skyMode`) |
| B2 | Clocked sky: real-time-driven sun/moon / day-night instead of pure decorative `dayCycleSec` spin |
| B3 | Load skypack (soft-fail); validate `schema_version` |
| B4 | Ecliptic band + mover glyphs |
| B5 | Natal ghosts + resonance arcs + aspect glyphs (⚹ □ △ ☌ ☍) |
| B6 | LOW / reduceMotion / zen-safe degradation |

## Hard rails (non-negotiable)

1. **Aesthetic only.** No aspect → difficulty, spawn, BPM, orb glow window, scoring, leaderboard, or WASD logic.
2. **Floor stays floor.** Night grid + day checker untouched as chart surfaces. No houses, no wheel on the ground.
3. **Default remains `decorative`** so public deploy / strangers keep today’s sky and feel.
4. **Privacy:** never upload skypack/natal to Supabase, share links, or multiplayer. Chart mode is local.
5. **Single file** stays the product (`index.html`). Small fixture JSON is OK. No build step, no npm dependency for this feature.
6. **Sacred loop:** do not alter projectile arrival grading, fire quant, tank rules, or audio transport clock for sky reasons.
7. **Sky freeze** still works: freezes decorative phase *or* clocked epoch.
8. **Performance:** chart layer is extra draw cost — gate on mode; simplify/hide under `LOW`; don’t tank weak GPUs.

## Creative latitude (where you may invent)

You **may** decide craft details as long as they serve Moon Chorus tone (milky night, soft seals, Listener myth — not desktop astrology chrome):

- Exact sprite size, alpha, additive vs normal blending for glyphs
- Whether glyphs are canvas textures, CSS2D-like sprites, or stroke text on sprites
- Ecliptic band as thin torus / line loop / shader rim
- How tightly sun lighting tracks real solar altitude vs a pleasing approximation in `ecliptic_dome_v1`
- Micro-animation: slow glyph breath, arc pulse when orb is tight — **only if** `!reduceMotion` and not distracting mid-fight
- Pause-menu one-liner vs URL-only control for mode (zen: prefer minimal)

You **may not** “improve” the design by adding weather DNA, floor charts, essay HUD, or network requirements for the core game.

## Technical guidance

### Modes

```text
?sky=decorative      → current behavior (baseline)
?sky=clocked         → real clock, no natal layer
?sky=clocked_chart   → clocked + skypack glyphs
```

Resolve order suggestion: URL flag > localStorage > default `decorative`.

### Decorative (B1)

Preserve existing `updateSky` path when mode is decorative: `dayPhase` + `CFG.dayCycleSec` + current sun/moon opposition art. Refactors are OK if **behavior matches** for default players.

### Clocked (B2)

- Drive sky time from `Date.now()` (or frozen epoch when `skyFrozen`).
- Map real time → sun direction / day amount so night practice still feels like night when it’s night for the user (approx OK per plan §3 ecliptic_dome_v1).
- Stars: prefer stable field that rotates with the clocked sphere rather than pure random re-roll each session if easy; don’t block on a full star catalog.
- Keep floor day/night crossfade behavior coherent with sun height.

### Chart layer (B3–B5)

- Parent chart objects to a dedicated group (e.g. `chartSkyGroup`) under or beside `skyGroup` so freeze/rotation stay consistent.
- Projection: **ecliptic_dome_v1** — longitude → angle on a dome/ring (plan §3). Same map for movers and natal ghosts.
- `resonances`: line from transit body pos → natal ghost pos; aspect glyph at midpoint; scale brightness by tightness (`orb` vs `orb_limit`) if present.
- Loaders (try in order):  
  1. `?skypack=` URL  
  2. local relative fixture  
  3. `http://127.0.0.1:8742/api/skypack?natal_id=…` only if you add an explicit opt-in (`?skyApi=1` or similar) — **never block boot** on localhost failure  
- On failure: fall back to `clocked`, no error modal spam (optional one soft toast max).

### Code hygiene

- Touch `index.html` carefully; keep sections commented.
- After edits, syntax-check the inline script:

```bash
F=index.html
o=$(grep -nE "^<script>$" "$F" | tail -1 | cut -d: -f1)
c=$(grep -nE "^</script>$" "$F" | tail -1 | cut -d: -f1)
sed -n "$((o+1)),$((c-1))p" "$F" > /tmp/g.js && node --check /tmp/g.js
```

- Grep proof for the write-up: skypack / resonances must not appear in spawn/fire/groove/score paths.
- Do not push to `main` unless the user asks; leave a clean commit-ready tree.

## Definition of done

- [ ] B1–B6 complete per plan §7 Parcel B
- [ ] Default = decorative, feel preserved
- [ ] `?sky=clocked` works offline with no pack
- [ ] `?sky=clocked_chart` shows band + movers + ghosts + aspect seals with fixture/mock
- [ ] Floor not a chart; rhythm systems untouched
- [ ] `node --check` clean on extracted script
- [ ] Short note in PR/commit body: how to try the three modes

## Suggested build order

1. B1 mode switch scaffolding (decorative path = current code).  
2. B2 clocked sun/day.  
3. B3 loader + mock/fixture.  
4. B4–B5 glyphs/arcs (iterate visually).  
5. B6 LOW / reduceMotion pass.

## Collaboration with Codex

- Codex builds real skypacks in **sidereal** (Parcel A).  
- You do **not** wait for perfect API polish: mock §4 JSON is enough to place glyphs.  
- When fixture exists, point loader at it and delete mock if redundant.

**Begin:** read `SPEC_PERSONAL_PLANETARIUM.md`, skim sky code around `updateSky` / `skyGroup`, then implement B1.
