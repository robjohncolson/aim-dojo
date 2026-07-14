# Codex prompt — Temple Orbs (equirect sky + planet globes)

Copy everything below the line into Codex.  
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

---

## Mission

Implement **Temple Orbs (Parcel TO)**:

1. **Milky-way equirectangular shell** — giant sphere, **BackSide**, child of `skySphere`, so the player is at the center looking at the map on the inner surface. Strongest in **Sky Temple**.  
2. **Temple focus globe** — when a transit **body** with a map is focused, show a **large** textured sphere (equirectangular NASA-derived map on `SphereGeometry`).

**Spec wins:**  
`/mnt/c/Users/rober/Downloads/Projects/aim-dojo/SPEC_TEMPLE_ORBS.md`

### Format lock (do not invent)

Maps are **equirectangular**. THREE `SphereGeometry` UVs already match.  
- Sky: `side: THREE.BackSide`  
- Planet: `side: THREE.FrontSide`  
No cube-map conversion.

---

## Required reading

1. `SPEC_TEMPLE_ORBS.md` (full)  
2. `index.html` — `skySphere`, `setSkyTempleFocus`, `enterSkyTemple` / `exitSkyTemple`, `updateSky`, THREE r128  
3. Existing UMD modules (`sky-temple.js`, `local-sky.js`) as style references  
4. Workspace rule: **commit asset files before referencing them in code**

---

## Phase TO0 — assets (do first)

Source files live on the user’s Desktop. Copy into the repo:

```bash
mkdir -p assets/sky
cp "/mnt/c/Users/rober/OneDrive/Desktop/8k_stars_milky_way.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_sun.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_moon.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_mercury.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_venus_atmosphere.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_venus_surface.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_mars.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_jupiter.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_saturn.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_saturn_ring_alpha.png" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_uranus.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_neptune.jpg" assets/sky/
# DO NOT copy 8k_mercury.jpg for v1 (~15MB)
git add assets/sky
```

If a Desktop path is missing, stop and report — do not invent placeholders.

README: one-line NASA-derived equirectangular credit.

---

## Delivery order

### TO1 — Milky shell
| ID | Task |
|----|------|
| M1 | `CFG.skyMaps` per spec |
| M2 | Build `milkyShell` mesh: large `SphereGeometry`, `MeshBasicMaterial`, **BackSide**, `fog: false`, `depthWrite: false` |
| M3 | Parent under **`skySphere`** so attitude/natural sky carries it |
| M4 | Lazy-load `assets/sky/8k_stars_milky_way.jpg`; cache texture |
| M5 | Temple: full opacity; dojo: off unless `dojoShell` |
| M6 | Duck procedural dome clouds in temple when shell is up |
| M7 | Load fail → shell stays hidden, no throw |

### TO2 — Focus globe
| ID | Task |
|----|------|
| G1 | Body → map path table (spec §4.4); Venus = atmosphere map |
| G2 | Lazy texture load + cache; `showTempleGlobe(bodyId)` / `hideTempleGlobe()` |
| G3 | Large sphere, camera-relative placement (distance/radius CFG); slow spin |
| G4 | Hook: body focus → show; sign/aspect/natal/clear/exit → hide |
| G5 | Unsupported body (nodes, pluto) → hide globe, HUD only |
| G6 | LOW/MOBILE: lower segment counts |

### TO3 — Saturn + sun polish
| ID | Task |
|----|------|
| R1 | Saturn `RingGeometry` + `2k_saturn_ring_alpha.png` (transparent / alphaTest) |
| R2 | Sun slightly brighter / emissive-friendly Basic material |

### Out of scope
- 8k mercury default  
- Axial tilt ephemeris  
- PBR / atmosphere shaders  
- Dojo combat planet balls  
- sidereal server changes  
- Sky chat changes  

---

## Critical rules

1. **Equirectangular only** — no custom UV math beyond THREE defaults.  
2. **Assets committed** before any path string ships in code.  
3. **Temple-first** for hero visuals; do not force milky shell on dojo by default.  
4. Globe is presentation; do not break glyph pick rays.  
5. Missing texture = silent degrade.  
6. THREE **r128** — use APIs valid for r128 (`Texture.encoding` if present; no r15x-only color management assumptions without guards).

---

## Verification

```bash
ls assets/sky/2k_*.jpg assets/sky/8k_stars_milky_way.jpg assets/sky/2k_saturn_ring_alpha.png
git status   # assets tracked
node --test tests/*.test.js
```

Manual:

1. Temple enter → milky way surrounds (inner sphere).  
2. Focus Mars → large red globe + study HUD.  
3. Focus Saturn → rings.  
4. Focus Venus → cloudy atmosphere map.  
5. Focus aspect → globe hides (or stays only if previous body policy — **prefer hide**).  
6. Exit temple → globe gone; dojo not fully milky unless CFG.

---

## Suggested commits

1. `Add equirectangular NASA-derived sky and planet maps under assets/sky.`  
2. `Add milky-way inner sky shell on the celestial sphere.`  
3. `Show large textured planet globes on temple body focus.`  

---

## Checklist

- [ ] TO0 assets tracked  
- [ ] TO1–TO3 (or TO1–TO2 + note Saturn residual)  
- [ ] Spec §9 acceptance  
- [ ] Tests for map table + temple-only globe gate + no throw on missing  
- [ ] README credit line  
