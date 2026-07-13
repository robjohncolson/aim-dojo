# Local Sky — natural mode as real observer sky (Parcel LS)

**Status:** planned  
**Version:** 1.0 · 2026-07-13  
**Repos:** Moon Chorus (`aim-dojo`) primary; optional small `sky-day` query extensions in sidereal  
**Depends on:** existing clocked sphere (`skySphere`, sky-day movers, sticks), SKY_TIME natural/theatre  
**Product goal:** In **natural** mode the sky should feel like **Stellarium** for the player’s location and wall-clock time: sun height and body azimuths match local reality. **Theatre** stays the accelerated art mode.

---

## 0. Problem (current)

| What we do today | Why Lexington ~3pm feels wrong |
|------------------|--------------------------------|
| Bodies placed by **ecliptic longitude** on sphere equator (`eclipticDir`) | Correct *relative* zodiac order, not horizon alt/az |
| Sphere spun by **civil day fraction** (`clockedDayPhase`: 06→0 · 12→.25 · 18→.5) so sun “culminates at noon” | Ignores **observer latitude** and true solar hour angle / declination |
| No lat/lon | Cannot reproduce real altitude of the sun |
| Moon near sun | **Often real** (ecliptic elongation); not automatically a bug |

Natural mode already uses wall-clock **pace** and (as of 2026-07) **defaults on** with **no freeze**. That is necessary but not sufficient for Stellarium-like truth.

---

## 1. Goals

1. **Natural = local sky** for a known observer: correct **altitude and azimuth** of at least ☉/☽, then all sky-day movers and co-rotating sticks/signs.  
2. **Observer location required for natural** — lat/lon from geolocation and/or pause form; persist locally (and optional cloud pref).  
3. **No freeze in natural** (already shipped) — R-CLICK still dismisses Listen only.  
4. **Theatre unchanged** — accelerated spin + freeze allowed; does not require lat/lon.  
5. **Natural is default** for new visitors (already shipped); users who saved theatre keep it.  
6. Graceful degradation: no location → natural still runs but shows a clear pause prompt and uses a documented fallback (device timezone + approximate mid-latitude **or** previous civil spin until location set — see §5).

---

## 2. Non-goals (v1)

- Atmospheric refraction refraction tables as precise as professional planetaria (simple refraction OK).  
- Precession/nutation beyond what sky-day / Swiss already provide.  
- Changing combat, groove pocket, or essay/brief pipelines.  
- Requiring a birth chart for natural sky (observer ≠ natal).  
- Perfect constellation outlines vs photographic sky (stick fixtures stay).  

---

## 3. Modes (locked)

| SKY_TIME | Time base | Orientation | Freeze | Location |
|----------|-----------|-------------|--------|----------|
| **natural** (default) | Wall clock (live) | **Local horizon frame** from lat/lon + UTC | **Off** | Required for accuracy; prompt if missing |
| **theatre** | Integrated spin at `skyTheatreSec` | Current ecliptic-sphere + noon-anchor spin | **On** (pretty) | Not required |

`SKY_MODE` `clocked` / `clocked_chart` / `decorative` stay as today; this parcel only changes how **natural** orients `skySphere` (and lighting) when `SKY_MODE !== 'decorative'`.

---

## 4. Observer model

### 4.1 Fields

```js
// persisted aimdojo.observerLat / aimdojo.observerLon (and optional accuracy)
observer: {
  lat: number,   // degrees, [-90, 90]
  lon: number,   // degrees, [-180, 180]
  source: 'geo' | 'manual' | 'default',
  updatedAt: number
}
```

### 4.2 Acquisition order

1. **Manual** pause values (always win if user saved them).  
2. Else **Geolocation** once (permission; timeout ~8s; non-blocking boot).  
3. Else **default**: `lat = 40`, `lon` from rough timezone offset guess **or** leave “location unknown” and show prompt.

Never send observer lat/lon to leaderboard, share, or dojo. Optional cloud pref column later (`observer_lat` / `observer_lon`) — v1 localStorage only is fine.

### 4.3 Pause UI

Under SKY MOTION (when not decorative):

```
SKY MOTION     [ NATURAL ▸ tap for THEATRE ]
LOCATION       [ Use my location ]  or  lat/lon inputs
               status: Lexington-ish / 38.0°N 84.5°W / not set
```

- Natural + no location: status **SET LOCATION FOR TRUE SKY** (rail-colored).  
- Geolocation denied: keep manual fields.  
- Theatre: location row can hide or show as “optional / used only in natural”.

---

## 5. Math (natural orientation)

### 5.1 Inputs per body

From existing sky-day / pack / Meeus fallback:

- Ecliptic or equatorial coordinates at epoch (prefer what pack already has: `lon_j2000`; convert if needed).  
- For v1 luminaries, if only ecliptic lon is available: convert ecliptic → equatorial with mean obliquity, then equatorial → horizontal.

