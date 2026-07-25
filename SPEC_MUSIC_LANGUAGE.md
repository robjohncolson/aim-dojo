# The Music Language — Redesign Wave 2 (every shot is a note)

**Version:** 1.0 · 2026-07-25
**Branch:** `redesign/moon-chorus` (continues from wave 1; merge to `main` after user playtest)
**Files touched:** `index.html` only (+ regenerated `tools/index-inline.mirror.js` per commit). No assets, no build, no server.
**Origin:** 2026-07-24 redesign panel — the "music-game depth" cluster, judge-ranked. Wave 1 (Tides/Quiet Tick/Bow, SPEC_TIDES_BOW_TICK v1.1) is merged and live; this wave builds on it.
**Wave-2 thesis:** playing well becomes indistinguishable from making music. Reward moves from score-brain to sound. Zero new player-facing text (no JA work this wave). Zero new UI.

---

## 0. Parcels

1. **D — ORBS SING THEIR DISTANCE**: each Echo's tone pitch encodes its beat-quantized lead k — you hear *when* before your eyes find *where*.
2. **E — THE LEAD INSTRUMENT**: arrival tightness becomes timbre — dead-center is a full voiced note, window-edge is breathy, a clank mutes your voice for a beat.
3. **F — CHORD VOLLEYS**: two kills landing on the same beat ring a harmony chord; three ring a triad. The expert move the game's distance-as-syncopation invention has always implied.
4. **G — THE TANK IS A DRUM FILL**: the multi-hit tank spawns only at the swell peak and its hits land a stated fill figure that launches the mercy-bar bloom.

## 1. Hard constraints (all parcels)

