# Sky Visual Simplify — Implementation Plan

**Status:** approved direction (2026-07-11), **not implemented**  
**Repo:** Moon Chorus `aim-dojo` (primary). Sidereal unchanged unless a one-line API field is needed (none expected).  
**Canonical path:** `aim-dojo/SPEC_SKY_VISUAL_SIMPLIFY.md`  
**Builds on:** rotating sphere (v2.1), natural/theatre spin (v2.2), Sky Listen + grounded arc (`SPEC_SKY_LISTEN.md`)  
**Implementer:** Codex (Fable unavailable). Prompt: `CODEX_PROMPT_SKY_VISUAL_SIMPLIFY.md`

---

## 0. Why

Playtest after Sky Listen:

| Feedback | Response in this plan |
|----------|------------------------|
| Procedural planet globes bland; worse than symbols | **No globes.** Listen → **large gold glyph** |
| Zodiac symbols illegible | **Larger** sign glyphs idle + stronger on select |
| Like muzzle→body Listen line | **Keep** |
| Too much to click | **Pick planets + sign glyphs only**; no ghost/seal picks |
| Two lines across sky in `clocked_chart` confusing | **Remove both ecliptic band rails** |
| Δ labels too small; HUD explains better | **Remove always-on sky Δ** |
| Projectile path fixed | **Do not touch** arc/projectile logic |
| Seals? | **Trust call:** seals **HUD-only** — remove always-on sky seals |

---

## 1. Product intent

**Idle `clocked` / `clocked_chart` sky** should read as a clean constellation dome with planet glyphs — not an astrology HUD pasted on the heavens.

**Listen** (existing gates: `clocked_chart` + `natural`, no orb under reticle) remains the place for meaning: line + gold emphasis + desk HUD (placement + personal).

### Non-goals

- No new freeze requirement  
- No theatre Listen changes  
- No projectile / `projLife` / ballistics edits  
- No sidereal seed rewrites  
- No floor chart  
- No difficulty DNA  
- No NASA textures in this pass (glyphs only)

---

## 2. Locked visual decisions

### 2.1 Ecliptic rails — **remove both**

- Delete drawing of the bracketing ecliptic band loops (`band` / `halfLatDeg` pair) in chart sky build.  
- Do **not** replace with a single rail in this pass.  
- Stick figures remain the zodiac structure.

### 2.2 Natal ghosts — **invisible until Listen**

- Do **not** show natal ghost rings/sprites in idle chart mode.  
- On Listen to a **body** that has a natal counterpart: optionally show **one** dim ghost mark at natal longitude for that body only (memory dust), same gold/dim language as selection — or show only via HUD Δ if simpler.  
- **Preferred:** show single faint natal marker for the selected body only while selection is active; hide when Listen clears.  
- Ghosts are **never** pick targets.

### 2.3 Seals (aspect glyphs in the sky) — **HUD only**

- Remove always-on resonance seal sprites and optional dotted arcs from the dome (or leave arcs behind CFG default **off** and ensure seals are not built).  
- Aspect story lives in Listen HUD (`personal.highlights`, titles, text from `/api/sky-listen`).  
- Do **not** draw △□⚹ next to idle planets.

### 2.4 Delta labels in the sky — **remove**

- Remove always-on `Δnn°` billboards under movers.  
- Δ remains in API personal block / HUD when Listening.

### 2.5 Planet emphasis on Listen — **gold glyph, not globe**

- Remove procedural oversized **globe** mesh/texture path used for Listen selection (or dead-code it off).  
- Selected planet: **same glyph sprite**, scale ≈ current ☉ glyph weight (or `SKY_CHART.lum.glyphSun` scale band), color **gold** (`#ffd24a` family, match constellation gold).  
- Idle planets: medium readable scale, cool moon-milk / body hue — **not** tiny dust.  
- ☉/☽ idle luminaries: keep as luminaries; on Listen to sun/moon, same gold upscale rule if picked as chart movers.

### 2.6 Zodiac / sign glyphs — **larger**