**Server option (preferred for consistency):** extend public  
`GET /api/sky-day?tz=&lat=&lon=`  
to optionally include per-mover `alt_deg`, `az_deg` at `epoch_utc` for that observer (Swiss already on Railway). Client may still compute for smoothness between day-pack refreshes.

### 5.2 Horizontal frame (client world)

Define player local sky:

- **+Y** = zenith (up)  
- **+Z** = north (or south — pick one and document; recommend **+Z = south** if current boot camera faces −Z toward “out” and noon sun historically culminates that way; **measure against Stellarium** and lock).  
- **+X** = east (right-handed).  

For each body:

```
alt, az = horizontal coordinates (az from north, east positive — standard)
dir_world = (
  cos(alt)*sin(az),   // X east  — verify handedness against chosen az convention
  sin(alt),           // Y up
  cos(alt)*cos(az)    // Z north
)
```

Place glyph at `dir_world * R` **in world space** OR keep sphere-local ecliptic placement and set `skySphere.quaternion` so that the **sun’s** sphere-local vector maps to the sun’s true world direction (and the same rotation maps all co-located ecliptic content).  

**Recommended approach (minimal churn):**

1. Keep pack positions in **sphere-local ecliptic** as today (`eclipticDir(lon,0)`).  
2. Each natural tick, compute quaternion `q` that rotates the **local sun direction** onto **true local sun direction** (and preferably also aligns ecliptic pole with true celestial pole projected — full attitude).  
3. Ideal: full **equatorial-to-horizontal** matrix for the observer at `Date.now()`, applied as `skySphere.matrix` / quaternion chain replacing `_qSpin * _qBase` in natural only.

**Theatre** keeps today’s `_qSpin.setFromAxisAngle(SPH_POLE, sunA - _sunLonRad)` + `_qBase`.

### 5.3 Lighting

Continue: `sunDir` = transformed sun glyph direction (already). Day/night dome from `sunDir.y` — once alt is correct, **lighting tracks real sun height**.

### 5.4 Listen pick

Horizon cull and pick already use world-Y after sphere quaternion — they inherit local orientation for free if the sphere attitude is right.

---

## 6. Freeze / input rails

| Input | Natural | Theatre / decorative |
|-------|---------|----------------------|
| R-CLICK | Dismiss Listen only; **never** freeze sky | Dismiss Listen, else freeze (existing) |
| SKY MOTION toggle | natural ↔ theatre | same |
| Auto dayPhase | Always `clockedDayPhase` / true ephemeris time | integrate / decorative art |

No freeze button/toast in natural except optional one-shot `SKY FOLLOWS REAL TIME` (already).

---

## 7. Implementation parcels

### LS1 — Product rails (small, ship first if not done)

- Default `SKY_TIME = natural` ✓ (done)  
- Natural ignores `skyFrozen` ✓ (done)  
- Pause hint text for natural vs theatre  

### LS2 — Observer location UI + storage

- Pause location controls + geolocation  
- `localStorage` keys  
- Gate accuracy messaging  

### LS3 — True local orientation (core)

- Pure functions: `eclipticToEquatorial`, `equatorialToHorizontal(lat, lon, utc)`  
- Unit tests vs known vectors (e.g. sun near zenith at local solar noon tropics; sun low at high latitude winter)  
- Natural path: replace sphere spin with local attitude  
- Theatre path: untouched  

### LS4 — Optional sky-day alt/az

- `GET /api/sky-day?lat=&lon=` returns optional `alt_deg`/`az_deg` per mover  
- Client prefers server values when present + matching cache_date  

### LS5 — Validation

- Manual: Lexington lat/lon, ~15:00 local summer → sun altitude comparable to Stellarium (± a few degrees v1 OK)  
- Moon elongation matches sky-day lon delta  
- Theatre still pretty + freezable  
- No lat/lon in share/dojo  

---

## 8. Acceptance

1. New visitor (no prefs): **natural** on; sky clock tracks wall time; **R-CLICK does not freeze**.  
2. With location set to Lexington (~38°N, ~84.5°W), mid-afternoon summer: sun **high in sky**, not near horizon; elevation within ~5° of a trusted planetarium for v1.  
3. Near new moon: moon may sit near sun — matches ephemeris, not a bug.  
4. Theatre toggle: accelerated spin + freeze works as before.  
5. Location denied: game playable; pause shows need for manual lat/lon for true sky.  
6. Listen + combat unchanged aside from better body positions.  
7. Privacy: observer coords not in leaderboard/share/dojo.  

---

## 9. Risks / notes

- **Noon anchor vs true solar noon:** local mean solar time ≠ clock time (equation of time); v1 may use clock + longitude hour angle; document residual error.  
- **Camera facing:** boot view must stay consistent with az convention.  
- **Performance:** attitude update once per sky tick (~20 Hz) is cheap.  
- **Chart mode:** natal ghosts co-rotate with sphere — correct if sphere attitude is physical.  

---

## 10. Summary

> **Natural mode becomes a location-aware local sky: true sun height and body directions from lat/lon + now. Theatre stays art. No freeze in natural. Location is first-class pause data.**
