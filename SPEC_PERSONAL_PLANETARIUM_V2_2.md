# Personal Planetarium v2.2 — Natural vs Theatre Spin

**Status:** approved direction (2026-07-11), **not implemented**  
**Builds on:** v2.1 rotating sphere (`SPEC_PERSONAL_PLANETARIUM_V2_1.md`, Parcel G shipped)  
**Canonical path:** `aim-dojo/SPEC_PERSONAL_PLANETARIUM_V2_2.md`  
**Sidereal:** no work required (spin rate is client-only)

---

## 0. Why v2.2

After Parcel G, `clocked` and `clocked_chart` both advance the celestial sphere at **theatre** speed (`CFG.skyTheatreSec` ≈ 300s per full day), only *seeded* from civil time at boot. That makes every non-decorative mode feel accelerated.

User feedback:

1. There should be a mode where **time runs at real pace** (wall clock).
2. **`clocked` without birth data** is a valued product: zodiac sticks + real-ish ☉/☽ as an upgrade over procedural stars — keep and default it toward honesty, not only spectacle.

---

## 1. Rails (unchanged)

- Skill loop untouched; aesthetic only; no floor chart; natal privacy local.
- One sphere: sticks + luminaries (+ chart layer when present) co-rotate; epoch longitudes do not advance with spin.
- Horizon culls; lighting from transformed ☉ elevation.
- `decorative` keeps legacy procedural / art-disc sky.

---

## 2. Two axes

| Axis | Values | Meaning |
|------|--------|---------|
| **Sky content** `sky` | `decorative` \| `clocked` \| `clocked_chart` | What is on the sphere |
| **Spin rate** `skyTime` | `natural` \| `theatre` | How fast the sphere turns |

```text
                    no natal              + natal (local pack)
real pace           clocked               clocked_chart
                    + natural             + natural

fast day            clocked               clocked_chart
                    + theatre             + theatre
```

**Invariant:** `skyTime` never moves planets *relative to* constellations; it only changes `spinPhase` advancement rate (and thus what is above the horizon when).

---

## 3. Locked defaults (user-facing)

| Mode | Default `skyTime` | Rationale |
|------|-------------------|-----------|
| `decorative` | n/a (own `dayCycleSec` art clock) | Legacy |
| `clocked` | **`natural`** | Real sky while training; no birth required |
| `clocked_chart` | **`natural`** | Honest personal sky under real time |
| Either clocked\* | opt-in **`theatre`** | Full day in ~`skyTheatreSec`; nocturnal side on demand |

---

## 4. Resolution order

### 4.1 Sky content (existing)

```text
?sky=decorative|clocked|clocked_chart
  > localStorage aimdojo.skyMode
  > default decorative   // keep public deploy safe unless product later flips default
```

**Product note:** A later decision may default first-time users to `clocked`+`natural`; **out of scope for v2.2** unless trivial. This plan only fixes spin rate + flags.

### 4.2 Spin rate (new)

```text
?skyTime=natural|theatre
  > ?theatre=1 | ?theatre=0   // aliases: theatre=1 → theatre, theatre=0 → natural
  > localStorage aimdojo.skyTime
  > default: natural when sky is clocked or clocked_chart
             (ignored for decorative)
```

If URL sets `skyTime` or `theatre`, persist to `aimdojo.skyTime` (same pattern as sky mode).

---

## 5. Behavior

### 5.1 Natural

- Each sky tick (when not frozen):

```text
spinPhase = civilDayFraction(now)   // same mapping as current clockedDayPhase / noon policy
```

- Do **not** integrate `dt / skyTheatreSec`.
- Sphere orientation tracks wall clock continuously (second-smooth if cheap; minute-smooth OK).
- Freeze: pin the civil-derived phase at freeze instant; on unfreeze, snap back to live civil (document; matches “resume to now” expectation).

### 5.2 Theatre

- Keep current behavior: seed from civil at boot (or on mode enter), then

```text
spinPhase += dt * speedCurve / CFG.skyTheatreSec
```

- Freeze pins theatre phase.
- `CFG.skyTheatreSec` remains the “seconds per full sphere turn” knob (default 300).

### 5.3 Shared

- `sphereAngle = f(spinPhase, sunLon)` unchanged from G.
- Pack epoch / Meeus luminaries unchanged.
- Day atmosphere ~30%, Δ, seals, horizon — unchanged.

---

## 6. UX (zen)

- **No required new pause-menu control** for v2.2 if URL + localStorage suffice.
- Optional one-line pause hint later: `SKY · NATURAL` / `SKY · THEATRE` — only if zero clutter cost; not required.
- Toast: at most one quiet line when switching via URL is overkill; skip unless already have sky toasts.
- README / SPEC comment block listing:

```text
?sky=clocked                 natural sky, no birth data
?sky=clocked&theatre=1       accelerated day
?sky=clocked_chart           natural + natal (needs pack)
?sky=clocked_chart&theatre=1 accelerated + natal
?sky=decorative              legacy procedural
```

---

## 7. Work parcel

### Parcel I — Fable only (aim-dojo)

**Prompt:** `aim-dojo/FABLE_PROMPT_SKY_TIME.md`

| ID | Task | Done when |
|----|------|-----------|
| I1 | Parse `skyTime` / `theatre` aliases; persist `aimdojo.skyTime` | Resolution §4.2 |
| I2 | Natural path: spinPhase from civil clock each update (no theatre integrate) | Real pace |
| I3 | Theatre path: keep existing accelerated integrate | 300s day still works |
| I4 | Defaults: clocked\* → natural; decorative ignores skyTime | §3 |
| I5 | Freeze behavior per §5.1–5.2 | Documented in comment |
| I6 | `node --check`; decorative isolation; no gameplay coupling | Clean |
| I7 | Short comment or README snippet for URL matrix | Discoverable |

**No Codex / sidereal work.**

---

## 8. Acceptance

- [ ] `?sky=clocked` with no theatre flag: sphere moves at **real** day rate (imperceptible over seconds; clear over minutes / by comparing to wall clock position of ☉).
- [ ] `?sky=clocked&theatre=1` (or `skyTime=theatre`): full day in ~`skyTheatreSec`.
- [ ] Same pair for `clocked_chart`.
- [ ] Default after clear storage + `?sky=clocked`: natural, not theatre.
- [ ] decorative unchanged.
- [ ] Freeze + unfreeze sensible for each rate.
- [ ] Skill systems untouched.

---

## 9. Out of scope

- Making `clocked` the site-wide default (optional follow-up).
- Pause UI chrome for skyTime (optional follow-up).
- Sidereal API / skypack changes.
- Changing tilt, horizon, or Δ/seals.

---

## 10. Agent prompt index

| Agent | File |
|-------|------|
| **Fable** | `aim-dojo/FABLE_PROMPT_SKY_TIME.md` |

**This document wins** on spin-rate defaults if older specs said “theatre default for play.”