- **Kill-switches:** `CFG.sing.on`, `CFG.voice.on`, `CFG.chordVolley.on`, and `CFG.tank.fillOnly` — each `false` restores today's behavior exactly (hot call-sites read the raw boolean first, per SPEC_TIDES_BOW_TICK v1.1 amendment style).
- **Audio budget is the HUD budget:** reuse existing voices (`lead`, `tune`, `bass`, `pad`, `arp`, per-target PositionalAudio). NO new per-orb synth graphs; at most ONE new shared polyphonic voice if chord volleys cannot cleanly reuse `pad` (decide at the code, justify in the CFG comment). All new notes are event sounds tied to player action or existing grid slots — never a new repeating layer. Everything stays in the current THEME's PENTA/CHORD arrays so all four parcels speak MOONLIGHT's key (and any future theme's) automatically.
- **Rhythm-safe:** no `dt`/Transport scaling. All scheduling via existing `onGrid` slots or `triggerAttackRelease` at event time.
- **Zen:** no HUD, no counters, no toasts, no strings. The sound IS the information.
- **Trainer/Temple:** all four parcels inert pre-graduation (`trainMode`) and in `templeActive`. The trainer's didactic soundtrack is untouched.
- **Grading untouched:** `perfectMs`/`goodMs` windows, scoring, streaks, and `ghostRec` bookkeeping are read, never modified. Parcel E shapes *sound* from the existing grade data; parcel F detects from existing kill events; nothing pays or punishes differently except G's spawn-timing change.
- **Verification per parcel:** tests stay 133/133; inline-script `node --check` via scratchpad extraction; regenerate the mirror (`node tools/extract-inline.mjs`) in the same commit; `npx gitnexus impact` on any function you modify before editing (CLI, `--repo aim-dojo`; mirror line N = index.html line N).

## 2. Parcel D — ORBS SING THEIR DISTANCE

### Design
Every target already owns a PositionalAudio tone with a rhythmic 16th-gate (`~line 3844-3852` creation, `~5603` per-frame gating). Today all targets share one pitch. Change: at spawn, set the target's oscillator frequency from its beat-quantized flight count k (`beatSpawnSixteenths` roll in `spawnTarget`): map k across the active THEME's `PENTA` scale, **longer flight = lower degree** (far orb = low sustained call, near orb = high short call). Carry `tg.k` (spawn already knows it — wave 1's Bow stores per-hit k, so the plumbing may exist; verify).

Kind flavor (cheap, same oscillator):
- **GOLD (Ancient):** one octave down from its k-degree — deeper voice, reads "old."
- **SPEED (Quick):** its k-degree with a fast upward detune settle at gate-open (~40ms glide into pitch) — a grace-note pickup.
- **MOVER (Wandering):** slow ±10-cent vibrato via detune LFO only if the existing node graph allows it without new nodes per target; otherwise skip (do not add nodes for this).

The spawn moment itself: the FIRST gate-open of a new target plays at slightly higher gain (the "call") — reuse the existing `gateGain` ramp with a one-shot boost multiplier, no new voice.

### CFG (flat)
```
sing:{ on:true, degSpan:5, callBoost:1.5, goldOctDown:true, speedGlideMs:40, moverVibCents:10 }
```
`degSpan`: k range maps across this many PENTA degrees ending at the scale top for the shortest k.

### Acceptance
- `sing.on:false` → every target keeps today's shared pitch and gain behavior exactly.
- Pitch is set once at spawn (no per-frame frequency writes beyond what exists).
- Spatial-audio distance model (dry/close, reverb/far) unchanged — pitch adds information, never replaces it.
- Daily/`rnd()` stream untouched (pitch derives from already-rolled k; no new RNG draws).

## 3. Parcel E — THE LEAD INSTRUMENT

### Design
In `gradeRhythmHit`'s scoring path (~4430s), the kill already voices notes on `lead`. Shape that note by arrival tightness `q = 1 - min(1, |errMs| / goodMs)`:
- **Velocity:** `lerp(voice.breathyVel, voice.fullVel, q)` — window-edge hits are breathy, dead-center hits are full.
- **Brightness:** if `lead`'s chain has (or can cheaply gain) one shared lowpass, set its frequency per-note from q (`lerp(voice.dullHz, voice.brightHz, q)`); set-at-trigger only, no automation curves.
- **Consonance stack:** consecutive FLAWLESS arrivals (grade index 0) stack overtones on the kill note — 2nd flawless adds the 5th, 3rd+ adds the octave (cap `stackMax`). Any non-flawless resets the stack. Voiced on the same `lead` trigger (chord array), NOT a new voice.
- **The clank mutes you:** after a clank (closed-shell arrival), the `lead` kill-voice is silent for the next `clankMuteBeats` beat — the hole in the song you made. Audio only; scoring, streak, `tune`, and all other voices unaffected. The shell's own clank SFX still plays (it is the mercy, not the punishment).

### CFG (flat)
```
voice:{ on:true, fullVel:0.85, breathyVel:0.30, brightHz:5600, dullHz:1400, stackMax:3, clankMuteBeats:1 }
```

### Acceptance
- `voice.on:false` → kill notes trigger exactly as today (velocity, timbre, no stack, no mute).
- The mute never affects `tune`, WASD `tapSynth`, drums, or the target tones — only the kill-voice.
- No allocation per hit (stack arrays preallocated / reused).

## 4. Parcel F — CHORD VOLLEYS

### Design
Distance already encodes flight time, so a far shot fired early and a near shot fired late can LAND on the same beat. When ≥2 scoring kills arrive in the same beat slot (same whole-beat index; track the last arrival's beat index + count in two module vars), the second kill's note becomes a **dyad** (its k-degree + the current bar's `CHORD_TRIAD[ci]` third), and a third same-beat kill voices the full **triad** on `pad` at moderate velocity. Reuse `pad` (or the dormant `chordSynth` if it exists and is built — verify at ~5222's flick remnant; if it's dead code, prefer `pad`). The reward is only the sound. No counter, no multiplier, no ring.

Edge rules: only scoring kills count (clanks/decoys/whiffs never). Tank fill hits (parcel G) are excluded — the fill is its own figure. `fireQuant` already allows up to 4 shots/beat, so volleys are physically fireable.

### CFG (flat)
```
chordVolley:{ on:true, dyadVel:0.5, triadVel:0.32 }
```

### Acceptance
- `chordVolley.on:false` → second same-beat kill sounds exactly like the first (today's behavior).
- Zero visual change. Zero score change.
- Works with parcel E: the dyad/triad inherits the tighter hit's timbre shaping.

## 5. Parcel G — THE TANK IS A DRUM FILL

### Design
Today a plain orb rolls `multiHitChance` (0.22, free-play) to become a 2-3-hit amber tank at any time. Change the WHEN, keep the machinery:
- **Spawn:** with `tank.fillOnly:true` (and `tide.on`), tanks never roll randomly. Instead, at most ONE tank may spawn, only during the **final peak bar** of a tide swell (the bar before mercy), eligibility rules unchanged (`tank.maxBpm`, `maxLeadSixteenths`, `_specialLive`). The tank IS the phrase-end fill announcement.
- **Figure:** the existing sub-node timing gate stays, but the required hits are the stated fill — 2-hit tank: **"and-of-4 → 1"** (the 1 being the mercy bar's downbeat); 3-hit: **"4 → and-of-4 → 1"**. Express as sixteenth-offsets in CFG. The existing walking bass note per landed hit (verify in `handleTankHit`) stays — it IS the fill's voice; ensure it walks `CHORD_ROOT`-relative so it lands on the tonic at the 1.
- **Payoff:** completing the fill ON the mercy downbeat routes through the existing tank-finale clutch pop AND the mercy bar's pad bloom (wave 1's `tideBloom`) — the fill literally launches the exhale. No new sounds needed; alignment does the work.
- **Incomplete fill:** the tank simply closes and departs at mercy end (existing expiry path; no penalty beyond departure).
- **Fallbacks:** `tank.fillOnly:false` OR `tide.on:false` → today's random-roll tank exactly.

### CFG (extend the existing flat `tank` literal)
```
tank:{ ...existing keys..., fillOnly:true, fig2:[14,16], fig3:[12,14,16] }   // sixteenths from the peak-final bar's start; 16 = the mercy downbeat
```

### Acceptance
- `fillOnly:false` → byte-equivalent tank behavior to current main.
- Never more than one live tank; never a tank outside the final peak bar when `fillOnly` is on.
- Bow, temple, trainer: no tanks (existing gates verified).
- The daily/ghost invariants (`score === h.length`) are untouched — tank scoring rules unchanged.

## 6. Build order & review

Sequential D → E → F → G (one commit each, Sonnet verify between), then Codex read-only review of the wave-2 diff, fix rounds until GREEN, then push for user playtest. All feel values are first guesses — the user tunes by ear.

## 7. Playtest questions (post-build)

- D: can you *hear* "far = low, near = high" within ten minutes of play? Does the gold octave-down read as "ancient"?
- E: is the breathy-vs-full difference audible at your skill level? Is the clank-mute felt as "my hole in the song" or as punishment? (`clankMuteBeats:0` kills it.)
- F: did you fire your first deliberate volley — and did the chord feel earned?
- G: does the tank-as-fill finally make multi-hit legible? Does landing the 1 into the mercy bloom feel like launching the exhale?
