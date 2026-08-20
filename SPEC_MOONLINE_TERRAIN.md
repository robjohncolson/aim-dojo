# The Terrain — Season 2, Wave 10 (the road gets hills, a turn, and a carved cue)

**Version:** 1.0 · 2026-08-20
**Origin:** user design directive, locked 2026-08-20 from five rendered studies (`<scratchpad>/studies6/`). Three complaints, three parcels: *"the colours are kinda bland and take up too much viewing space"* → **A, THE MARK**; *"the road is largely flat, it never goes up or down"* → **B, THE TERRAIN**; *"the curves are veryyy lazy"* → **C, THE BITE**.
**Files touched:** `index.html` (+ regenerated mirrors). No assets, no server.
**Follows:** Wave 9 (`SPEC_MOONLINE_NAVE.md`, shipped `5802a0f`) — white stone gates, gold-star vault, honey-glass street. This wave changes the road the Nave stands on.

## 0. The user's accepted trade (stated up front, because it is the wave's one real cost)

Elevation costs lookahead. Measured in the study: on a crest, the road self-occludes at `d = √(8/k)` for curvature `k`, so the 8-cell read window begins losing its far end at about a **−4 % relative downgrade** and is down to three cells by **−10 %**. Over a whole course, **47 % of the time fewer than 8 cells are fully visible; 18 % fewer than four.** The user was shown these numbers and chose the trade: *"it's okay to trade lookahead for a more interesting road."* Implement it — do not silently soften it — but put the amplitude on a knob (§2) so it can be dialled after play.

The compensating gift, also measured: the coloured band occupies 53 px of 900 on flat road, **31 px cresting** and **87 px in a trough** — so hills shrink the cue exactly when it is hardest to read. That partially answers complaint 1 on its own.

## 1. Parcel A — THE MARK (replaces the full-width lane band)

Today each coming beat is a **full-width 14 × 27 m slab of flat lane colour**, eight at once = 216 m of saturated colour. Replace it with a **chevron carved into the street**, one per coming beat.

- **Shape:** a chevron pointing in the key's own direction — **W points away** (down the road), **S points toward** the player, **A points left**, **D points right**. Outer width ≈ **4.67 m** (a third of the 14 m road), stroke ≈ **0.99 m**, mitred square at the arm ends, centred in its cell.
- **Foreshortening:** the deck is seen at a grazing angle, so stretch the glyph along the road by `S = u/7.5` clamped to **1 … 4.5** and capped so it always fits inside its 27 m cell — exactly how a painted road arrow is drawn. On screen it comes back to a square chevron.
- **Carved, not printed:** inside the mark and in a **0.25 m groove** around it the glass pane goes solid (alpha 0.44 → 0.84) so the street's depth stops, and the deck's own light (quilting, gold leading, beat lines) is multiplied by `(1 − 0.88·cut)` so the veining visibly stops at the stone. One screen-space derivative of the mark's SDF gives the groove a light direction: far wall takes the gold leading at full strength, near wall holds the shadow. Fill is the lane hue with a hot polished spine down the centreline.
- **THE DARK SOCKET (do not skip — this is why the sibling study failed):** the street is now honey gold, and **lane 2 (S) is gold #ffd36b**, so a gold mark on a gold deck disappears. Inside the mark's footprint kill up to **85 %** of the gold glass and deepen the dark base pass, so every lane hue — S above all — sits on a near-black socket. Verify S specifically, at `naveStreetGold` 1.
- **Distance:** the imminent mark is brightest; distant ones simplify to a small bright chevron with a size floor so the far road stays clean and the vanishing point stays a clean portal.
- **THE LANE COLOURS, IN LANE-INDEX ORDER — the one thing this wave must not get wrong:** lane 0 = **W = cyan #43d9ff**, lane 1 = **A = green #74e84a**, lane 2 = **S = gold #ffd36b**, lane 3 = **D = pink #ff5a7a**. These come from `WASD_HEX` via `_roadLaneCol[i]` → `uL{i}`; a wave-9 bug swapped two of them and shipped. **Derive from the existing uniforms; introduce no new lane-colour literal anywhere.** The contract tests added in `f435805` guard this chain — keep them green.

## 2. Parcel B — THE TERRAIN (the road gets hills)

The road today has **no vertical component at all**: its centreline only displaces X and the deck is a plane at y = 0. Give it one, using the **same re-basing the lateral course already uses**.

