# Personal Planetarium v2.1 — Rotating Celestial Sphere

**Status:** Parcel G shipped (rotating sphere).  
**Next:** **`SPEC_PERSONAL_PLANETARIUM_V2_2.md`** — natural vs theatre spin rate (default natural).  
**Supersedes in part:** `SPEC_PERSONAL_PLANETARIUM_V2.md` hybrid-clock *interpretation*  
**Keeps from v2:** skypack v2 fields (Δ, resonance_rank), 13 sticks, ☉/☽ as luminaries, Δ always on, any-hit seals ≤8, day atmosphere ~30%, no floor chart, aesthetic only  
**Canonical path:** `aim-dojo/SPEC_PERSONAL_PLANETARIUM_V2_1.md`  
**Sidereal pointer:** `sidereal/SPEC_PERSONAL_PLANETARIUM_V2_1.md`

---

## 0. Why v2.1

v2 playtest feedback:

| Observed | Problem |
|----------|---------|
| `clocked_chart`: ☉ **and** ☽ both up, **not moving** | Chart painted on an always-visible elevated band; no horizon; no diurnal spin of the pattern |
| `clocked`: day/night light moves, but **constellations stay put** | Theatre spun **lighting only**; sticks were wallpaper |
| User intent | **Whole sky is a sphere that rotates.** If ☉ is in Leo, **Leo traverses the day sky** with the sun. Day shows the **diurnal** half of the chart; night the **nocturnal** half |

### Corrected invariant

```
Positions on the sphere never lie (epoch longitudes among the stars).
The sphere rotates (diurnal / theatre).
The horizon chooses what you see.
```

**Not:** fixed screen stickers + independent light clock.  
**Yes:** stars, natal points, and planets fixed *to each other* on one sphere; spin carries them past the horizon together.

v2 phrase *“lights may perform; positions never lie”* is **amended**:

| Layer | Truth |
|-------|--------|
| **Epoch** | Where each body sits **on** the sphere (ecliptic lon from skypack / real now) — slow, real |
| **Diurnal spin** | Orientation of the **entire** sphere vs horizon — real 24h or **theatre**-accelerated |
| **Lighting** | Driven by **whether ☉ is above the horizon** (and how high), not by a second fake sun path that disagrees with the glyph |

Theatre still exists for gameplay sunsets and to reveal the full chart over a session — but it must **speed the sphere**, not only the dome tint while constellations sit still.

---

## 1. Rails (unchanged)

- Moon Chorus skill loop untouched (spawn/fire/groove/score).
- Floor = night grid / day checker only — **no chart on the ground**.
- Aesthetic only; no difficulty DNA; no predictions.
- Natal privacy local; no pack on leaderboards/share/Supabase.
- `decorative` default may keep legacy art sky (random stars + disc orbit) for public deploy.
- No Swiss Ephemeris in the browser.

---

## 2. Locked model (user-confirmed)

1. **One celestial sphere** (`skySphere` / equivalent): parent for zodiac sticks, ecliptic band, movers, natal ghosts, ☉/☽, Δ labels, seals (and optional dotted arcs).
2. **Fixed relative pattern** at a given epoch: sun-in-Leo means ☉ and Leo share that sector of the sphere.
3. **Diurnal rotation** of the whole group about a polar axis (dojo-simplified OK — see §4).
4. **Horizon culling:** bodies/sticks with elevation below horizon are hidden or strongly suppressed — **not** lifted into a permanent “always up” band.
5. **Day:** ☉ above horizon → diurnal side of sky/chart visible (Leo rides with ☉ if ☉ is in Leo).  
   **Night:** ☉ below → nocturnal side up; ☉ not in the sky.
6. **☽** only “in the sky” when **its** point is above the horizon (can still be up by day as a real daytime moon — geometry decides, not “always draw both”).
7. **Theatre:** accelerates **sphere spin** (and thus sunrises/sets of the real ☉ position on the sphere). Does **not** slide planets relative to constellations.
8. **Epoch updates** (pack refresh / later live API) move bodies **along** the ecliptic among the stars; spin is separate.
9. **Δ / seals** stay attached to transit bodies on the sphere; they rotate into/out of view with the sphere (feature, not a bug).
10. Day atmosphere ~30% weight still desired when sun is up; glyphs readable but sky not chalky.

---

## 3. Modes

