# Codex prompt — Sky Chat UI (Parcel C2)

Copy everything below the line into Codex.  
**Working directory:** `/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

---

## Mission

Implement **Sky Temple Chat UI**: while in temple with a linked chart, the player opens a composer (**T** or **ASK THE SKY**), sends a short question about the current focus, and sees a **day-scoped dialogue** fed by `POST/GET /api/me/sky-chat`.

**Spec wins:**  
`/mnt/c/Users/rober/Downloads/Projects/aim-dojo/SPEC_SKY_CHAT.md`

Do **not** implement the sidereal API (C1). Assume Railway personal API already exposes sky-chat (or mock in tests). Do **not** put chat in dojo combat. Do **not** add spoken VO or Hoʻoponopono HUD text.

---

## Required reading

1. `SPEC_SKY_CHAT.md` §3, §4, §9, §11 client acceptance  
2. Temple panel / focus: `index.html` — `templeActive`, `_templeFocus`, `renderSkyTemplePanel`, pause resume  
3. `save-my-sky.js` — auth session, essay/brief fetch patterns  
4. Existing contract tests under `tests/`

---

## Scope (C2 only)

| ID | Deliverable |
|----|-------------|
| U1 | `CFG.skyChat` knobs per spec |
| U2 | `save-my-sky.js`: `postSkyChat`, `getSkyChat` (Bearer, same base as personal API) |
| U3 | Temple panel dialogue region: turn list + input + SEND + ASK button |
| U4 | **T** opens composer (ignore when typing in forms); Esc closes composer only |
| U5 | Pointer unlock while composer open; relock pattern consistent with temple Esc |
| U6 | Focus snapshot from `_templeFocus` / `_skySel` → focus JSON (`body|sign|natal|aspect|sky`) |
| U7 | Optimistic user turn + `listening…`; poll while pending (visible tab only) |
| U8 | Guest / no chart: hide chat UI; no POST spam |
| U9 | Privacy: chat never in share, dojo, presence, leaderboard, cloud pref columns |
| U10 | Contract tests for CFG, T key, no outbound leakage |

### Out of scope

- Sidereal API / DeepSeek server  
- DELETE clear thread  
- Streaming  
- Pause-only chat about essay (C3 optional)  

---

## Focus snapshot rules

| Temple focus | `focus.kind` |
|--------------|--------------|
| body | `body` + transit body id |
| sign | `sign` + sign id |
| natal ghost | `natal` + `natal_point` |
| aspect | `aspect` + transit body, natal_point, aspect_id |
| none | `sky` |

Server recomputes geometry; send ids only.

---

## UX details

- Message max **500** chars client-side.  
- Show last **12** turns.  
- Epistemic line under dialogue (static string matching product spirit).  
- Failed / unavailable / limited: soft mono message, no stack traces.  
- Pause/resume temple: keep `thread_id` in session memory; re-GET on restore optional.  
- Study glossary body remains above chat; chat is an additional section.

---

## Critical rules

1. Chat UI only when `templeActive` (or composer forced closed when not).  
2. Never open chat from dojo combat.  
3. Never put chat text into realtime / share / leaderboard.  
4. Prefer `textContent` / safe DOM builders (same as temple study) — no model HTML.  
5. Do not re-enable legacy Listen chip as the chat surface.

---

## Verification

```bash
node --test tests/*.test.js
```

Manual:

1. Sign in + chart → temple → T → composer.  
2. Focus Mars → ask a short question → listening… → reply.  
3. Pause / resume temple → thread still there.  
4. Guest → no ASK / T.  
5. Leave temple (E) → chat closed.

---

## Suggested commits

1. `Add sky-chat API helpers on save-my-sky client.`  
2. `Temple ASK THE SKY composer with day-thread poll.`  
3. `Contract tests for sky chat privacy and temple gating.`  

---

## Checklist

- [ ] U1–U10  
- [ ] Spec §11 client acceptance  
- [ ] Tests green  
- [ ] No server package edits  
