# Codex prompt — Local sky (natural = observer sky)

Copy everything below the line into Codex.  
**Primary working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`  
Optional server work: `/mnt/c/Users/rober/Downloads/Projects/sidereal`

---

## Mission

Make **natural** sky mode **location-aware** and **horizon-correct** (Stellarium-like for sun height and body directions), without breaking **theatre** (accelerated art spin + freeze).

**Spec wins:**  
`/mnt/c/Users/rober/Downloads/Projects/aim-dojo/SPEC_LOCAL_SKY.md`

Already done (do not regress):

- Default `SKY_TIME === 'natural'` when no saved pref  
- Natural forces live wall clock and **disables sky freeze**  
- R-CLICK still dismisses Listen  

---

## Required reading (first)

1. `SPEC_LOCAL_SKY.md`  
2. `index.html`: `SKY_TIME`, `clockedDayPhase`, `updateSky` sphere spin (`_qSpin` / `_qBase` / `_sunLonRad`), `eclipticDir`, sky-day load  
3. `CFG.skyDay` / public day pack movers  
4. Optional: sidereal `GET /api/sky-day` if implementing LS4  

---

## Scope

### Parcel LS2 — Observer location

| ID | Task |
|----|------|
| L2a | Persist `aimdojo.observerLat` / `aimdojo.observerLon` (+ source) |
| L2b | Pause UI under SKY MOTION: Use my location + manual lat/lon; status line |
| L2c | Geolocation non-blocking; fail soft to manual |
| L2d | Never put lat/lon in share/dojo/leaderboard |

### Parcel LS3 — Natural orientation (core)

| ID | Task |
|----|------|
| L3a | Pure convert: ecliptic ↔ equatorial ↔ horizontal for observer + UTC |
| L3b | Unit tests for converters (known cases; ±1° tolerance OK) |
| L3c | **Natural only:** set `skySphere` attitude from true local sky (sun alt/az correct); keep pack positions on ecliptic in sphere-local frame **or** document alternate placement |
| L3d | **Theatre / decorative:** leave existing spin + freeze path intact |
| L3e | Lighting continues to follow transformed sun direction |
| L3f | Without location: playable fallback + pause prompt (spec §4.3 / §5) |

### Parcel LS4 — Optional server alt/az

| ID | Task |
|----|------|
| L4a | Optional `lat`/`lon` on `GET /api/sky-day`; attach `alt_deg`/`az_deg` when provided |
| L4b | Client prefer server alt/az when present |
| L4c | Skip L4 if time-boxed after L3 works client-side |

### Out of scope

- Groove pocket, combat, sky brief/essay  
- Forcing reload for natural/theatre toggle  
- Perfect refraction / professional ephemeris in browser beyond existing data  

---

## Critical product rules

1. **Natural + location** → sun height matches local afternoon (validate Lexington-like lat ~38°N ~15:00 summer: sun **high**, not near horizon).  
2. **Natural → no freeze.**  
3. **Theatre → freeze OK.**  
4. Moon near sun when ephemeris says so is **correct**.  
5. Spec §5 handedness: **verify against Stellarium** and document the chosen az convention in a short code comment.  

---

## Verification

```bash
# aim-dojo
node --test tests/*.test.js

# if LS4 / pure py helpers in sidereal
# use project venv pytest as appropriate
```

Manual:

1. Clear `aimdojo.skyTime` → natural default.  
2. Set lat/lon ≈ Lexington → afternoon sun elevation plausible.  
3. Theatre toggle still spins + freezes.  
4. R-CLICK natural: no freeze; Listen still dismisses.  
5. No coords in share/dojo payloads.  

---

## Suggested commits

1. `Add observer location prefs and pause controls for natural sky.`  
2. `Orient natural skySphere from local alt/az (theatre path unchanged).`  
3. Optional: `Optional sky-day alt/az for observer lat/lon.`  

---

## Checklist

- [ ] LS2  
- [ ] LS3  
- [ ] LS4 optional  
- [ ] Spec §8 acceptance  
- [ ] No freeze regression in natural  
- [ ] Theatre regression OK  
