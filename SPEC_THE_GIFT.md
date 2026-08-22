# The Gift — Wave 14 (phase 0b-client: you reach back for the notes last night dropped)

**Version:** 1.0 · 2026-08-22
**Origin:** the chorus design (user-approved): helping is a gift — "shooting way over if I don't have a target during one of my beats." Transport (other players' ghosts) is blocked on the sidereal server repo, absent from this machine — so this wave ships the HELPING VERB against the ghost that already rides beside you, self-addressed. Every rule here is the rule strangers will inherit.
**Files touched:** `index.html` (+ regenerated mirrors). No server.
**Follows:** Wave 13 (`378c005`). The ghost seat, recorder, and every solo family are law; this wave only ADDS.

## 0. What ships, in one breath

During your mercy — walls down, the ghost revealed, your beats free — the ghost's **flares** (the beacon-lit notes it is about to drop) become something you can DO something about: aim across the ninety metres, fire, and if your arc connects, the note dies in a shooting-star streak instead of expiring — **caught**. A gift shot is blessed with the expert's muzzle speed whatever your tempo, is graded on **connection only** (never on rhythm — their clock is not yours), and **can never hurt you** (a missed gift carries no clank, no trauma, no wall-dim, no streak touch). Catches are remembered beside the ghost, and your next session's threshold greeting says you reached back. The verb the whole chorus will use, tuned first against yourself.

## 1. Parcel F — THE FLARE IS A TARGET

- A ghost target is **giftable** while its beacon burns: `outcome=0` and replay time inside `[arrivalT − GH_BEACON_LEAD, arrivalT]` (once past arrival it is lost — you catch a falling note, not a dead one) — AND the reveal is open (`v ≥ GH_GIFT_V`, named const, 0.7: the exhale has opened the room enough to see across).
- **Lock assist extends, never duplicates:** the existing path-accurate lock (`simShotHits` law) gains the giftable flares as candidate targets — position from `ghostTargetPosition` (deterministic), radius a named `GH_GIFT_R` (generous, ~2.2 m — catching is warm, sniping is not the skill). The reticle confirms exactly as it does for live orbs. The lock prefers a REAL target when one exists (the player's own game always outranks charity).
- Aiming reads: the flare's white ring is the aim point; the beacon column is the flag, not the target.

## 2. Parcel B — THE BLESSED SHOT and THE CATCH

- A shot fired while a giftable flare is LOCKED is a **gift shot**: muzzle speed `projSpeedFast` regardless of `diffT` (mercy lends your arm the expert's strength — a named-law comment; the plan/back-solve uses the same speed so the preview ribbon tells the truth). Everything else about the projectile — gravity, wind, arc ribbon, flight — is the shipped physics.
- **Connection grading only.** The gift projectile is marched against the flare's deterministic position (the `simShotHits` pattern; the ghost juke is replayed, so lead is real skill). Connect within `GH_GIFT_R` → **CAUGHT**: the flare dies in a pooled shooting-star burst (warm-white core + the note's ghosted lane colour, reuse the ghost burst family with a `GH_CATCH_*` scale — bigger than a ghost FLAWLESS, this is the wave's firework), the beacon extinguishes with a rising sigh (fade upward, not a snuff), the ring blinks white once. No rhythm window anywhere in the path.
- **A gift can never hurt** (the gift-economy law, absolute): a gift shot that misses simply falls into the stars — `onWhiff`'s punitive taps (streak reset, trauma, reticle-bad flash, groove duck, wall-echo `uWallMiss` stamp) are ALL suppressed for a projectile tagged as a gift; the tag is set at launch from the lock state and never inferred later. The quiet whiff bookkeeping that keeps counters honest may run; nothing the player can FEEL fires. Construct the mutant that lets one punitive tap through.
- **Gameplay isolation, both directions:** the catch writes nothing into grading, streak, difficulty, spawning, or any RNG stream — it is visual + mail only. The ghost's RECORDING is never modified (last night happened; you caught what fell, you didn't rewrite it). Gift shots still record into MY night's artifact as ordinary fire rows (my ghost tomorrow aims where I aimed tonight).
- A gift shot cannot hit MY world's targets and a normal shot cannot catch a flare — the tag routes collision exclusively. (During mercy nothing new arrives, but stragglers exist; no crossover ever.)

## 3. Parcel M — THE SELF-MAIL

- Catches append `[roadT, lane]` to a tiny ledger stored WITH the ghost artifact's wrapper (same localStorage slot family, `GH_CAP_MAIL` = 64, drop-oldest; inside the same fail-soft boundary as finalize — mail can never cost a night).
- Next session's threshold line (the reunion/deal speaker, one line as always, comeback > mail > deal): **"you reached back · N notes caught"** (T()-localized, JA included). Spoken once, then the ledger clears with the ghost's own overwrite — ephemeral by design, like everything here.
- When transport arrives (0c), this exact ledger — keyed to a ghost artifact — becomes the mail we deliver to the ghost's real owner. Nothing about its shape may assume "self."

## 4. Contracts

- Flat knob `ghostGift:1`, raw-boolean-first, decision comment; `ghostGift:0` → wave-13 behaviour byte-identical (no lock candidates, no tag, no ledger, no greeting line; emission fixtures for MY families already exist — extend the knob matrix to cover it, alone and combined with ghostRecord/ghostSeat).
- One clock: giftability windows and catch stamps on the road clock (`ghostRoadTime` authority from wave 13). No `state.t` in any new path (the wave-13 lesson, twice-paid).
- Lane law: catch colours derived from `WASD_COL`/the ghost tint helpers only.
- Named consts: `GH_GIFT_V`, `GH_GIFT_R`, `GH_CAP_MAIL`, `GH_CATCH_*` — no anonymous literals (the round-2b lesson).
- reduceMotion: catch burst becomes the standing-glow variant; beacon sigh becomes a fade. LOW: catch burst uses the LOW cap (may be 0 birds — the ring blink and beacon sigh still read).
- House laws: no code after `//`; re-scan touched multi-statement lines (`onWhiff` and the fire path are dense — the wave-9 swallow lived in `onExpire`); mirrors LAST; mutation-verify every new test by constructing the survivor; do NOT invoke any gitnexus CLI (it hangs in the sandbox — the dispatcher owns impact analysis).
- Perf: knob off/on × hi/low staged at the reveal with a locked flare — dispatcher measures; expected ≈ 0 (the lock loop gains ≤ a handful of candidates; the burst is pooled).

## 5. Playtest questions

Does catching feel like GIVING (relief arriving somewhere) or like scoring? Is the blessed 72 m/s arc readable at 28 bpm — does the preview ribbon make the 90 m lob feel throwable? Does "you reached back · N notes caught" land as warmth at the threshold? And the tuning trio for the dispatcher's render pass: `GH_GIFT_R` generosity, catch-burst size, beacon-sigh length.
