# The Inverse — Season 2, Wave 11.2 (the mercy gate becomes a negative of the night)

**Version:** 1.1 · 2026-08-21
**Origin:** user verdict on the shipped mercy reveal — *"the mercy arch feels so anticlimactic… I actually like the regular arches better. Put a wall for that as well, but made of a filter that gives the color inverse of anything behind it — white turns black, pink turns cyan."*
**Follows:** Wave 11 (`992e75f`…) and 11.1 (`a8a668c`). Everything else stands; this wave changes ONLY the mercy bar's marker.

## 0. What changes, in one breath

The mercy bar gets a wall like every other bar — same doorway silhouette, same station plumbing — but its face is a **colour-inversion filter**: every pixel of the world seen through it renders as its RGB inverse (`1 − dst`). Against the night this pane **glows like paper with black stars**; the gold street becomes deep blue through it; a pink Echo behind it shows teal. The Breath's exhale still strips the ordinary walls away around mercy, so the inverse gate stands **alone in the open sky** — the anticlimax replaced by the strangest, brightest object in the world. The white ring, rose and veil **retire while the pane is on** (the law-of-one transfers: mercy is now the only inverted wall, still crowned by its only star).

## 1. Parcel I — THE INVERSE PANE

- **Geometry:** the mercy slot builds the SAME wall silhouette as ordinary bars (bay, shoulders, oblate doorway, hole above deck only, below-deck extension) at its station on the course, riding terrain and the horizon factor. Reuse the existing wall geometry/vertex path — only the fragment/material differs.
- **The filter (the whole trick):** a separate material on the mercy wall's surface using **pure blending — `THREE.CustomBlending`, `blendSrc: OneMinusDstColorFactor`, `blendDst: ZeroFactor`, fragment colour white** → output = `1 − background`, exact inversion, **no render target, no post pass, one filter draw**. `transparent:true`, `depthWrite:false`, `depthTest:true`, drawn AFTER the world it inverts at order 6. Consequences to preserve, not fight: opaque things IN FRONT (depth-tested) stay normal; Echo cores BEHIND it (drawn earlier, at its pixels) appear inverted — *spirits seen through the veil in negative* is the intended read.
- **The near-road guard:** while that filter draw is visible, one late depth-only road submission at order 5.5 protects the nearer ribbon and its live lane cues from the order-6 inversion. It is a child of `roadMesh`, shares the road geometry, exact vertex shader, and exact `roadMat.uniforms` object, and uses `transparent:true`, `colorWrite:false`, `depthWrite:true`, `depthTest:true`. Its stripped fragment reproduces the road fragment's fade, terrain-visibility, and outer-ribbon discard footprint exactly. Keeping it transparent is intentional: an opaque prepass would run too early and change target/through-layer behavior.
- **Edges:** the pane's powder dissolve is **binary discard** (each fragment either inverts or is absent — `1−dst` cannot alpha-fade to clear, only to black, so no alpha edge fades anywhere on this material). Use the wall family's two-octave noise for a crumbly discard edge matching the chalk language. Same dissolve radius law as ordinary walls (and the exhale's 60 % pull-in never applies to the mercy slot itself — it IS the destination).
- **Door:** the hole shows the world normally — approaching, the player sees a negative world with one true-colour doorway in it, and flies through the door as with any gate.
- **The mercy kit:** the crown star stays (already mercy-only). The white ring, the gold rose, and the flown-through veil are **not built** while the pane is on. The wave-11 suppression map keeps ordinary walls off at R−1…R+2, so the pane stands alone against the sky.
- **Knob:** `mercyInverse:1` flat CFG key, raw-boolean-first: `0` → the shipped ring/rose/veil reveal **byte-identically** (frozen-fixture-tested, alone and combined with the other switches — the coupling lesson is five waves old now). LOW: same pane, plain discard edge (no fine noise octave). reduceMotion: the pane is a standing state; nothing to pin.

## 2. Contracts

Treadmill/one-clock/no-gameplay-reads as ever; the pane writes no depth and reads nothing back. No lane colour involved (the inversion is arithmetic, not palette). No new y-terms without the half-space audit. Zero new uniform objects: the pane keeps the shared wall family and the road guard takes `roadMat.uniforms` itself. The feature costs **+2 submissions at most** — one inverse pane and one road-depth guard — and both are visible only while a mercy slot is visible. The guard leaves order-6.5 crown accents and order-7 additive dust normal-coloured; accepted consequence: because the guard has populated deck depth, dust particles below the deck may now fail their depth test and disappear. uK mercy detection is packed-safe across every wall-family reader.

## 3. Playtest questions

Does the negative gate read as the climax the ring never was? Is flying through the door of an inverted world disorienting in the good way or the bad way at 60 bpm? Should the crown star invert too (it currently rides above the pane, normal-coloured)?