| State | Treatment |
|-------|-----------|
| Idle | Sign glyph scale **≥ 1.7×** current `sign.scale` (6.5 → **≥ 11**), alpha high enough to read (~0.35–0.5) |
| Selected sign or planet’s sign | Gold + further scale boost (~1.3× idle) |
| Stick lines | Selected figure gold (existing); idle sticks stay faint |

### 2.7 Pick targets — **less**

| Pickable | Yes/No |
|----------|--------|
| Transit / sky planets & luminaries (above horizon) | **Yes** |
| Sign glyph / constellation (centroid or glyph) | **Yes** |
| Natal ghosts | **No** |
| Seals / Δ | **No** (removed) |
| Ecliptic rails | **N/A** (removed) |

Tune pick radii if needed so signs are hittable once larger, planets not hair-trigger.

### 2.8 Listen line — **keep**

- Muzzle → body line unchanged in spirit; may retune color to gold for cohesion.  
- Still not a combat shot; no score side effects.

### 2.9 HUD — **unchanged contract**

- Still fetch `/api/sky-listen` when desk up; geometry fallback if not.  
- Card remains the place for Δ, aspects, essays.

---

## 3. Modes

| Mode | Rails | Ghosts idle | Δ/seals sky | Listen |
|------|-------|-------------|-------------|--------|
| `decorative` | n/a | n/a | n/a | off |
| `clocked` | none | n/a | n/a | off |
| `clocked_chart` | **none** | **hidden** | **none** | on if natural |

---

## 4. Suggested scale constants (Codex may tune ±20% after visual check)

```text
sign.scale idle:     11–14
sign.scale selected: 14–18
mover.scale idle:    12–16  (up from ~10)
mover.scale listen:  ~25    (match ~glyphSun)
ghost (listen only): scale 4–6, alpha ~0.35, not pickable
gold:                0xffd24a (existing LSN_GOLD)
```

LOW: keep larger glyphs if cheap; skip any leftover globe code; sticks as today.

---

## 5. Work parcel

### Parcel L — Codex (aim-dojo)

**Prompt:** `aim-dojo/CODEX_PROMPT_SKY_VISUAL_SIMPLIFY.md`  
**Working directory:** `aim-dojo`

| ID | Task | Done when |
|----|------|-----------|
| L1 | Remove ecliptic band rail drawing | No double loop in chart build |
| L2 | Remove sky Δ labels build/update | No Δ sprites |
| L3 | Remove sky seal sprites (+ ensure dotted arcs stay off) | No idle aspect glyphs on dome |
| L4 | Hide natal ghosts unless Listen selection on that body | Idle clean |
| L5 | Replace Listen globe with large gold glyph | No bland ball |
| L6 | Upscale sign + idle mover glyphs per §4 | Readable |
| L7 | Pick list = bodies + signs only; ghosts not pickable | Less mis-click |
| L8 | Keep Listen line + HUD + gates; do not touch projectiles | Spec rails |
| L9 | `node --check`; grep isolation; short comment update | Clean |

**No sidereal code required.**

---

## 6. Acceptance checklist

- [ ] `?sky=clocked_chart` (natural): **no** double ecliptic rails.  
- [ ] Idle: **no** floating Δ, **no** sky seals, **no** ghost rings.  
- [ ] Idle: planet + sign glyphs **clearly larger / more legible** than pre-change.  
- [ ] Listen on planet: muzzle line; **large gold glyph** (not globe); constellation gold; HUD still works.  
- [ ] Listen on sign: gold sticks + gold/larger sign glyph; HUD works.  
- [ ] High aim combat still hits **ground** (unchanged).  
- [ ] Orb under reticle still takes combat fire.  
- [ ] `decorative` / plain `clocked` not regressed.  
- [ ] `node --check` clean on extracted script.

---

## 7. Out of scope

- NASA planet textures  
- New interpretation copy  
- Changing natural/theatre defaults  
- Push/deploy (user asks separately)  
- Fable multi-lens review (unavailable)

---

## 8. Agent prompt index

| Agent | File |
|-------|------|
| **Codex** | `aim-dojo/CODEX_PROMPT_SKY_VISUAL_SIMPLIFY.md` |

**This document wins** on conflicts with older sky specs for band/Δ/seals/ghosts/globes.
