# Temple Orbs — equirectangular sky + planet globes (Parcel TO)

**Status:** planned  
**Version:** 1.0 · 2026-07-14  
**Repos:** Moon Chorus (`aim-dojo`) only  
**Depends on:** Sky Temple (ST1–ST4), clocked `skySphere` attitude, body focus path  
**Sibling:** Sky Chat (dialogue) · local natural sky (attitude) — this parcel is **visual only**

---

## 0. Product intent

Two layered visual upgrades, both **NASA-style equirectangular** maps:

1. **Celestial backdrop** — the player sits at the center of a giant sphere whose **inner surface** is an equirectangular milky-way / starfield map. Strip procedural sky effects (or heavily duck them) and the map reads as surrounding space.  
2. **Temple focus globe** — when the player focuses a transit body (glyph) in **Sky Temple**, a **large textured sphere** of that body appears (planet map on a Three.js sphere), not only the glyph + HUD text.

Dojo combat readability stays glyph-first. Globes are a **temple investigation treat**.

### Map format lock

| Property | Value |
|----------|--------|
| Projection | **Equirectangular** (lon–lat → U × V) |
| Provenance | NASA-derived public science / visualization maps (Solar System Treks / similar lineage) |
| Sphere UV | THREE `SphereGeometry` default UVs map equirectangular correctly |
| Sky shell | `Mesh` + `SphereGeometry` + material **`side: THREE.BackSide`** (viewer inside) |
| Planet | `Mesh` + `SphereGeometry` + material **`side: THREE.FrontSide`** (viewer outside) |

Do **not** invent cube maps or special UV unwraps for v1. Equirectangular in → sphere out.

---

## 1. Goals

1. Ship maps under `assets/sky/` (or `assets/planets/`) **tracked in git** before code references them.  
2. Full-sky equirectangular starfield shell co-rotates with the existing celestial attitude (`skySphere` quaternion).  
3. In temple, focusing a supported **transit body** spawns/shows a large globe with that body’s map.  
4. Saturn uses diffuse + **ring alpha** disc when available.  
5. Venus prefers **atmosphere** map for “sky look”; surface optional toggle later.  
6. LOW / mobile use lower-res paths or skip 8k entirely.  
7. Glyphs remain pickable; globe is presentation, not a second pick mesh (v1).  
8. Graceful missing-asset fallback (glyph-only, no crash).

---

## 2. Non-goals (v1)

- Physically accurate planetary rotation periods / axial tilt (artistic spin OK)  
- Real albedo lighting / PBR / atmosphere scattering shaders  
- Pluto / nodes as globes (no maps provided)  
- Replacing all dojo glyphs with tiny planet balls mid-combat  
- 8k mercury as default (keep 2k; 8k optional HQ flag later)  
- Reprojecting maps (they are already equirectangular)  
- Cube-map conversion pipeline  
- DeepSeek / chat changes  

---

## 3. Asset inventory (source → repo)

