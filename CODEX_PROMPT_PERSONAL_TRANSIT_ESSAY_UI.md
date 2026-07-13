# Codex prompt — Personal transit essay UI (Parcel T2)

Copy everything below the line into Codex.
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

---

## Mission

Wire **async personal sky essays** into Moon Chorus: after a signed-in user has a linked personal chart, enqueue today’s essay on the Sidereal API, poll until ready, toast once, and expose a pause-only reader button.

Be **literal**. Never block PLAY/training on the essay. Never put birth data in toast, share, leaderboard, or URL.

## Required reading (first)

1. **Spec (wins):**
   `/mnt/c/Users/rober/Downloads/Projects/sidereal/SPEC_PERSONAL_TRANSIT_ESSAY.md`
2. Existing Save my sky: `save-my-sky.js`, pause SAVE MY SKY block in `index.html`
3. Personal API base / Bearer patterns already used for `/api/me/natal` and Listen

## Scope — Parcel T2

| ID | Task |
|----|------|
| U1 | After personal chart linked (`personalMode` / hasChart), `POST` enqueue transit essay (idempotent) |
| U2 | Poll `GET /api/me/transit-essay` while pending (visible tab, backoff, stop on ready/failed/timeout) |
| U3 | Toast once: e.g. `SKY NOTE READY` when status becomes ready |
| U4 | Pause UI: button **TODAY’S SKY NOTE** (hidden for guests / no chart; disabled pending; opens reader when ready) |
| U5 | Reader: scrollable pause overlay — headline, body, watchpoints, epistemic footer; close without unpausing game incorrectly |
| U6 | Fail soft: failed/unavailable → quiet status text, no error spam |
| U7 | Tests if pattern exists (contract tests for button placement / no birth fields in share) |

## Out of scope

- Generating essay text client-side
- Changing combat, sky geometry, or shared glossary
- Auto-opening reader during aim

## API (server T1)

- `POST /api/me/transit-essay` + `GET /api/me/transit-essay`
- Bearer only; use `PERSONAL_API_BASE` / Save my sky controller patterns
- Prefer extending `save-my-sky.js` with `enqueueTransitEssay` / `getTransitEssay` rather than ad-hoc fetch sprawl

## UX copy defaults

- Button: `TODAY'S SKY NOTE`
- Pending: `WRITING TODAY'S NOTE…`
- Ready toast: `SKY NOTE READY`
- Failed: `NOTE UNAVAILABLE · PLAY STILL WORKS`
- Epistemic in reader: symbolic study, not predictions

## Verification

- Guest: no private essay calls
- Signed-in + chart: enqueue once per session/day logic
- Mock pending→ready: toast once; pause button opens text
- No essay content in `share` or dojo POST bodies

## Checklist

- [ ] U1–U7
- [ ] Pause-only reader
- [ ] No birth fields in new UI payloads
