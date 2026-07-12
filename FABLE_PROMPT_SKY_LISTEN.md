# Fable prompt — Sky Listen + grounded arc (Parcel K)

Copy everything below the line into Fable. Working directory: **aim-dojo**.

---

## Mission

1. **Combat arcs always reach the ground** (no mid-air death from short `projLife` on high aim).  
2. **Sky Listen:** in **`clocked_chart` + natural** only, if reticle is on a celestial target and **no orb** is under the reticle, **fire = listen** (line to body → HUD), not a projectile.

## Required reading

1. **Plan:** `SPEC_SKY_LISTEN.md` — full. **Plan wins.**  
2. Sphere model: v2.1 / current `skySphere` pick positions.  
3. Fire path: `fire()`, `updateProjectiles`, `computeShotPlan`, `projLife`, groove/clank.  
4. `CONTINUATION_PROMPT.md` — do not break arrival timing for **real** shots.

## Scope

| ID | Task |
|----|------|
| K1 | Ground-completing projectile + ribbon/plan |
| K2 | Listen gates (mode + natural + no orb + above horizon) |
| K3 | Pick, Listen line, zero combat side effects |
| K4 | Gold constellation + oversized planet |
| K5 | HUD from `http://127.0.0.1:8742/api/sky-listen` (soft-fail) |
| K6 | LOW / reduceMotion |
| K7 | Verify syntax + isolation |

## Hard rails

1. Listen **never** increments shots, streak, clank, whiff, or spawns projectiles.  
2. Listen **only** when `SKY_MODE==='clocked_chart' && SKY_TIME==='natural'`.  
3. If orb in pick radius → **combat fire** (pattern #3).  
4. No freeze gate.  
5. Aesthetic/study only — no difficulty DNA.  
6. Privacy: natal only via local pack/API.  
7. `decorative` / plain `clocked` / theatre: combat only.

## K1 — Grounded arc

- Today projectiles can die on `life >= projLife` before ground.  
- Fix: integrate combat shots until **ground or wall**; set plan/ribbon horizon the same way.  
- Keep a large safety max time.  
- Preserve orb hit detection along the path.  
- Feel of flat shots should stay familiar.

## K2–K3 — Listen fire

On fire:

```text
if listenGatesOk && target = pickCelestial(reticle):
  play Listen line from MUZZLE (computeShotPlan origin) to target.worldPos
  fetch sky-listen API (async)
  emphasize target
  show HUD when data (or geometry fallback)
  return  // no projectile
else:
  normal fire()
```

- Pick: nearest planet/sign in screen space, above horizon.  
- Line: brief, hide when HUD shown or timeout.  
- natal_id from loaded skypack.

## K4 — Emphasis

- Selected stick figure → gold; others dim.  
- Selected planet → oversized globe ~☉ scale (procedural OK).  
- One selection at a time.

## K5 — HUD

- Block A: placement text from API.  
- Block B: personal transit when `personal.available`.  
- Labels: SKY · NOW vs YOUR CHART.  
- API base `http://127.0.0.1:8742`; timeout soft-fail to pack geometry (name, sign, Δ).  
- Zen card; dismiss Esc / new listen / timeout.

## Creative latitude

- Card layout, gold hex, globe shader, line duration, pick px radius.  
- Skeleton “…” while fetch runs — one quiet line max.

## Verify

```bash
# node --check on inline script (same recipe as CONTINUATION_PROMPT)
```

Manual:

1. High aim combat → hits floor.  
2. `?sky=clocked_chart` natural, fire at planet clear of orbs → line + HUD, no bullet.  
3. Orb under reticle → bullet.  
4. `theatre=1` → no Listen.  
5. API down → still emphasize + minimal text.

Do not push unless asked.

## Definition of done

- [ ] K1–K7  
- [ ] Gates match plan §2  
- [ ] Ground arc + Listen mutually exclusive paths  
- [ ] `node --check` clean  

**Suggested order:** K1 → K2 → K3 → K4 → K5 → K6 → K7.

**Begin:** read SPEC_SKY_LISTEN.md §2–5, then fix the arc (K1).
