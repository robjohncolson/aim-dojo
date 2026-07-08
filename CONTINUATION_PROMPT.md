# CONTINUATION_PROMPT — aim-dojo rhythm-shooter (resume here, 2026-07-07)

> Prior/older session notes live in git history. This supersedes them. Durable design record: memory file `aim-dojo-unified-vision.md`. Deploy facts: memory `aim-dojo-deploy-infra`.

## What aim-dojo is now
A first-person **rhythm shooter** in the Rez / Metal: Hellsinger lineage (it began as a Quake-style aim trainer). Single file: **`index.html`** (~2340-line inline `<script>`, THREE.js r128 + Tone.js, no build). Live at **aim-dojo.vercel.app** — **push to `main` auto-deploys** in seconds (GH Pages is a mirror). This work is the WEB app only; the sibling Godot repos (aim-dojo-iso etc.) are separate.

**Core loop (works, feels good, live):** orbs GLOW on the beat = "fire NOW." You fire a ballistic arc; the shot is "charged" only if you pulled the trigger ON the beat (`pr.charged = orbOpen()` at fire — timing judged at the TRIGGER-PULL, not at arrival). A charged shot kills on hit; an off-beat shot CLANKS (no kill, costs a shot + your streak). You also tap W/A/S/D on the off-beat ("the and") to steady the field. **Aim is always the star — no auto-aim.**

## What this long session built (all live + adversarially verified)
- **Rhythm-shooter core:** fire-on-beat vulnerability judged at the trigger; ms-based fire window `CFG.grooveOpenSec:[0.25,0.10]` (±250ms learning → ±100ms expert — kept generous because it's aim+timing at once); crosshair turns GREEN in the window (but players watch the ORB glow — that's the real cue); off-beat = clank (costs shot+streak); orbs juke on the "and" and glide (never fully stop — `grooveFreezeFloor`); `startBpm:20`, ramps with skill.
- **Deeper audio (2 passes), built ON the existing `grooveI` tier system:** WASD taps SING (lane→pentatonic, voice `tapSynth`); kills WALK UP the A-minor pentatonic with streak through a dedicated LEAD voice (`lead`); a PAD swell layers in at high `grooveI`; `chordHit` de-3rd'd to open fifths; `beatSnap()` grid-snaps kills+taps (tempo-adaptive). All new voices on `drumBus` (mute with pause), guarded.
- **Multi-hit "tank" orbs:** a plain orb (free-play, `CFG.multiHitChance:0.22`) rolls 2-3 hp; each charged on-beat hit CHIPS it (pure progress — NO score/accuracy/groove effect), the last hit kills; a floating number counts down (reuses the dormant `.tgtKey` glyph). Grade cutoffs shifted by `(hpMax-1)` beats so a clean tank kill scores like a normal orb.

## ROADMAP (user wants all 5)
- [x] #1 grid-tighten
- [x] #2 lead line
- [x] #3 multi-hit orbs
- [ ] **#4 RAIL-FLICK BONUS — BUILD THIS NEXT**
- [ ] #5 latency/offset calibration

## NEXT TASK: build the RAIL-FLICK BONUS (#4) — design AGREED (Claude + Codex)
**Loop:** a FLAWLESS on-beat kill on a hot streak triggers it → orb MOTION freezes (the beat clock keeps running) → aiming becomes FLICK (crosshair directly ON an orb, no lead) → tap ANY W/A/S/D ON the beat to LOCK the pointed orb → keep flicking + locking → the bonus ends → locked orbs detonate in a rhythmic cascade, scored as a bonus. Trains FLICK (the complement to the core LEAD skill). No auto-aim.