- **The height course:** `courseY(b) = 6.0·sin(2πb/22) + 2.4·sin(2π(b/13 + 0.2)) + 0.9·sin(2π(b/10.5 + 0.6))` metres, `b` in **beats** (periods 22 / 13 / 10.5 beats; true grade peaks 12.6 %, 5.6 % rms). Seed it from the **same night key** the lateral course uses (`roadCourse()`, index.html:1746) so tonight's terrain is tonight's — one seed authority, no new random source, and the spawn stream untouched.
- **The re-basing (this is the whole trick):** `cy(u) = courseY(now + u/27) − courseY(now) − courseY′(now)·u/27`. Subtracting both height and grade at the now-line guarantees the deck is **always exactly at the player's feet and always level under them**, so `PLAYER_POS` never moves and the treadmill law is untouched. Crests and dips roll toward and past the player.
- **Consequence, stated so nobody re-discovers it as a bug:** because the grade is subtracted, a **constant slope is invisible** — only *curvature* reads. "Climbing" and "descending" do not exist on screen; there is only convex-ahead (view cut short, cells compressed) and concave-ahead (ribbon soars, cells expand). This is correct behaviour, not a defect.
- **What rides the terrain:** the deck, arches, piers, plinths, imposts, keystones, apex stars, the balustrade, light sheets/pools, gold dust, and the star canopy (which stays a canopy — lifted, not deformed). Work in deck-local Y and lift by `cyAt(−z)` at push time. The road becomes a ribbon of quads (suggest 1 / 2 / 4 m spacing by distance) displaced in **Y only**, so `u = −z` is unchanged and the honey-glass fragment shader needs no edit.
- **Reflections** mirror about the **local** deck (negate local y *before* the lift), so the mercy ring still closes into one circle on a 9 % grade.
- **Occlusion:** with the eye at 4 m a crest is a hard occluder. Add an analytic horizon — a running max of the depression angle sampled along the road (≈1 m) — multiplied into each vertex's alpha and keyed on `|local y|` so a reflection is exactly as visible as the thing it mirrors. It must cut deck, arches, rails, canopy and reflections at the **same brow**; an arch beyond a crest correctly shows only its floating crown.
- **What must NOT ride the terrain — verified before writing this spec:** orbs/Echoes (spawn Y is clamped to `[2.2, ROOM_BY]` around `PLAYER_POS`, index.html:7473/7528/7532 — road-independent), projectiles and the ballistic arc, the mover bounce at `p.y<2.2` (a room-box constraint), star tethers, the celestial shell, the camera. **No gameplay quantity may read terrain height.** The orbs hang in their shell while the road moves beneath them; that is the intended read.
- **The dolly** currently *banks* with the lateral course (`roadLean()`); it may additionally **pitch** with the re-based grade at the same lead, at a small fraction, behind its own const. Optional — ship it at 0 if it fights the aim.

## 3. Parcel C — THE BITE (the curves stop being lazy)

`roadCourse()` seeds three harmonics with periods of **20–60 beats** — one bend every 43–129 s at 28 bpm — and the re-basing removes the tangent, so only slow curvature ever shows.

- **Add a fourth harmonic: period 7.0 beats, amplitude 2.2 m** (`Aω² = 1.773 m/beat²`, radius 411 m — **3.2× the curvature of today's tightest harmonic from 2.2 m of wander**). Measured effect: median |heading 4 beats out| **2.91° → 5.45°** (p90 6.70° → 11.55°); the road centre at the next bar line moves from 2.8 m off-axis (half a road width) to **6.5 m** (a full one).
- **7 beats, not 8 — deliberately.** An 8-beat period would lock to the 4-beat bar and turn the bend into a metronome. Say so in the decision comment.
- Amplitudes were auditioned: 1.4 m is invisible at this camera, 3.0 m throws the next arch clean off the crosshair. **2.2 m turns and still lands.**
- **Optional, behind its own const, default ON at a low value:** keep ~**20 %** of the tangent instead of removing 100 %, so the road has a visible heading. Measured drift of the vanishing point at 60 % kept: median 1.29°, p90 3.09°, max 4.42° — **9 / 22 / 32 px on a 1600-wide frame**. At 20 % it is a third of that. The aim point moving is the real risk; keep it small and make it a knob.
- `ROAD_BEND_M` still bounds the total lateral excursion — the fourth harmonic must not blow that budget.

## 4. Contracts (inherited, absolute)

- **THE TREADMILL LAW:** `PLAYER_POS` never moves. Painted motion only. **ONE CLOCK:** everything reads the same `uNow`/`roadBeatNow()` the grading uses; the terrain and the mark scroll on the road's own uniform objects (never copies), as the vault and veil now do.
- **Information survives:** band = beat, mark = required lane, brightness = tide, marked band = fill gate, wide bright band = mercy, wake verdicts (landed = lane colour, missed = dark, neutral = base). The *cue changes form, never meaning.* The fill-gate mark and the mercy bar must stay at least as legible as wave 9 left them.
- **Kill-switches, raw boolean first,** new flat keys (the CFG contract regex forbids nested `{}`): `markGlyph` (false → wave-9 full-width bands, byte-identical), `terrainOn` + `terrainAmp` (false / 0 → a flat road, byte-identical), `curveBite` + `curveHeading` (0 → today's course exactly). Every one independently verifiable by render.
- **LOW:** terrain keeps fewer ribbon segments and drops the occlusion horizon's fine sampling; the mark loses its groove shading and becomes a flat chevron; the fourth harmonic stays (it is free). **reduceMotion:** everything stands still on the pinned clock, as the ribbon already does.
- **Performance:** the road ribbon replaces one plane with a strip — state the triangle count. No per-frame geometry rebuild; no per-frame allocation; the terrain must be evaluated in the vertex shader or once per build, never per frame on the CPU.

## 5. Playtest questions (for after it ships)

Does losing the far cells on a crest read as *difficulty* or as *the game hiding things from me*? Is `terrainAmp` right, or is half this better? Does the 7-beat bend feel like a road or like a wobble? Does the chevron teach itself — can a new player infer W/A/S/D from the arrows without being told?
