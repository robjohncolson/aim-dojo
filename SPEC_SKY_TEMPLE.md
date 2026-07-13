# Sky Temple — select, enter, investigate (Parcel ST)

**Status:** planned  
**Version:** 1.1 · 2026-07-13  
**Repos:** Moon Chorus (`aim-dojo`) primary; sky-day / personal skypack data already available  
**Depends on:** clocked sky, Listen pick path, natural local sky (optional but preferred in temple), personal chart ghosts when linked  
**Non-goals sibling:** dojo combat HUD Listen card (retired for select path)

---

## 0. Product intent

Two layers of sky attention:

1. **Dojo** — play the rhythm game. Sky select is intentional and **silent** (gold only; no study chip).  
2. **Temple** — floor dissolves; combat leaves; the sky becomes an investigation space. **Only here** a HUD answers what you aim at: bodies **and aspects** (transit details, orb, applying/separating).

**Hoʻoponopono lock:** WASD phrase meanings live **forever in English lore / story only** — not on the in-run HUD, not spoken VO, not temple panel chrome. Pure tones stay pure. (Optional later: off-run pause “about the lanes” blurb; still not combat/temple chrome.)

---

## 1. Goals

1. **Hold E + fire** on clear celestial → **select** (gold + silence). Never accidental.  
2. **E** while selected → **enter temple**; **E** (or clear exit) → leave temple.  
3. Temple: **no orbs, no beat lane obligation, real-time sky, no sky freeze**.  
4. Temple HUD (primary job): reticle + fire on **bodies** and **aspect lines** → fixed panel with **transit / natal / contact detail**.  
5. Public sky: temple works **without** natal (no ghosts / no transit–natal lines).  
6. Personal chart: natal ghosts + aspect chords; **clicking an aspect is first-class** (not buried).  
7. Pure tones only; Hoʻoponopono phrases **lore-only forever** (EN static map).  
8. Dojo Listen **chip / essay card** is not the investigation UI (temple is).

---

## 2. Non-goals (v1)

- Spoken voice samples for the four phrases  
- In-run HUD labeling “I love you” / “I’m sorry” / etc. on WASD **ever** (lore-only lock)  
- Combat orbs inside temple  
- Theatre freeze inside temple  
- DeepSeek / essay prose inside temple panel  
- Replacing pause TODAY’S SKY NOTE / CHART+TRANSITS export  
- Full planet–planet aspect web for public-only sky  
- Synastry / multi-user temple  

---

## 3. Phrase map (lore lock — silent forever on HUD)

Hoʻoponopono set — **static**. Physical lanes (never remapped for attack):

| Physical key | Phrase (EN lore only) |
|--------------|------------------------|
| **W** | I love you |
| **A** | I’m sorry |
| **S** | Thank you |
| **D** | Please forgive me |

**Silent forever (product rule):** these strings do **not** appear on dojo HUD, temple HUD, or as VO. They may appear only in out-of-run lore (README, long-form lede, optional pause “about”). Gameplay shows **letter glyphs** only. Audio: existing pure tones.

---

## 4. Dojo mode — sky select

### 4.1 Select gesture

```
state.running
&& (SKY_MODE === 'clocked' || SKY_MODE === 'clocked_chart')
&& E held
&& L-click / fire
&& no Echo blocks aim (existing combat-wins rules)
&& celestial pick hits
→ selectCelestial(pick)
```

If E **not** held: fire is combat only (or empty).  
If E held + empty sky: clear selection (optional) or no-op.

### 4.2 Select feedback (silent)

- Gold emphasize figure / glyph (reuse Listen gold path).  
- Optional short muzzle line (reuse, short fade).  
- **No** `#skyListenCard` study chip.  
- Soft selection state: `_skySel` (body or sign id + kind).

### 4.3 Legacy Listen card

- Disable automatic `showListenCard` / personal fetch for dojo select path.  
- Temple HUD replaces investigation.  
- Kill or gate old card behind `CFG.skyListen.legacyCard` default **false**.

---

## 5. Enter / exit temple

### 5.1 Enter

Preconditions: running, sky select active (`_skySel`).

**Tap E** (not hold-only): enter temple.

On enter:

| System | Behavior |
|--------|----------|
| Orbs / projectiles | Clear or expire gracefully; no new spawns |
| WASD note lane / floor beat obligation | Hide lane / mute beat flash or fade heavily |
| Tone Transport | Stop combat metronome **or** duck to near-silence; wall clock continues for sky |
| Floor | Dissolve (opacity → 0 / sink / fog) over ~0.6–1.0s |
| Sky motion | Force **natural** attitude while in temple (no freeze) |
| Dolly / combat HUD | Off or minimal reticle |
| Selection | Keep focus on `_skySel` |

### 5.2 Exit

- **E** again, or **Esc** first stage: leave temple (do not open pause if possible — or Esc = exit temple if in temple, else pause).  
  **Recommended:** Esc exits temple if in temple; if not in temple, Esc pauses (current).  
- Floor reforms, spawns resume, beat returns, clear temple HUD.

### 5.3 Public vs personal

| Chart state | Temple content |
|-------------|----------------|
| No personal chart | Public movers + sticks + signs; select/detail on bodies/signs only |
| Personal chart linked | + natal ghosts + transit→natal aspect lines + HUD contact text |

---

## 6. Temple investigation HUD

**Allowed only when `templeActive`.** This is the **only** surface that shows transit/aspect study chrome during play.