| Mode | Sphere + sticks | Natal Δ/seals | Spin | ☉/☽ |
|------|-----------------|---------------|------|-----|
| `decorative` | Legacy OK (v1 art) | Off | Legacy disc orbit / random stars | Art discs |
| `clocked` | Yes | No | Theatre default (or real) | Glyphs on sphere @ real/pack lon; horizon |
| `clocked_chart` | Yes | Yes | Same spin as clocked | Same + ghosts/Δ/seals on sphere |

URL / `aimdojo.skyMode` unchanged.

**Sky freeze:** freezes **sphere angle** (and thus the visible sky), not a separate light-only phase. Optional: also freeze epoch if live updates exist later.

---

## 4. Projection & spin (implementation contract)

### 4.1 Placing a body on the sphere

Given ecliptic longitude λ (and lat β ≈ 0 for v2.1 unless moon lat available):

- Map (λ, β) → unit direction in a **sphere-local** frame where the ecliptic is a great circle (or a documented thin strip).
- Prefer a mapping where **half the ecliptic can go below the horizon** after world transform — required for day/night sides.
- v2’s permanent “elevated sinusoid so nothing is buried” is **retired for clocked\*** chart placement.

Obliquity / polar tilt: **simplified dojo model is OK** if documented:

- Minimal acceptable: ecliptic as equator of `skySphere`, rotate sphere about world **up** (Y). Not geodetic LST, but Leo still rides with ☉.
- Better (optional same parcel if cheap): tilt sphere so ecliptic inclination reads nicer; still one spin DOF for theatre.

### 4.2 Diurnal angle

Define sphere yaw (or equivalent) so that:

- At **theatre/local solar noon**, ☉ is near **highest elevation** (meridian / south / top of arc — pick one and stick to it).
- As spin advances through a full turn, ☉ rises and sets once per cycle; constellations co-rotate.

Sketch:

```text
sphereAngle(t) = noonAnchor - sunLon + spinPhase(t) * 360°
```

where `spinPhase` is real civil day fraction or theatre phase in [0,1), and `sunLon` is current epoch solar ecliptic longitude from pack/movers.

**Critical:** `spinPhase` advances with theatre; `sunLon` does **not** advance with theatre (only with epoch).

### 4.3 Horizon

- Horizon ≈ plane y = eye/floor convention already in scene (document: world up, listener at origin).
- `aboveHorizon(worldPos) => worldPos.y > yHorizon` (small epsilon).
- Below: `visible = false` or opacity ~0; do not keep drawing full-bright glyphs under the floor.
- Stick segments: hide or clip if both endpoints below; optional mid-fade.

### 4.4 Lighting

- Dome day/night amount from **☉ elevation** after spin (smoothstep on sunY), not from an independent disc on a second orbit that disagrees with the glyph.
- Directional light from ☉ direction when above horizon; soft night fill when below.
- Atmosphere weight ~30% when “day” by sun elevation (carry forward v2 D7 intent).

### 4.5 Luminaries

- Single ☉ glyph = the sun (glow underlay OK).  
- Single ☽ glyph = the moon.  
- No second art disc on a disconnected path in clocked\*.  
- If both above horizon geometrically (daytime moon), both may show — **only then**.

---

## 5. What stays from v2 (do not regress)

- Zodiac-13 sticks incl. Ophiuchus, lines only, no words (`fixtures/zodiac_sticks_v1.json` or successor).
- Δ always on (soft), shortest arc; prefer `same_body_delta`.
- Any-hit seals max 8, tightest-first; optional dotted arcs default off.
- Skypack v2: `schema_version` 2, `same_body_delta`, `resonance_rank`, v1 arrays intact.
- LOW / reduceMotion degradation; no gameplay coupling.
- Personal `skypack.json` gitignored.

---

## 6. Explicit anti-goals for this pass

- Do **not** keep always-up elevated band as the primary chart placement.
- Do **not** spin dome tint while leaving `stickGroup` / chart bodies world-fixed.
- Do **not** show ☉ and ☽ always-on regardless of horizon.
- Do **not** accelerate planet **longitudes** with theatre (no fake ephemeris carousel).
- Do **not** put the chart on the floor to “fix” night side.
- Full LST/lat/lon horizon astronomy still **optional later** (v3); simplified sphere spin is enough for v2.1 acceptance.

---

## 7. Work parcels

### Parcel F — Codex (sidereal) — small, literal reference math