**Source (user Desktop, Windows):**  
`C:\Users\rober\OneDrive\Desktop\`

| Source file | Repo path (canonical) | Role |
|-------------|----------------------|------|
| `8k_stars_milky_way.jpg` (~1.9 MB) | `assets/sky/8k_stars_milky_way.jpg` | Inner sky shell |
| `2k_sun.jpg` | `assets/sky/2k_sun.jpg` | Sun globe |
| `2k_moon.jpg` | `assets/sky/2k_moon.jpg` | Moon globe |
| `2k_mercury.jpg` | `assets/sky/2k_mercury.jpg` | Mercury globe (default) |
| `2k_venus_atmosphere.jpg` | `assets/sky/2k_venus_atmosphere.jpg` | Venus globe (default) |
| `2k_venus_surface.jpg` | `assets/sky/2k_venus_surface.jpg` | Optional alt (v1.1) |
| `2k_mars.jpg` | `assets/sky/2k_mars.jpg` | Mars |
| `2k_jupiter.jpg` | `assets/sky/2k_jupiter.jpg` | Jupiter |
| `2k_saturn.jpg` | `assets/sky/2k_saturn.jpg` | Saturn ball |
| `2k_saturn_ring_alpha.png` | `assets/sky/2k_saturn_ring_alpha.png` | Saturn rings (alpha) |
| `2k_uranus.jpg` | `assets/sky/2k_uranus.jpg` | Uranus |
| `2k_neptune.jpg` | `assets/sky/2k_neptune.jpg` | Neptune |
| `8k_mercury.jpg` (~15 MB) | **Do not ship v1** (optional HQ later) | — |

### 3.1 Pre-flight (human / agent before code)

```bash
# From aim-dojo root (WSL paths)
mkdir -p assets/sky
cp "/mnt/c/Users/rober/OneDrive/Desktop/8k_stars_milky_way.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_"*.jpg assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_saturn_ring_alpha.png" assets/sky/
# do NOT copy 8k_mercury.jpg for v1
git add assets/sky/*
git status   # all referenced maps must be tracked before push
```

### 3.2 Attribution

Add a short credit in README (and optional pause “about” later):

> Planet and sky maps are equirectangular NASA-derived visualization textures. Not affiliated with NASA. Symbolic game use only.

Keep LICENSE / credit accurate; do not claim original photography.

---

## 4. Architecture

### 4.1 Sky shell (always-on option, strongest in temple)

```
scene
 └─ skySphere (Group)          ← existing attitude quaternion
     ├─ milkyShell (Mesh)      ← NEW: large SphereGeometry, BackSide, equirect map
     ├─ sticks / glyphs / lums ← existing
     └─ temple group           ← existing aspects / ghosts
```

| Property | Recommendation |
|----------|----------------|
| Radius | Slightly **outside** stick shell (e.g. sticks ~330, stars points ~340 → shell **R ≈ 400–450**, still inside fog far if needed; camera far is 700) |
| Geometry | `SphereGeometry(R, 64, 32)` (LOW: 32×16) |
| Material | `MeshBasicMaterial({ map, side: BackSide, depthWrite: false, fog: false })` |
| Color space | `texture.colorSpace = THREE.SRGBColorSpace` if r152+; for **r128** use `texture.encoding = THREE.sRGBEncoding` if available, else leave default and tune brightness |
| Orientation | Child of `skySphere` so natural/theatre attitude carries the milky way with the chart |
| Equirect note | Standard sphere UVs = equirectangular; seam at U=0 — acceptable artistic seam v1 |

### 4.2 When the milky shell is visible

| Mode | Behavior |
|------|----------|
| **Temple** | Shell **on**, opacity high; procedural dome may stay as soft fill or duck heavily (`uCloud` ↓, mix toward dark) so the map reads |
| **Dojo clocked** | Optional soft shell at low opacity **or** temple-only (v1 default: **temple-full + dojo optional low**) |
| **Decorative** | Optional; not required |
| **LOW** | Shell on if memory allows; lower segment count; never load 8k mercury |

**v1 lock:**  
- Temple: milky shell **required** (when asset loads).  
- Dojo: shell **optional** behind `CFG.skyMaps.dojoShell` default **false** (keep arena readable; user asked for “if we take away sky effects” — temple is that place).

### 4.3 Temple focus globe

On `setSkyTempleFocus` when focus is **transit body** with a map id:

```
scene (or camera-local rig)
 └─ templeGlobeRoot (Group)
     ├─ planetMesh (Sphere + equirect map)
     └─ ringMesh (Saturn only: RingGeometry + alpha map)
```

| Property | Recommendation |
|----------|----------------|
| Placement | **Camera-relative** or fixed mid-field: e.g. 8–14 m ahead of camera along look, slightly left of center so HUD on the right stays free |
| Size | Large: radius ~1.2–2.0 world units (reads as a hero prop, not a sky pin) |
| Geometry | `SphereGeometry(1, 48, 32)` (LOW: 24×16) |
| Material | `MeshBasicMaterial` or `MeshStandardMaterial` with soft ambient; keep cheap — Basic + slight emissive for sun |
| Map | Body-specific equirectangular JPG |
| Spin | Slow `rotation.y += dt * ω` artistic |
| Show / hide | Show on body focus; hide on sign / aspect / empty / exit temple |
| Natal focus | Optional dimmer “ghost globe” later; **v1 skip** (no separate natal maps) |
| Aspect focus | No dual globe; keep aspect HUD + highlight line only |

### 4.4 Body → map table

```js
const PLANET_MAPS = {
  sun:     'assets/sky/2k_sun.jpg',
  moon:    'assets/sky/2k_moon.jpg',
  mercury: 'assets/sky/2k_mercury.jpg',
  venus:   'assets/sky/2k_venus_atmosphere.jpg',  // atmosphere = sky-facing look
  mars:    'assets/sky/2k_mars.jpg',
  jupiter: 'assets/sky/2k_jupiter.jpg',
  saturn:  'assets/sky/2k_saturn.jpg',
  uranus:  'assets/sky/2k_uranus.jpg',
  neptune: 'assets/sky/2k_neptune.jpg',
};
// no maps: north_node, south_node, pluto → glyph-only
```

Saturn rings:

```js
ring: {
  map: 'assets/sky/2k_saturn_ring_alpha.png',
  // RingGeometry(inner, outer, segments); alphaTest or transparent:true
}
```

### 4.5 Texture loading

- Lazy load on first need (temple enter for shell; first body focus for planet).  
- `THREE.TextureLoader` with error → log once, stay glyph-only.  
- Cache textures in a module-level map; do not reload every focus.  
- `minFilter` / `magFilter` Linear; generateMipmaps true for 2k OK.  
- On LOW: still 2k but lower sphere segments; never auto-fetch 8k.

---

## 5. Interaction (temple)

| Event | Result |
|-------|--------|
| Focus transit body with map | Globe appears + study HUD (existing) |
| Focus body without map | HUD only |
| Focus sign / aspect / natal | Hide globe (aspect keeps study chip) |
| Clear focus / empty fire | Hide globe |
| Exit temple | Dispose visibility; keep textures cached |
| Pause / resume temple | Globe follows restored focus if body |

Globe is **not** a pick target in v1 (reticle still uses glyph/aspect rays). Optional later: click globe = same as body.

---

## 6. Procedural sky coexistence

When milky shell is full-strength in temple:

1. Duck `skyDomeMat` clouds (`uCloud` → 0 or low).  
2. Optionally darken dome uniforms so they do not wash the equirect map.  
3. Keep fog low impact (`fog: false` on shell).  
4. Do **not** delete dome (fallback if texture fails).

CFG:

```js
skyMaps: {
  enabled: true,
  milkyPath: 'assets/sky/8k_stars_milky_way.jpg',
  dojoShell: false,          // temple-only milky by default
  templeShellOpacity: 1,
  globeEnabled: true,
  globeRadius: 1.6,
  globeDistance: 11,
  spinRadPerSec: 0.08,
  saturnRings: true,
  venusMap: 'atmosphere',    // 'atmosphere' | 'surface'
}
```

---

## 7. Performance

| Tier | Shell segs | Globe segs | Notes |
|------|------------|------------|-------|
| Desktop | 64×32 | 48×32 | Default 2k maps |
| MOBILE | 48×24 | 32×24 | Same 2k files |
| LOW | 32×16 | 24×16 | Prefer skip shell if FPS tanks (CFG) |

Total new VRAM rough: milky ~2 MB + active planet ~0.5–1 MB + cache of visited bodies. Acceptable.

---

## 8. Implementation map

| Concern | Anchor |
|---------|--------|
| Asset paths | `assets/sky/*` committed |
| Shell mesh | build once after THREE ready; parent `skySphere` |
| Globe rig | parent `scene` or camera-facing group updated each frame in temple |
| Focus hook | `setSkyTempleFocus` / `exitSkyTemple` |
| Loader | small helper `loadSkyTexture(url)` with cache |
| Tests | contract: paths exist in HTML/CFG; body map table; missing body no throw; temple-only globe gate |

Optional module: `sky-maps.js` (UMD like `sky-temple.js`) for table + loader — keeps `index.html` thinner.

---

## 9. Acceptance

1. After `git add assets/sky`, all maps used by code are tracked.  
2. Temple enter: milky equirect shell visible as surrounding space (inner sphere).  
3. Focus Mars (map present): large Mars globe appears with equirect texture.  
4. Focus Saturn: ball + alpha rings.  
5. Focus Venus: atmosphere map by default.  
6. Focus north_node / sign / aspect: no erroneous globe (or hide previous).  
7. Exit temple: globe hidden; dojo not forced into full milky unless `dojoShell`.  
8. Missing file: no throw; glyph + HUD still work.  
9. LOW mode does not load `8k_mercury.jpg`.  
10. `git diff --check` clean; assets not gitignored.

---

## 10. Phased delivery

| Phase | Ship |
|-------|------|
| **TO0** | Copy maps → `assets/sky/`, commit assets, README credit |
| **TO1** | Milky shell on `skySphere`, temple opacity full |
| **TO2** | Temple body globe + map table + lazy load |
| **TO3** | Saturn rings + sun emissive polish |
| **TO4** | Optional dojo soft shell / Venus surface toggle |

---

## 11. Summary

> **Equirectangular NASA-derived maps on spheres:** milky way as the inner sky shell you sit inside; temple body focus summons a large textured planet globe. No reprojection — SphereGeometry UVs already match equirectangular.
