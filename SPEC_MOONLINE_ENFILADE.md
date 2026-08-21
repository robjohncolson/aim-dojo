# The Enfilade — Season 2, Wave 11 (the road threads doors in infinite chalk walls)

**Version:** 1.0 · 2026-08-21
**Origin:** user design directive, locked 2026-08-21 across two study rounds (`<scratchpad>/studies7/` — FRESCO/CLOISTER/VEDUTA, then the FRESCO walls-free iteration; final look = `<scratchpad>/studies7/fresco/index.html` as it now stands, with `nf-*.png` renders). The user's words, forming the wave: *"instead of just random arches on a star road, the star road connects doors within pastel chalk colored walls — a user never sees the stars much: only the color of the next wall through the next gate hole. During the mercy arch, full view of the sky. The walls extend up and down — otherwise it looks weird. Quite opaque. And the glyphs completely saturated with color at the beat's timing."*
**Files touched:** `index.html` (+ regenerated mirrors). No assets, no server.
**Follows:** Wave 9 (the Nave, `5802a0f`) and Wave 10 (the Terrain, `047deab`). This wave REPLACES the white stone arches with walls-and-doors; the street/chevrons/terrain/bite and the mercy ring are inherited unchanged.

## 0. What changes, in one breath

At every bar line the white arch becomes a **pastel chalk wall** — an effectively infinite plane, extending up, down and sideways, that the road **pierces** through a **tall oblate doorway**. Ahead, the player sees the *next chamber's colour through the next door*, doors stacked into an enfilade; stars survive only overhead, at the powder-dissolved far reaches of each wall, and — fully — at the **mercy bar**, where the walls fall away and the sky opens around the ring. The chevron marks saturate to **full lane colour exactly on the beat**.

## 1. Identity note (deliberate, user-owned)

The game's line is "a rhythm shooter under a real sky." This wave **rations** the sky: walled forward views, open ceiling, and the full sky *granted* at the mercy exhale. That is the point — the sky becomes the reward — and it was chosen knowingly. The celestial shell itself is untouched; `wallsOn:false` restores the open wave-10 world byte-identically.

## 2. Parcel W — THE WALLS