**Repo:** `sidereal`  
**Prompt:** `sidereal/CODEX_PROMPT_SKY_SPHERE.md`

| ID | Task | Done when |
|----|------|-----------|
| F1 | Pure helpers: shortest-arc (exists), **sphere direction from ecliptic lon/lat**, **diurnal sphere angle** given `spin_phase∈[0,1)`, `sun_lon_deg`, noon policy | Unit tests with fixed numbers |
| F2 | Helper: **elevation after spin** / `above_horizon` in the simplified frame | Tests: at noon sun elev max; at noon+0.5 sun below horizon |
| F3 | Short doc section in README or `docs/sky_sphere_v2_1.md`: frame diagram + formulas Fable must mirror | Written |
| F4 | No aim-dojo edits; skypack schema **unchanged** unless a tiny optional `epoch_utc` note only | Pack tests still green |

**Must not:** reimplement full Swiss horizon; change Midpoint boundaries; add essays to skypack.

### Parcel G — Fable (aim-dojo) — primary visual fix

**Repo:** `aim-dojo`  
**Prompt:** `aim-dojo/FABLE_PROMPT_ROTATING_SPHERE.md`

| ID | Task | Done when |
|----|------|-----------|
| G1 | Single `skySphere` (name flexible) parents sticks + chart + luminaries | One transform drives all |
| G2 | Diurnal / theatre spin applies to **sphere**, not light-only; epoch lons fixed in sphere frame | Leo rides with ☉ |
| G3 | Horizon culling; retire always-up band as primary | Night side can go under floor |
| G4 | ☉/☽ only when above horizon; lighting from ☉ elevation | No permanent dual luminary |
| G5 | `clocked` and `clocked_chart` share spin; chart extras only on chart mode | Consistent sky |
| G6 | Freeze pins sphere angle | Study pause works |
| G7 | decorative isolation; LOW OK; rhythm untouched | Defaults safe |
| G8 | Align spin math with Codex reference (or document intentional simplification if off by constant) | Comment + sanity check |

**Must not:** gameplay coupling; floor chart; ship personal pack; push unless asked.

### Parcel H — Integration (human / either after F+G)

| ID | Check |
|----|--------|
| H1 | Sun in Gemini/Leo sector: that stick figure **crosses the day sky** with ☉ under theatre |
| H2 | At theatre night, ☉ gone; other ecliptic sector up; natal Δ on that side visible if in chart mode |
| H3 | Not both ☉ and ☽ unless geometry says so |
| H4 | Constellations are not a fixed wallpaper during spin |
| H5 | decorative unchanged; skill loop unchanged |

---

## 8. Dependency graph

```
F1–F3 (reference math + doc) ──► optional for G, G can start with §4 sketch
G1 sphere parent ──► G2 spin ──► G3 horizon ──► G4 luminaries/lighting ──► G5–G8
H* after G4+
```

Parallel: F\* ∥ G1 early structure.

---

## 9. Acceptance checklist

- [ ] In `clocked` / `clocked_chart`, advancing theatre moves **constellations and planets together**.
- [ ] ☉ position among sticks matches pack solar lon (epoch); spin does not change that adjacency.
- [ ] Full theatre day: ☉ rises and sets once; day sky shows sun-side chart; night shows opposite side.
- [ ] ☽ not permanently glued opposite/beside ☉ independent of horizon.
- [ ] No always-visible full 360° of glyphs at once (horizon hides ~half).
- [ ] Δ/seals still work when their bodies are up; sealed count still ≤8.
- [ ] `decorative` default feel preserved.
- [ ] No skypack/chart reads in spawn/fire/groove/score.
- [ ] Codex unit tests for sphere angle / noon elev green; Fable `node --check` clean.

---

## 10. Out of scope (later)

- Observer lat/lon, true LST, atmospheric refraction.
- Full non-zodiac sky catalog.
- Live multi-minute epoch refresh (nice).
- Scrub slider for sphere angle (freeze is enough for v2.1).
- Synastry multiplayer.

---

## 11. Agent prompt index

| Agent | File |
|-------|------|
| **Codex** | `sidereal/CODEX_PROMPT_SKY_SPHERE.md` |
| **Fable** | `aim-dojo/FABLE_PROMPT_ROTATING_SPHERE.md` |

**This document wins** over prompts and over v2 where they conflict on spin/horizon. v2 remains source for Δ/seals/sticks content and skypack v2 fields.
