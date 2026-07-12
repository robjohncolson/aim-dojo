# Sky Listen + Grounded Arc — Implementation Plan

**Status:** approved direction (2026-07-11), **not implemented**  
**Repos:** Moon Chorus (`aim-dojo`) + true-sidereal desk (`sidereal` local API)  
**Canonical path:** `aim-dojo/SPEC_SKY_LISTEN.md`  
**Sidereal pointer:** `sidereal/SPEC_SKY_LISTEN.md`

---

## 0. Glossary (user-facing names)

| Phrase in chat | Meaning |
|----------------|---------|
| **Deep desk** | Informal name for the **sidereal** local web/CLI tool (`python -m sidereal serve` on **:8742**): charts, seeds, skypack, transit MD. Not a second game. |
| **Sky Listen** | This feature: aim at a celestial target + fire → study HUD (not a combat shot). |
| **Natural spin** | `skyTime=natural` (wall-clock sphere). Default for clocked\*. |

---

## 1. Product intent

When the sky is **real-time personal chart mode**, the player can **listen** to a planet or constellation by aiming and firing. A short study note appears from the **local sidereal API** (generic placement + personal transit meaning when natal is known). Combat projectiles that miss the sky still fly a **full ballistic path to the ground**.

### Non-goals

- No sky freeze required for Listen (user dislikes freeze-as-gate).
- No weather-as-difficulty; no predictions of events/health/money.
- No natal data uploaded to leaderboards/share/Supabase.
- No Swiss Ephemeris in the browser.
- Do not break arrival-timing skill loop for real combat shots.
- Decorative / plain clocked without chart: Listen **off** (v1 of this feature).

---

## 2. When Listen is available

**All** of the following must hold:

| Gate | Value |
|------|--------|
| `SKY_MODE` | **`clocked_chart` only** |
| `SKY_TIME` | **`natural` only** (real wall-clock sky) |
| Sidereal API | Reachable at localhost (see §6); soft-fail if down |
| Target | Pickable body/constellation **above horizon** |
| Combat conflict | **No active orb** under reticle within pick radius (pattern **#3**) |

If any gate fails → normal **projectile fire** (grounded arc, §5).

**URL reference (desk):**  
`http://127.0.0.1:8931/?sky=clocked_chart`  
(with natural default; do not require `theatre=1`). Theatre mode: Listen **disabled** (avoids study under accelerated fake day; user can still play).

---

## 3. Interaction (pattern #3)

```
On fire input:
  if ListenAvailable and pickCelestial(reticle):
      do NOT spawn projectile
      do NOT count shot / streak / clank / whiff
      draw brief Listen line: muzzle → body
      when HUD ready (or after short max line life): hide line
      show HUD with interpretation
      apply emphasis (gold constellation, oversized planet)
  else:
      normal fire → projectile with ground-completing arc
```

### Listen line

- Origin: **same point as parabolic prediction arc origin** (muzzle / bottom-right shot origin used by `computeShotPlan`).
- End: world position of selected celestial target.
- Style: thin Moonline / soft additive; duration ~0.2–0.45s or until HUD paints, whichever first.
- Not a damage ray; not an orb hit.

### Pick priority

1. Transit planet (mover / luminary) within N screen px of reticle center  
2. Else constellation / sign sector (centroid or sign glyph)  
3. Else no pick → combat fire  

Below horizon: not pickable.

### Emphasis (while selection active)

- **Constellation:** selected figure sticks + stars → gold; others dim slightly.  
- **Planet:** glyph replaced by **oversized globe billboard** (~normal ☉ display scale); optional small glyph badge.  
- Clear selection: second Listen elsewhere, Esc/pause, or short timeout (tunable; e.g. 12s) / leave clocked_chart.

---

## 4. HUD content (epistemic + personal)

### 4.1 Always label layer

Header must make the layer obvious, e.g.:

```text
SKY · NOW  ·  Pluto in Libra (Midpoint)
YOUR CHART · transit Pluto → natal …
```

Symbolic study language only. No “you will…”.

### 4.2 Two meaning blocks (when natal known)

| Block | Content | API / data |
|-------|---------|------------|
| **A. Placement** | What “Pluto in Libra” means in Midpoint symbolic language | Sidereal interpretation for planet-in-sign (or sign character + planet keywords) |
| **B. Personal transit** | What this **moving** body means relative to **this user’s** natal (Δ, house if available, tight aspects to natal points, composed transit blurb) | Sidereal transit study fragment for natal_id + epoch + body |

If API lacks personal block (no natal_id / server error): show **A only** + quiet “personal notes unavailable”.

### 4.3 Constellation pick

| Block | Content |
|-------|---------|
| **A** | Sign character essay snippet (Libra / Ophiuchus / …) |
| **B** | Optional: which natal planets fall in that sign / sky bodies currently in that sign for this epoch |

### 4.4 Length

- Title + 2–5 short sentences per block max for in-game HUD.  
- Prefer fields already composed by sidereal (seed text), not LLM in the game loop.

### 4.5 Zen UI

- One card, edge or lower third, monospace, dismissible.  
- No toast spam.  
- `reduceMotion`: skip globe swap pulse; instant gold OK.  
- LOW: text HUD + gold sticks; skip large planet texture if costly.

---

## 5. Projectile path — always ground

### Problem

Shots can retire on `projLife` before `y ≤ ground`, so lofted aims die mid-air.

### Requirement

**Combat projectiles** (and the prediction ribbon used for combat) must integrate until they **reach the ground** (or room wall), not expire mid-sky solely due to a short life when the loft would still land in-bounds.

### Implementation intent

| Item | Behavior |
|------|----------|
| Ground | Primary end condition: `y ≤ groundY` → land ring + whiff/hit logic as today |
| Walls | Keep room bound retire |
| Life | Raise / replace: either remove life as primary end, or set `projLife` / plan horizon to **at least** predicted ground time + margin for current aim |
| Plan / ribbon | `computeShotPlan` / ideal arc must use the same ground-completing horizon so HUD ribbon matches flight |
| Safety | Hard cap (e.g. 12–15s) only for NaN/ runaway |

Listen path never spawns a projectile, so Listen does not use projLife.

### Acceptance

- Max loft within room: projectile (and ribbon) reach floor.  
- Flat shots unchanged feel.  
- Arrival timing still judged at impact with orb when path intersects; ground miss still whiff.

---

## 6. Sidereal API (Parcel J — Codex)

Local-only, same host guard as existing app.

### 6.1 Proposed endpoint

```text
GET /api/sky-listen
  ?natal_id=<chart_id>          # required for personal block; optional for A-only
  &body=<pluto|sun|…>           # planet pick
  &sign=<libra|ophiuchus|…>     # constellation pick (optional if body implies sign)
  &when=<ISO>                   # default now
  &tz=<IANA>
  &kind=body|sign               # what was clicked
```

### 6.2 Response shape (sketch)

```json
{
  "schema_version": 1,
  "type": "sky_listen",
  "system": "midpoint_v1",
  "epistemic": "symbolic study notes, not predictions",
  "target": {
    "kind": "body",
    "body": "pluto",
    "sign": "libra",
    "lon_j2000": 210.5,
    "degree_in_sign": 14.2,
    "layer": "sky_now"
  },
  "placement": {
    "title": "Pluto in Libra",
    "text": "…seed / composed short…",
    "development": "…"
  },
  "personal": {
    "available": true,
    "natal_id": "bobby-…",
    "delta_deg": 12.4,
    "title": "Transit Pluto to your chart",
    "text": "…transit-flavored short…",
    "highlights": [
      { "aspect_glyph": "△", "natal_point": "moon", "orb": 0.32 }
    ]
  }
}
```

- `placement` = block A (always if seeds exist).  
- `personal` = block B when natal_id valid; else `available: false`.  
- Reuse existing store/compose/transit pipelines; **do not** invent new astrology in the game.  
- CORS: localhost game origin → localhost:8742 (existing patterns / allow if needed for 8931).

### 6.3 Client call

- Fire Listen → async fetch; line plays immediately; HUD fills when JSON returns (skeleton “listening…” optional, one line max).  
- Timeout ~1.5–2s → show geometry-only fallback (sign name + Δ from skypack) without essays.  
- Cache last N listens by (body,sign,natal_id,epoch bucket).

### 6.4 natal_id discovery

- From loaded skypack `natal_id` field when pack present.  
- Optional `?natal_id=` URL later; not required if pack carries it.

---

## 7. Visual assets (planet oversized)

- v1 of Listen may use **procedural globe** (color + bands) at ☉ scale if textures not ready.  
- Optional follow-up: small NASA-style PNGs per body in `fixtures/planets/`.  
- Sign emphasize = gold sticks (no words required).

---

## 8. Work parcels

### Parcel J — Codex (sidereal)

**Prompt:** `sidereal/CODEX_PROMPT_SKY_LISTEN_API.md`

| ID | Task |
|----|------|
| J1 | `GET /api/sky-listen` as §6 |
| J2 | placement text from existing interpretation store |
| J3 | personal block from natal + transit geometry/compose |
| J4 | Tests + README curl example |
| J5 | No aim-dojo edits |

### Parcel K — Fable (aim-dojo)

**Prompt:** `aim-dojo/FABLE_PROMPT_SKY_LISTEN.md`

| ID | Task |
|----|------|
| K1 | Ground-completing projectile + matching ribbon/plan |
| K2 | Listen gates: clocked_chart + natural + no orb + above horizon |
| K3 | Pick + line muzzle→body + no combat side effects |
| K4 | Emphasis: gold constellation, oversized planet |
| K5 | HUD: placement + personal from API; soft-fail |
| K6 | LOW / reduceMotion / decorative isolation |
| K7 | `node --check`; gameplay isolation for Listen IDs |

### Dependency

```
K1 (arc) can ship alone / first
J* ∥ K2–K4 structure
K5 needs J or temporary geometry-only fallback
```

---

## 9. Acceptance checklist

- [ ] `clocked_chart` + natural: fire on planet with clear reticle and no orb → Listen line + HUD, **no** projectile, **no** shot count.  
- [ ] Fire with orb in reticle → normal combat.  
- [ ] theatre or decorative or plain clocked → no Listen (combat only).  
- [ ] HUD shows placement meaning; with API+natal shows personal transit block.  
- [ ] Selected constellation gold; planet oversized.  
- [ ] Max loft combat shot hits ground (ribbon agrees).  
- [ ] Epistemic note present or implied in copy; no fate claims.  
- [ ] API down: still select + emphasize + minimal geometry HUD.

---

## 10. Out of scope

- Freeze-to-listen.  
- Theatre-mode Listen.  
- LLM in the browser.  
- Full essay panels / multi-page grimoire.  
- Changing Midpoint astronomy.

---

## 11. Agent prompt index

| Agent | File |
|-------|------|
| **Codex** | `sidereal/CODEX_PROMPT_SKY_LISTEN_API.md` |
| **Fable** | `aim-dojo/FABLE_PROMPT_SKY_LISTEN.md` |

**This document wins** on conflicts.