Pointer-lock: use **reticle pick** (same ray as fire) + **L-click** to select aspect or body — not free mouse on HTML if lock is on. Optional: temporary pointer unlock in temple (simpler UI, worse immersion).  

**Recommended v1:** keep pointer lock; L-click with reticle on aspect line or body focuses it and fills a **fixed temple panel** (right or bottom), dismiss with X key / empty click / select other.

### 6.1 Selectable targets

1. **Transit body** (mover)  
2. **Natal ghost** (personal only)  
3. **Aspect segment** (personal only; line between transit body and natal point) — **first-class**; not optional polish

Pick priority when rays compete: **aspect segment** (if within line pick threshold) → body under reticle → empty.

### 6.2 Panel content (plain, data-first)

**Body (transit):**
```
☉ Sun
sign · degree
Rx if any
```

**Natal ghost:**
```
☽ Moon (natal)
sign · degree · house if known
```

**Aspect (primary temple read):**
```
Transit Mars square natal Moon
orb 1.2° · applying
```
Include when pack/resonances provide them (graceful omit if missing):
- aspect type name (square / trine / …)  
- transit body + sign/degree if cheap  
- natal point + sign/degree if cheap  
- orb ° and applying | separating  
- optional rank / “tightness” among drawn lines  

Optional one short **static glossary** line (planet_in_sign or aspect seed already on client) — **not** DeepSeek essay, not full sky-listen chip restyle.

No long epistemic footer in temple (pause essay / sky brief remain the prose treat).  
**Never** show Hoʻoponopono phrases in this panel.

### 6.3 Aspect visualization

- Draw up to N tightest transit→natal contacts (reuse geometry from pack resonances / same pipeline as sky brief facts if available client-side from skypack).  
- Line brightness ∝ exactness; hard aspects cooler/warmer tint (subtle).  
- Focus: highlight selected line; dim others.  
- Cap draw calls (e.g. max 24 lines).  
- Lines only when personal chart present; public-only temple: bodies/signs only.

### 6.4 HUD chrome rules

| Surface | Temple | Dojo |
|---------|--------|------|
| Body / aspect detail panel | yes | no |
| Gold select emphasize | yes (focus) | yes (select only) |
| Legacy Listen study card | no | no (default off) |
| WASD phrase labels | never | never |

---

## 7. Temple WASD (optional soft, ST5 only)

v1 **omits** ritual juice. If ST5 later:

- Each WASD press plays lane pure tone only.  
- Brief pulse on focused body / aspect.  
- No field freeze (no field).  
- **Still no phrase text** on screen (lore lock holds).

---

## 8. State machine

```
DOJO
  holdE+fire on sky → SELECTED
  fire without E     → combat
  E while SELECTED   → TEMPLE
  X / empty holdE+fire → clear SELECTED

TEMPLE
  reticle+fire on body/aspect → FOCUS + panel
  empty fire / X             → clear FOCUS (stay in temple)
  E or Esc                   → DOJO (restore floor, spawns, beat)
```

---

## 9. CFG knobs

```js
skyTemple: {
  enabled: true,
  enterKey: 'KeyE',          // hold for select, tap for enter/exit
  selectRequiresHold: true,
  floorDissolveSec: 0.8,
  forceNaturalInTemple: true,
  maxAspectLines: 24,
  legacyListenCard: false,
  ritualSpeech: false,       // v1.1
}
```

---

## 10. Implementation map

| Concern | Anchor |
|---------|--------|
| Fire + E hold | `fire()`, keydown/keyup for E, `skyListenTry` rewrite |
| Select gold | existing emphasize / goldFigure; strip `showListenCard` |
| Temple enter/exit | new `enterSkyTemple` / `exitSkyTemple` |
| Spawn gate | `ensureRhythm` / spawn when `!templeActive` |
| Floor dissolve | dayFloor / nightGrid opacity or visibility |
| Aspect lines | THREE.Line segments in skySphere or world after attitude |
| HUD panel | DOM fixed panel, pointer-events only when temple + unlocked **or** reticle-driven fill |
| Personal data | skypack resonances / listen personal / client-side from pack |

---

## 11. Acceptance

1. Fire without E never opens temple or select study.  
2. Hold E + fire on Mars → gold Mars, no right-gutter chip.  
3. E → floor gone, orbs gone, real-time sky, no freeze.  
4. Personal: aspect lines visible; reticle+click line → temple panel shows transit body × aspect × natal point + orb + applying/separating.  
5. Public-only: no aspect lines; body select still shows public placement.  
6. E/Esc → dojo restored, combat spawns again.  
7. Pure tones only; **no** Hoʻoponopono phrase strings anywhere in-run (dojo or temple).  
8. Pause sky note / copy data unchanged.  
9. Temple panel never shows DeepSeek essay or birth lat/lon.

---

## 12. Phased delivery

| Phase | Ship |
|-------|------|
| **ST1** | Hold-E select (gold silence); kill legacy card default |
| **ST2** | Temple enter/exit; floor dissolve; clear orbs; natural force; no freeze |
| **ST3** | Temple body focus panel |
| **ST4** | Aspect lines + **click aspect → transit detail HUD** (personal) |
| **ST5** | Optional pure-tone pulse juice (still no phrase text) |

---

## 13. Summary

> **Hold E to mark the sky in silence. E opens the temple: floor and combat fall away, real sky remains, and only here a HUD answers what you click — bodies and aspects — with plain transit data. Hoʻoponopono stays silent forever on HUD: EN lore only; tones stay pure.**
