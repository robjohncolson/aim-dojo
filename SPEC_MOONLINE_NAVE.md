# The Nave — Season 2, Wave 9 (white stone gates, gold stars, the golden street)

**Version:** 1.0 · 2026-08-20
**Origin:** user design directive, locked 2026-08-20 after five rounds of rendered style studies (12 variants → the SERENE blend). The winning study lives at `<scratchpad>/studies5/serene/index.html` (+ 3 PNGs) for this wave's implementation only; every number that matters is restated here so the repo stays self-sufficient.
**Files touched:** `index.html` (+ regenerated mirror parts per commit). No assets, no server.

## 0. What changes, in one breath

The Moonline's bar-line gates stop being gold lancet ribbons and become **round Renaissance arches of lit white stone** — piers, coffered archivolt, keystone — under **a vault of gold stars that belongs to the road**, over **a golden-glass street**. The mercy bar keeps its law (the only complete circle in the world) and becomes a **full white ring closing through the road plane**, crowned with a gold rose. Gold moves out of the architecture and into the stars, the street, and one accent per gate.

## 1. Supersession of the decoration law (user-locked)

Wave 7's "information, never decoration" is **relaxed for this wave, deliberately** (user: "relax for atmosphere", 2026-08-19): the nave may be beautiful for its own sake, **but it may never compete with a read**. The binding residue of the old law:
- The coming cells' lane colours, the bar lines, and the now-line must be legible at a glance at 20 and at 60 bpm.
- The vanishing point must resolve to a clean bright portal — far gates simplify, they do not stack into noise.
- Nothing new occludes or distracts at the crosshair's height along the aim line.
- The mercy bar stays the *only* complete circle (now in white; its gold rose is unique to it).
- The real sky remains the permanent record: the gold-star vault is the road's own canopy, clearly *of the road* (it rides the road's visibility latch and dies with it); the celestial shell is untouched.

## 2. The gate (every bar line, every 4 beats = 108 m)