**Agreed design (Codex's two adjustments baked in):**
- **Trigger:** `good && gradeIdx<=0` (FLAWLESS) AND `state.streak>=4` AND a cooldown (`_bonusLast`, mirror `_clutchLast`) AND `!reduceMotion` AND `!bonusActive`. A treat you earn.
- **Freeze:** orbs HOLD — force the existing `doSnap=false` path (equivalently `_mulEff=0`), and gate spawns + expiry on `!bonusActive`. **NEVER scale `dt` or `Tone.Transport`** (hard codebase rule; the beat MUST keep ticking so on-beat locking works). `state.running` stays true.
- **Flick target:** `scopeLockTarget()` with a TIGHT, size-aware cone (crosshair literally on the orb: `dot >= cos(atan(radius*sc/d))`), bypassing `simShotHits`/`computeShotPlan`. Real aim required.
- **On-beat lock:** branch `wasdLanePress` at the top when `bonusActive` — if `orbOpen()` (on-beat) AND the crosshair is on an orb → lock it (push to `bonusLocks`, mark, sfx), then `return` before the rhythm grid. Any WASD key confirms (gamepad face/D-pad works free).
- **ENDING (forgiving + capped — Codex's adjustments):** base window **2 beats**; each successful lock **+1 beat**; **hard cap 6–8 beats**; **ONE grace miss**; end on the first missed LOCK ATTEMPT (an off-beat tap), NOT merely a beat passing with no lock — so a player who enters with nothing centered doesn't instantly lose the mode before understanding it.
- **Marks:** `#lockBox` = "lockable now" (reuse the gold `.lock` state); per-orb `.tgtKey`/`hlabel` = the persistent "LOCKED" set.
- **Resolve:** cascade over `bonusLocks`, one per beat (drive off the strobe `_quantIdx` / Transport ticks), each scored FLAWLESS (route via `gradeRhythmHit` with a forced grade, or a small `resolveFlickLock`). Bigger cascade = bigger payoff.
- **Suppress fire:** `fire()` early-returns when `bonusActive` (a flick launches no projectile); `clearProjectiles()` on entry.
- **New CFG (`CFG.flickBonus*`):** `streakGate:4, cooldown:~1.5, baseBeats:2, extendBeats:1, capBeats:8, graceMisses:1, cone`.

**Exact code seams (from a recon workflow — RE-VERIFY line numbers, they drift with every edit):**

| Concern | Where |
|---|---|
| Arm bonus | `gradeRhythmHit` (~L1204), after the clutch trigger / before `killTarget` (~L1229) |
| Freeze | `animate` motion block (~L1930): add `if(bonusActive){ doSnap=false; doJuke=false; }` before `else if(wantStrobe && !strobe)`. Guard expiry (~L1979) with `!bonusActive`. Gate `spawnRhythmOrb` in `onGrid` on `!bonusActive`. |
| Flick target | `scopeLockTarget()` (~L1669) — add a `tight` param (size cone vs the flat 0.72). Call it directly from bonus code, NOT via `updateScope` (which does ballistic locking). |
| On-beat gate | `orbOpen()` / `_openAmt` (~L395/394) |
| WASD lock | `wasdLanePress(k)` (~L1253) — branch at the top |
| Marks | `#lockBox` (`lockBoxEl` ~L1647, CSS ~L59); `.tgtKey`/`hlabel` in `updateTargetMarks` (~L1461/1472) |
| Kill/score | `killTarget` (~L780), `gradeRhythmHit` (~L1204), `explodeAt` (~L743) |
| Suppress fire | `fire()` (~L1247) early-return; `clearProjectiles()` (~L1338) |
| New state | near `_openAmt` (~L394): `let bonusActive=false, bonusEndsBeat=0, _bonusLast=-999, _bonusGrace=0; const bonusLocks=[];` |
| Frame tick | add `updateFlickBonus(dt)` to the guarded update cluster (~L2025) — count down the window (in beats via Transport), drive the cascade, end → resolve → unfreeze |
| Reset | `resetSession` (~L2093/2102) — clear bonus state + `tg._flickLocked` |
| Pause abort | `exitRunning` (~L2057) — abort/resolve bonus, unfreeze |

**After building:** syntax-check → run an adversarial VERIFY workflow (it touches score/streak — verify has caught real HIGH bugs this session) → fix findings → ship. Verify specifically: pause-mid-bonus abort, in-flight projectiles cleared on entry, few-orbs-on-screen behavior, the grace-miss/cap logic, and no orb-motion↔beat-clock desync. Then #5.

## THEN #5: latency/offset calibration
The one universal rhythm-game feature still missing. Add a user offset (audio+input) so the fire window aligns with what the player HEARS on their device (Bluetooth adds 100–300ms). The code already latency-corrects via `rawCtx.outputLatency`; add a user-adjustable offset (a short calibration flow or a tunable) and grade against `noteTime + userOffset` in the heard timeline. Research convention: a guided A/V offset step; ms windows ~±16–35 perfect / ±60–130 good.

## Key systems / tunables (for orientation)
- **Groove/vuln (`CFG.groove*`, ~L334):** `grooveGroove` (master kill-switch → reverts to the plain game), `grooveFreezePhase:0.5` (WASD on the "and"), `grooveJukeDeg`, `grooveGlideSpeed`, `grooveFreezeFloor`, `grooveOpenSec:[0.25,0.10]` (fire window, in SECONDS), `grooveVuln`. Helpers: `wasdBeats()` (~L393) phase-shifts the WASD grid; `orbOpen()`/`_openAmt` (~L394) = the fire window (drives the orb glow AND the kill gate); `pr.charged=orbOpen()` set in `spawnProjectile` (~L1331).
- **Audio:** `buildDrums()` (~L825) — voices on `drumBus`: kick/snare/hat/tick/shotCue/bass/arp/tapSynth/pad/lead. `onGrid()` (~L964) = the beat scheduler; `grooveI` tier 0–3 gates the layers (EXTEND HERE for more musical depth). `PENTA`/`ARP` (~L788), `playHit` (kills = lead melody), `chordHit`, `beatSnap()` (~L797), `sfx()`.
- **Targets:** `spawnTarget` (~L1090); `tg` struct fields: kind/hp/hpMax/dead/radius/sc/born/expireAt/vel/mesh/shell. `updateTargetMarks` (~L1461), `killTarget` (~L780), `gradeRhythmHit` (~L1204), `chipHit` (~L1235). Multi-hit CFG (~L352).

## PROCESS (this is how the session worked — keep it)
- **Syntax-check the inline script dynamically** (line 296 shifts after HTML edits):
  ```bash
  F=index.html
  o=$(grep -nE "^<script>$" $F | tail -1 | cut -d: -f1)
  c=$(grep -nE "^</script>$" $F | tail -1 | cut -d: -f1)
  sed -n "$((o+1)),$((c-1))p" $F > /tmp/g.js
  node --check /tmp/g.js
  ```
- **Verify win-condition/score/leaderboard code with an adversarial Workflow** (multi-lens review → per-finding skeptic verify). It has repeatedly caught HIGH bugs the author missed (free-clank spray exploit; tank-kill-scores-zero). Ultracode is ON → use workflows liberally for recon + verify.
- **Ship:** `git add index.html && git commit && git push origin main` (auto-deploys). **Verify live:** `curl -s "aim-dojo.vercel.app/?cb=$RANDOM" | grep -c <marker>` (poll a few times — Vercel builds ~30–60s). Commit messages end with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` line.
- **Audio/feel is EAR/EYE-judged** — ship a reasonable first pass with tunable consts, let the user react ("too hard/easy/loud/muddy"), tune the one number. All initial values are first guesses.
- User prizes the **"zen" feel** — tune via CFG consts, don't add UI (the settings panel was stripped). `prefers-reduced-motion` disables motion effects (check it FIRST if the user says "an effect disappeared").

## Deploy / repo
- Vercel primary (push→live in seconds), GH Pages mirror, Railway server = project reliable-harmony (memory `aim-dojo-deploy-infra`). Repo: github.com/robjohncolson/aim-dojo, branch `main`.
