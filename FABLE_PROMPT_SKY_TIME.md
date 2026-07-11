# Fable prompt — natural vs theatre spin (Parcel I)

Copy everything below the line into Fable. Working directory: **aim-dojo**.

---

## Mission

Add a **spin-rate** control so the rotating celestial sphere can run at **real wall-clock pace** (`natural`) or **accelerated full-day** (`theatre`). Defaults: **natural** for `clocked` and `clocked_chart`. Keep `clocked` excellent **without birth data**. Do not break the one-sphere / horizon model from Parcel G.

## Required reading (first)

1. **Plan (source of truth):** `SPEC_PERSONAL_PLANETARIUM_V2_2.md` — entire short doc. **Plan wins.**
2. **Context:** `SPEC_PERSONAL_PLANETARIUM_V2_1.md` §2–4 (sphere model — do not regress).
3. **Code:** `index.html` — `SKY_MODE`, `dayPhase` / theatre integrate near `updateSky`, `CFG.skyTheatreSec`, `clockedDayPhase`, freeze.

## Scope — Parcel I only

| ID | Deliverable |
|----|-------------|
| I1 | Resolve + persist `skyTime` (`natural` \| `theatre`) |
| I2 | Natural: spin from civil clock, no `dt/skyTheatreSec` integrate |
| I3 | Theatre: keep accelerated integrate |
| I4 | Defaults per plan §3 |
| I5 | Freeze behavior |
| I6 | Verify syntax + isolation |
| I7 | URL matrix in a code comment (and README only if already documenting sky) |

## Out of scope

- sidereal / skypack  
- Changing stick catalog, Δ, seals, tilt, horizon math (unless a one-line bug blocks natural)  
- New pause-menu UI (URL + localStorage only)  
- Flipping global default from `decorative` to `clocked` (do not, unless plan is updated)  
- Push unless user asks  

## Hard rails

1. Aesthetic only — no gameplay reads of skyTime.  
2. **Longitudes never advance with spin** (theatre or natural).  
3. `decorative` path byte-stable in behavior (own art clock).  
4. Zen: no toast spam; no big settings panel.  
5. `node --check` clean.

## Implementation sketch

### Resolve (boot, once)

```text
SKY_TIMES = ['natural','theatre']

fromUrl:
  ?skyTime=natural|theatre
  or ?theatre=1 → theatre
  or ?theatre=0 → natural

if fromUrl: localStorage aimdojo.skyTime = value
else: localStorage if valid
else: if SKY_MODE is clocked or clocked_chart → 'natural'
      else → ignored
```

Expose something like `const SKY_TIME = ...` next to `SKY_MODE`.

### updateSky branch (clocked* only)

**Today (wrong for default):** always  
`dayPhase += dt * tSpeed / CFG.skyTheatreSec`

**v2.2:**

```text
if decorative:
  existing art dayCycleSec path
else if SKY_TIME === 'natural':
  if !skyFrozen:
    dayPhase = clockedDayPhase(Date.now())   // or equivalent civil fraction matching noon policy
  // when frozen: leave dayPhase pinned
else: // theatre
  if !skyFrozen:
    dayPhase = (dayPhase + dt * tSpeed / CFG.skyTheatreSec) % 1
```

Boot seed: for **theatre**, keep seeding `dayPhase` from civil once so a noon session starts near noon then accelerates. For **natural**, continuous civil drive makes seed redundant (still OK to init from civil).

### Freeze

- **Natural:** freeze pins phase; unfreeze → next frame takes live `Date.now()` again.  
- **Theatre:** freeze pins integrated phase; unfreeze resumes integrate from there (current behavior).

### Comments

Update the ROTATING SPHERE / hybrid-clock comments so they no longer say clocked* is always theatre. List URL matrix once near `SKY_MODE` / `SKY_TIME`.

## Creative latitude

- Whether natural uses the same `tSpeed` easing curve or pure civil fraction (prefer **pure civil** for honesty).  
- Smooth display interpolation is unnecessary if phase is continuous from Date.  
- Alias `?fastsky=1` → theatre only if you want; not required.

## Verify

```bash
F=index.html
o=$(grep -nE "^<script>$" "$F" | tail -1 | cut -d: -f1)
c=$(grep -nE "^</script>$" "$F" | tail -1 | cut -d: -f1)
sed -n "$((o+1)),$((c-1))p" "$F" > /tmp/g.js && node --check /tmp/g.js
```

Manual checklist for write-up:

1. `?sky=clocked` → natural (slow real sky).  
2. `?sky=clocked&theatre=1` → fast day.  
3. `?sky=clocked_chart` → natural + chart.  
4. `?sky=clocked_chart&skyTime=theatre` → fast + chart.  
5. decorative OK.  
6. Freeze works for both rates.

Do **not** push unless asked; leave commit-ready.

## Definition of done

- [ ] I1–I7 complete per plan  
- [ ] clocked\* default natural  
- [ ] theatre opt-in via URL/storage  
- [ ] sphere model from G intact  
- [ ] `node --check` clean  

**Begin:** read `SPEC_PERSONAL_PLANETARIUM_V2_2.md`, then implement I1 next to `SKY_MODE`.