Geometry (metres, road half-width HW = 7):
- **Piers**: one each side, centred at x = ±7.65, 1.3 wide, from the deck to the spring at y = 9.5; a plinth block (0.9 tall, slightly wider) at the foot; an impost block (0.85 tall) at the top. Piers persist to the far fade so distant arches never float.
- **Arch**: semicircle, intrados R = 7.0, extrados R = 8.3 (a 1.3 band), centred on the road axis at y = 9.5; crown of the band ≈ 17.8.
- **Coffers**: 10 soft square recesses evenly spaced along the band per side (≈0.8 squares). Recess = shading only — a dip toward grey-blue with a darkened lip and a faint luminous seam; **no gold in ordinary coffers**.
- **Keystone**: a white wedge (1.1 → 1.5 taper) at the crown with a *whisper* of cream-gold warmth (≈25 % tint), fading to plain white past ~560 m.
- **The one gold accent**: a single gold **8-point star** floating ~0.85 above each keystone with a faint honey breath — the far stack reads as a rising string of gold stars toward the portal. (This star may carry the arch's existing beat-breath at `ML_ARCH_BREATH`.)
- No architrave slab, no fillets, no coffer stars (those were the GILT variant — cut by the user; keep the code shaped so a future `naveGilt` could add them, but do not build it).

Material — **lit white stone (alabaster/marble)**:
- Body: warm-white core `#f4efe6 → #fffaf0`, cool grey-blue limbs/shadows `#b9c0cc`, a white sheen at the lit crest, plus a faint additive inner glow (~0.10) so it reads as alabaster lit from within, not paper.
- The body is **normal-blended and must occlude what is behind it** (vault stars, halos, sky) — the study's key finds, restated: (a) additive gold is invisible on lit alabaster — any gold detail must sit in shadow or off the stone edge against sky; (b) if the marble is drawn as screen-space ribbons, overlays on the stone need their own pass (the study used depthTest:false overlay layers, legal because gates nest on the road axis).
- Reflections below the deck at ~0.5, fading over ~6 m of depth.

## 3. The mercy gate (the mercy bar only)

- A **ring**: intrados R = 10.0, band to R = 11.6, **centred on the deck** (y = 0) so the upper half stands over the road and the lower half shows as its reflection — the reflection runs stronger here (≈0.66, ~26 m depth falloff) so the circle visibly **closes** below the road. Pedestal blocks where the band crosses the deck. 12 coffers per side.
- Keystone more gilded (≈1.8× warmth). At the crown: a **gold rose** — 10 scalloped petals (deliberately *not* a ring — the circle stays the ring's job) with a ~19-ray sunburst, plus the gate's gold star above.
- **The veil** (new, flown through): a soft translucent gold sheet hung inside the ring, parted at the centre so the aim line stays clean; the player passes through it as the field exhales. Opt-in knob; 0 = none.
- Replaces the current mercy treatment (`uMercyRB` boost + closed gold ring); the *law* it implemented (complete circle, brightest marker) is preserved.

## 4. The vault of gold stars (new layer)

- ~1,500 gold point sprites forming a painted-vault canopy **belonging to the road**: a loose barrel over the road (roughly y 15–60, denser and larger near, fading by ~650 m), plus a low course of smaller stars between the gates. Star = gold core `#ffd27a` → bloom `#ffeccc`, 4- and 8-point sparkle on the brightest, kept out of the portal cone at the vanishing point.
- One draw call, one material; positions keyed to road distance and wrapped with the road's own `uNow` (the dust pattern — `mod(anchor − uNow, SPAN)`), so the vault streams past at road speed and cannot drift from the beat. It rides the road's visibility latch (trainer/Temple never see it).
- reduceMotion: the vault stands still (uNow pinned, as the ribbon already is). LOW: halve the count and drop the sparkle rays (`ML_ARCH_RICH` pattern — not emitted into the shader at all).

## 5. The golden street (palette restyle, mapping unchanged)

The road plane keeps every information mapping byte-for-byte (band = beat · colour = required lane · brightness = tide · marked band = fill gate · wide bright band = mercy · wake behind the now-line) and changes **palette only**:
- Deck: dark honey glass (deep amber base) instead of the current near-black; crossbars/leading in warm gold; bar lines white-gold.
- Coming cells: the four lane hues as **jewel glass** — same hues (`#74e84a #43d9ff #ffb347 #ff5ea8`), richer saturation, lit from within; the amber lane must still separate from the gold floor (the study kept lane hue ≥ 90 % pure — copy that).
- Soft light pools on the deck under each gate and at the pier feet; the existing edge rails/balustrade go warm gold.
- The wake's verdict colours (landed = lane colour, missed = dark, neutral = base) survive recolouring with their *contrast* intact.
- Stardust (`roadDust`) goes gold-pollen (`#ffdb85` with a few embers), density unchanged.

## 6. Contracts (inherited, absolute)

- **THE TREADMILL LAW**: `PLAYER_POS` never moves; painted motion only. **One clock**: everything reads the same `uNow`/`roadBeatNow()` the grading uses.
- **Kill-switch, raw boolean first**: new flat keys in `CFG.moonline` (the CFG block is flat literals — no nested `{}`, the contract test regex forbids it): `naveOn:true` master (false → wave-8 gold lancet arches, mercy ring, dust and street **byte-identical** — the old shader text must still be what compiles), plus minimal knobs: `naveStars` (vault sprite count, 0 = layer never built), `naveVeil` (mercy veil alpha, 0 = none), `naveStreetGold` (0..1 street palette blend, 0 = today's palette exactly — implement the restyle as a mix so this one knob is the escape hatch).
- **Performance is a pillar**: today the arches are ONE draw call. Budget for the whole wave: arches ≤ 2 draw calls (marble body + overlay/accents), vault +1, veil +1 on the mercy bar only, street/dust/impostor unchanged in count. State the achieved numbers in the spec-comment. No per-frame geometry rebuilds; the vertex-shader-places-stations pattern of `buildRoadArches` stays (attributes are parameters; the course spline lives in uniforms).
- **Trainer/Temple inertness**: everything rides the road's existing visibility latch (`roadSync`). Post-graduation only.
- **LOW**: plain white arcs (no coffers, no inner glow — shading only), half vault, no sparkle rays, veil off. **reduceMotion**: zero motion, everything stands and pulses in place (the existing law).
- Colour space stays the deliberate linear passthrough. No new UI, no new text.

## 7. Playtest questions (for the user, post-ship)

Does white stone against the real night read as *the* Moonline or as a different game? Is the vault density right at 20 bpm (mesmerizing) and at 60 (not a blizzard)? Does the mercy circle + rose + veil land as the exhale? Is `naveStreetGold:1` too warm for hour-long sessions — is 0.7 the ship value?