Geometry (per bar line, every 4 beats = 108 m; road half-width HW = 7):
- **The doorway:** jambs at x = ±7.3, springline at **12.0 m**, elliptical crown (semi-axes 7.3 × 5.0) → apex **17.0 m**. Taller than wide (17.0 × 14.6) — the anti-squat proportion the user chose. The hole exists **only above the deck**: below y = 0 the wall is solid (`d = max(d, −y)` — the study's under-door law).
- **The wall plane:** solid chalk from the doorway bay outward — up, sideways, and **down below the deck** (study: bay to y = −70, then dissolve) — the road passes through the door as a bridge of light. Below the deck the chalk sinks into shadow (`grad *= exp(y·0.05)` for y < 0).
- **THE DISSOLVE (the checkerboard-ground law stood upright):** solid to ~**95 m** beyond the bay in every direction, then a **powder edge** — two-octave smooth value noise (never `floor`-block hash) raggedly eating the alpha — gone by ~**200 m**, with a sparse band of warm sparkle nodes riding the dissolve (the "stardust fade"). Numbers on named consts; **quite opaque is the law** — from the road the forward view is pastel, not stars.
- **No side walls of any kind.** The user's gameplay catch: Echoes spawn 360° and must never be hidden by architecture. The enfilade read is carried by the bar walls alone.
- **VEDUTA'S LIGHT (user-picked over the fresco shadow rim):** the wall **brightens** into the cut — cream lift (~0.30 mix to near-white) within ~2.5 m of the opening — and the **next chamber's colour spills through the rim** (`exp(-d·0.5) × ~0.22`) plus a soft additive veil of the next colour inside the hole. Every door is a glowing threshold.
- **Kept from the Nave:** the single gold 8-point star + honey breath above every crown (the rising string survives as the string of doorways), and the gold node at each jamb foot. The white-stone arch geometry itself is **retired while walls are on**.
- **The mercy bar:** **no wall** — walls end **one bar before** the mercy ring and resume **two bars after** (three studies independently found a wall behind the ring kills the reveal). Between: the full sky, the untouched white mercy ring + rose + veil.

Palette — **night-seeded chalk pastels**:
- One colour per **chamber** (the 108 m between walls), successive chambers differing. Base set (study-tested): rose `#f2c4cc` · powder `#b8cfe8` · sage `#c3d9b8` · butter `#f2e3b0` · lilac `#d5c2e8` (+ optional peach/mint). **Night-correct them**: a study found true chalk washed to white under the night gain — deepen until each reads as its hue at play brightness.
- Seeded from the **same authority as the course** (`roadCourse()`'s date ⊕ moon-phase key, a private mulberry32 stream — never `rnd()`/`Math.random`): tonight's chamber sequence is tonight's, the same for everyone, and the spawn stream is untouched.

Behaviour with the wave-10 world:
- Walls stand at their bar's station on the course: centred on the **centreline at their u**, facing the road's tangent there, their base riding `cyAt(u)` exactly as the arches do — and they take the **same terrain-horizon visibility factor** at the same brow (opaque material: use the vertex factor as a discard threshold, not a blend).
- Walls are depth-written and occlude the vault canopy, dust, far gates and sky behind them. The canopy remains visible overhead through the open ceiling.
- **CHALK DOES NOT HIDE SPIRITS:** an Echo occluded by a wall must remain readable as a soft glow through it — a depth-inverted additive pass (`depthFunc: GreaterDepth`, no depth write) on the orb's shell, drawn only when `wallsOn` (≤ +1 draw per live orb, ~3 concurrent). A wall may never cost the player a target. **Accepted GreaterDepth scope:** any nearer depth writer can reveal the pass: walls are intended, the mercy ring is harmless, another orb's core is a useful cosmetic presence cue, and brief projectile overlap is harmless. Terrain cannot reveal it because the road writes no depth. This broad property is deliberate; do not replace it with stencil masking.
- Reflections: **none** — there is no mirrored wall echo (the wall itself continues below the glass; the study deleted the mirror veil and mirror wall, and so must the game).

## 3. Parcel S — SATURATED ON THE BEAT (user-locked wording: "completely saturated with color at the beat's timing")

The chevron mark's fill ramps to **100 % lane colour at the exact moment its beat lands**:
- Resting state: the shipped jewel lift of `lc` (wave 10). Over the final beat of approach the fill ramps to the **pure, fully saturated lane colour** (`uL{lane}` at full chroma and brightness), peaking precisely when the mark's band-edge crosses the now-line — which, by the one-clock law, **is** the audible beat (`uNow` is already `audioLat()`-corrected).
- Use the **existing shared curve authority** (`beatSwell` / the `uPulse`–`uBreath` family) — no new clock read, no new curve; the ramp keys off the mark's own `b − uNow` already present in the shader.
- After the beat passes, the wake takes over unchanged (landed = lane colour, missed = dark, neutral = base).
- The ramp must be visible but must not bloom the mark into unreadability at 60 bpm — cap the added luminance so the chevron's shape survives its own peak. Named const for the ramp width (default 1.0 beat) and the peak lift.
- **Lane law, as ever:** the saturated peak colour derives from `uL0..uL3` — no new lane-colour literal anywhere. The `f435805` chain tests must stay green and extend to the peak term.

## 4. Contracts (inherited, absolute)

- **Treadmill law · one clock · painted motion only.** Walls scroll on the road's own shared uniform objects; under reduceMotion the pinned clock leaves them standing; nothing in gameplay reads walls (spawns, projectiles, aim, bounce, dolly — all untouched).
- **Kill-switch, raw boolean first:** `wallsOn:true` master — false → the **wave-10 world byte-identical** (white arches, accents, vault behaviour, no wall/glow-through/veil-of-colour code in the emitted shaders; freeze a wave-10 fixture in the established pattern). Knobs, flat literals with decision comments: `wallDissolve` (the solid radius; 0 = walls never built), `wallGlow` (veduta lift + spill strength), `wallSat` (the on-beat saturation peak, 0 = wave-10 resting fill exactly), palette override for testing.
- **LOW:** simpler walls — no grain, no veduta spill (plain gradient chalk + the hole), dissolve as a plain smoothstep, glow-through pass kept (it is gameplay-adjacent); half sparkle nodes. **reduceMotion:** zero motion (pinned clock covers it; verify, don't re-implement).
- **Performance is a pillar, with wave 10's scars named:** (a) **no second full-geometry submission** for any effect (the dark-socket lesson — fuse, don't re-draw); (b) beware **half-space terms extended to full planes** — `exp(-y)` diverged below the deck in the study and drowned three fixes; audit every y-term in the wall shader for both signs; (c) walls are few (≤ 9 visible) and mostly one quad each — target **≤ 2 draw calls** for all walls + ≤ 1 for veils/spill + the per-orb glow-through; (d) verify with the four-variant frame measurement (flat baseline / walls off / walls on / walls+everything) on both `?hi` and `?low`, before review.
- **Legibility floor:** the coming chevrons, the fill-gate mark, the now-line and the wake must read against every palette colour — check the butter/sage chambers against the gold street specifically (the S-lane-on-gold hazard, now as marks-on-butter-wall light).

## 5. Playtest questions (post-ship)

Does the enfilade read as travel — rooms passed through — at 28 and at 60 bpm? Is the mercy reveal the event it promises? Do tonight's five chalks feel like a night's *weather*, or arbitrary? Is the on-beat saturation a cue you can *play by*, or decoration? And the identity question, honestly: after ten minutes walled, does the open sky at mercy feel earned — or missed?
