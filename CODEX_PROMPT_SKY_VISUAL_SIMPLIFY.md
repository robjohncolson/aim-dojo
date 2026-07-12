# Codex prompt — Sky visual simplify (Parcel L)

Copy everything below the line into Codex.  
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`  
**Primary file:** `index.html` (inline script). Optional: this SPEC only.

---

## Mission

Simplify the personal sky so it is **legible and mythic**, not cluttered:

1. **Remove** both ecliptic band rails.  
2. **Remove** always-on sky **Δ** labels and **aspect seals**.  
3. **Hide natal ghosts** until Listen (then optional single faint marker for selected body).  
4. **Listen emphasis** = **large gold glyph**, **not** a procedural globe.  
5. **Upscale** sign + planet glyphs so they are readable.  
6. **Keep** Listen line, HUD, gates, grounded projectiles **untouched**.

Be **literal**. Follow the plan. Do not invent new features.

## Required reading (first)

1. **Plan (source of truth):** `SPEC_SKY_VISUAL_SIMPLIFY.md` — entire file. **Plan wins.**  
2. Skim Listen section in `index.html` (`skyListen`, `_lsn`, `startListen`, `buildChartSky`, `SKY_CHART`).  
3. Do **not** edit projectile ballistics (`projLife`, `updateProjectiles` ground logic) except if you accidentally touch shared helpers — **leave combat arc as-is**.

## Scope — Parcel L only

| ID | Do this |
|----|---------|
| L1 | Stop building ecliptic band loops (`bandOffs` / `C.band` chart lines) |
| L2 | Stop building always-on Δ text sprites |
| L3 | Stop building always-on seal sprites; dotted arcs stay off |
| L4 | Do not add ghost sprites at chart build; on Listen to a body with natal lon, may show one dim non-pickable ghost |
| L5 | Remove/disable Listen globe mesh; selected body → gold + large glyph scale |
| L6 | Increase `SKY_CHART.sign` / mover idle scales and alphas per plan §4 |
| L7 | Ensure pick only bodies + signs; ghosts not in pick map |
| L8 | Preserve Listen gates (`clocked_chart`+`natural`), line, API HUD, fire() hooks |
| L9 | `node --check`; no new gameplay coupling |

## Out of scope

- sidereal / API / skypack schema  
- NASA textures  
- decorative mode redesign  
- theatre/natural spin logic  
- push to remote unless user already asked in the same thread (default: **commit-ready, do not push**)

## Hard rails

1. Aesthetic only — Listen still never scores shots.  
2. No floor chart.  
3. No reintroduction of dual ecliptic rails.  
4. No bland globe as the selected planet representation.  
5. Seals/Δ meaning only in HUD (API), not sky graffiti.  
6. Match existing code style (dense comments OK if local to sky section).

## Implementation notes (concrete)

### Find and strip

- Band: loop that uses `C.band.halfLatDeg` / `bandOffs` and `chartLine` for full 360° loops — **delete** that build.  
- Δ: `same_body_delta` / `shortestArcDeg` label sprites under movers — **do not create** idle labels.  
- Seals: loop over `resonance_rank` / `resonances` creating aspect sprites — **do not create** idle seals.  
- Globe: Listen path that builds sphere/canvas globe for selection — **remove**; use `chartSprite` / existing glyph with gold color + large scale.

### Listen selection visual

```text
on startListen(body):
  dim non-selected movers slightly (optional)
  selected glyph: color gold (0xffd24a), scale ~ SKY_CHART.lum.glyphSun or plan §4
  selected constellation sticks: existing gold path
  optional: one natal ghost at ghostLon[id], dim, not pickable
on clearListen:
  restore scales/colors; hide ghost
```

### Scales

Update `SKY_CHART` defaults approximately:

- `sign.scale` ≥ 11, alpha ≥ 0.35  
- mover idle scale ≥ 12  
- listen selected ~ 25  

Tune within ±20% if something clips; document final numbers in a short comment.

### Verify

```bash
F=index.html
o=$(grep -nE "^<script>$" "$F" | tail -1 | cut -d: -f1)
c=$(grep -nE "^</script>$" "$F" | tail -1 | cut -d: -f1)
sed -n "$((o+1)),$((c-1))p" "$F" > /tmp/g.js && node --check /tmp/g.js
```

Grep: band rail / delta sky labels / seal sky sprites should not still be constructed for idle chart (Listen HUD may still mention aspects in DOM text — fine).

Manual checklist for your write-up:

1. clocked_chart: no double sky rails  
2. no floating Δ / seals idle  
3. Listen → big gold symbol + line + card  
4. high aim still grounds bullet  
5. decorative OK  

## Definition of done

- [ ] L1–L9 complete per SPEC  
- [ ] `node --check` clean  
- [ ] Summary: what removed, final scale numbers, files touched  
- [ ] Do not push unless explicitly told  

**Begin:** read `SPEC_SKY_VISUAL_SIMPLIFY.md`, then implement L1 (strip band) in `buildChartSky`.
