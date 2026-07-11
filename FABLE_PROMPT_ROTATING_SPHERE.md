# Fable prompt — rotating celestial sphere (Parcel G)

Copy everything below the line into Fable. Working directory: **aim-dojo**.

---

## Mission

Fix the sky so it matches the user’s mental model: **one sphere**, stars + planets fixed to each other, **sphere rotates** (theatre or real), **horizon** shows diurnal vs nocturnal sides of the chart. If ☉ is in Leo, **Leo travels the day sky with the sun**. Stop always-up dual ☉+☽ wallpaper.

Skill game untouched. Craft latitude inside hard rails.

## Required reading (first)

1. **Plan (source of truth):** `SPEC_PERSONAL_PLANETARIUM_V2_1.md`  
   Read §0–6, §7 Parcel G, §9. **Plan wins** over v2 where spin/horizon conflict.

2. **v2 kept features:** `SPEC_PERSONAL_PLANETARIUM_V2.md` — sticks, Δ, seals ≤8, dayAtmos ~30%, skypack load — **do not rip out**, **re-parent and re-spin**.

3. **Identity:** `CONTINUATION_PROMPT.md` — rhythm sacred, zen, LOW, `node --check`.

4. **Optional math mirror:** when present,  
   `/mnt/c/Users/rober/Downloads/Projects/sidereal/src/sidereal/sky_sphere.py`  
   and `docs/sky_sphere_v2_1.md` or README — match formulas or document constant offset.

## What’s wrong today (fix these)

- Chart/sticks on a **static** elevated band → ☉ and ☽ both always “up,” not moving with day.
- Theatre advances **lighting** while constellations **sit still**.
- User wants **whole sphere rotating**; epoch longitudes only set place *on* the sphere.

## Scope — Parcel G

| ID | Deliverable |
|----|-------------|
| G1 | One parent group for sticks + chart + luminaries |
| G2 | Theatre/real spin rotates **that group**; epoch lons fixed in local frame |
| G3 | Horizon culling; retire always-up primary placement |
| G4 | ☉/☽ visibility from elevation; lighting from ☉ elev |
| G5 | `clocked` and `clocked_chart` share spin path |
| G6 | Freeze pins sphere angle |
| G7 | decorative + LOW + no rhythm regression |
| G8 | Math aligned with Codex reference when available |

## Hard rails

1. Aesthetic only — no gameplay systems read chart/spin.  
2. Floor not a chart.  
3. **Do not** accelerate planet longitudes with theatre (no sliding ☉ through the zodiac each 300s).  
4. **Do** accelerate **sphere orientation** with theatre so sunsets and full-chart reveal work.  
5. Privacy / no personal pack commit.  
6. `decorative` keeps legacy feel.  
7. Single-file + fixtures; syntax-check clean.

## Creative latitude

- Exact Three.js hierarchy names, glow materials, epsilon for horizon.
- Soft fade vs hard hide below horizon.
- Whether night still shows a faint under-horizon whisper (prefer **hide** for clarity).
- Pole tilt / ecliptic tilt if it reads better — document if you deviate from Codex frame.
- Keep Δ/seal layout readable when bodies are near horizon.

## Technical guidance

### Hierarchy

```text
scene
  skySphere          ← apply diurnal rotation HERE each frame
    stickGroup
    chartSkyGroup    ← movers, ghosts, Δ, seals, band
    sunGlyph (+ glow)
    moonGlyph (+ glow)
  skyDome            ← atmosphere; tint from ☉ elev after spin (world space)
```

(Dome may stay unparented; **must not** be the only thing that “moves” with day.)

### Epoch vs spin

```text
// once when pack loads (sphere local):
position = eclipticDir(lon) * R

// every frame:
skySphere.rotation.y = radians(sphereAngleDeg(spinPhase, sunLon))
// spinPhase from theatre (CFG.skyTheatreSec) or civil; FREEZE pins spinPhase
// sunLon from pack mover sun — NOT from spinPhase
```

### Horizon

After world matrix update, if `worldY < yHorizon` → hide glyph/label/seal for that body.  
Stick lines: skip or fade segments under horizon.

### Lighting

- `dayAmt` / atmosphere from **transformed ☉** elevation (smoothstep), ~30% day atmosphere weight in clocked\* (v2 D7).  
- Remove or disable dual path that places art sun 180° from moon on an independent orbit **in clocked\***.

### Modes

- `clocked`: sphere + sticks + ☉/☽ + spin + horizon; no natal Δ/seals required.  
- `clocked_chart`: same + pack layer.  
- Need sun lon even in `clocked` without full pack: from pack if loaded, else approximate or keep discs only until pack exists — document fallback; prefer loading minimal sun from same skypack channels when available.

### Verify

```bash
F=index.html
o=$(grep -nE "^<script>$" "$F" | tail -1 | cut -d: -f1)
c=$(grep -nE "^</script>$" "$F" | tail -1 | cut -d: -f1)
sed -n "$((o+1)),$((c-1))p" "$F" > /tmp/g.js && node --check /tmp/g.js
```

Manual checklist (for your write-up; user is visual verifier):

1. Theatre running: sticks **move** with ☉.  
2. Night: ☉ below / hidden; other zodiac sector up.  
3. Not permanent dual ☉+☽.  
4. Δ still ~138° for sun when pack is bobby v2; seals ≤8 when up.  
5. decorative OK.

Do **not** push unless asked.

## Definition of done

- [ ] G1–G8 per plan  
- [ ] Constellations are not a fixed wallpaper under theatre  
- [ ] Horizon enforces day/night sides of the chart  
- [ ] Rhythm/grep isolation intact  
- [ ] `node --check` clean  
- [ ] Note `CFG.skyTheatreSec` still tunes **spin** speed  

## Suggested order

G1 → G2 → G3 → G4 → G5 → G6 → G7 → G8

**Begin:** read v2.1 plan §0 and §4, then re-parent the sky (G1).
