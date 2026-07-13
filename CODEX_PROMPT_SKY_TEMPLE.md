# Codex prompt — Sky Temple (select + investigate)

Copy everything below the line into Codex.  
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

---

## Mission

Implement **Sky Temple**: intentional sky select (hold **E** + fire → gold + silence), then **temple mode** (floor dissolves, orbs leave, real-time sky, no freeze) where the player investigates bodies and **aspects** with a **temple-only HUD**.

**Core temple loop:** reticle + fire on an **aspect line** (or body) → fixed panel with **transit detail** (bodies, aspect name, orb, applying/separating). That HUD exists **only** in temple.

**Spec wins:**  
`/mnt/c/Users/rober/Downloads/Projects/aim-dojo/SPEC_SKY_TEMPLE.md` (v1.1)

Do **not** add spoken samples. Do **not** put Hoʻoponopono phrases on the in-run HUD **ever** (EN lore only, forever). Prefer pure tones as today.

---

## Required reading

1. `SPEC_SKY_TEMPLE.md`  
2. `index.html` — `skyListenTry`, `startListen` / `clearListen` / `showListenCard`, `fire()`, `updateSky`, spawn/rhythm gates, natural sky attitude  
3. Skypack / resonances / natal ghosts placement  
4. Existing tests patterns under `tests/`

---

## Delivery order (do not skip gates)

### ST1 — Silent select
| ID | Task |
|----|------|
| T1 | Track E held (`KeyE` keydown/keyup); ignore when typing in forms |
| T2 | `fire()`: celestial select **only if** E held + existing orb-block rules |
| T3 | Select → gold emphasize + optional short line; **`legacyListenCard: false`** (no study chip) |
| T4 | Clear select: empty hold-E+fire or X when not in temple |

### ST2 — Temple shell
| ID | Task |
|----|------|
| T5 | Tap E with selection → `enterSkyTemple`; E/Esc → `exitSkyTemple` (Esc exits temple first, does not pause while in temple) |
| T6 | On enter: stop spawns, clear targets/projectiles, fade floor/grid, hide WASD lane / beat obligation, force natural sky, `skyFrozen=false` |
| T7 | On exit: restore floor, allow spawns, restore dojo audio/beat path |
| T8 | CFG `skyTemple` block per spec |

### ST3 — Temple body HUD
| ID | Task |
|----|------|
| T9 | In temple, reticle + fire focuses body (transit or natal ghost); show temple panel with placement data |
| T10 | Panel DOM: fixed, temple-only; no dojo Listen card reuse for long essays |

### ST4 — Aspects + transit detail HUD (personal chart) — first-class
| ID | Task |
|----|------|
| T11 | Draw capped aspect lines transit→natal when chart present (`maxAspectLines`) |
| T12 | Reticle pick on segment focuses aspect (prefer line over body when both hit); panel shows transit body, aspect, natal point, orb, applying/separating; optional signs/degrees if cheap from pack |
| T13 | Public-only: no lines; body/sign detail only |
| T14 | No DeepSeek / no legacy Listen card / no Hoʻoponopono strings in temple panel |

### Out of scope
- Ritual phrase text or VO (lore lock)  
- ST5 tone-pulse juice (optional later; default off)  
- DeepSeek in temple  
- LS4 server alt/az  
- Groove pocket re-enable  

---

## Critical rules

1. **Never** select sky without E held.  
2. **Temple = no combat.**  
3. **Natural + no freeze** in temple.  
4. **Investigation HUD only in temple** — including aspect transit details.  
5. Phrases: **silent forever** on HUD; EN lore / comments only.  
6. Privacy: no birth coords in temple panel.

---

## Verification

```bash
node --test tests/*.test.js
```

Manual:
1. Fire without E → shot only.  
2. Hold E + fire on planet → gold, no right chip.  
3. E → temple: floor gone, orbs gone, natural sky, no freeze.  
4. With chart: lines; reticle+fire on aspect → panel shows transit × aspect × natal + orb (+ applying/separating).  
5. Without chart: no lines; body panel only.  
6. E/Esc → dojo restored.  
7. Grep: no “I love you” / Hoʻoponopono phrase strings in temple or dojo HUD DOM.

---

## Suggested commits

1. `Silent sky select requires holding E; disable legacy listen card.`  
2. `Add sky temple mode: dissolve floor, clear combat, real-time sky.`  
3. `Temple investigation HUD for bodies and clickable aspect transit detail.`  

---

## Checklist

- [ ] ST1–ST4 (or ST1–ST2 if split PR; note residual)  
- [ ] Spec §11 acceptance (incl. aspect-click panel + lore silence)  
- [ ] Tests for E-hold gate + temple active spawn block  
- [ ] No spoken audio assets; no phrase labels in-run  
