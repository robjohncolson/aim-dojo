# Public Transits + AI Seed Catalog — Implementation Spec

**Status:** approved direction (2026-07-12), **not implemented**
**Canonical path:** `aim-dojo/SPEC_PUBLIC_TRANSITS_AND_AI_SEEDS.md`
**Repos:** Moon Chorus (`aim-dojo`) · sidereal (Railway) · Supabase (auth + birth profile) · DeepSeek API (async seed author)

**Already shipped (do not redo):** public sky-day, glossary Listen, theatre default, Railway health/sky-day, orb-over-sky combat

**Personal policy:** Geometry + compose for everyone who opts in. AI fills **shared interpretation keys** (not per-user novels). Owner may still use local desk; public path is web Save my sky.

---

## 0. Goals

| Goal | Detail |
|------|--------|
| **Optional personal sky** | Username/play without chart; **Save my sky** adds natal + transit Listen |
| **Current-time transits** | Always “now”; recompute personal pack **once per calendar day** (or first session that day) |
| **Shared text library** | Seeds keyed by interpretation id; one Saturn–Moon trine essay serves all users |
| **AI gap factory** | DeepSeek (or compatible chat API) fills **stub/missing keys**, validates, writes DB |
| **Never block the game** | Listen returns compose immediately; AI is async/cache |
| **Epistemic safety** | Symbolic study only; no medical/financial/death/fate claims |

---

## 1. Non-goals (this program)

- Replacing geometry with LLM “vibes”
- Per-user custom essay corpus as primary storage
- Putting birth data on leaderboards or share URLs
- Requiring chart before PLAY / training
- Live multiplayer synastry

---

## 2. System overview

```
┌──────────────── aim-dojo (Vercel) ────────────────┐
│  PLAY (train) · theatre sky · glossary Listen       │
│  Pause: Save my sky · name · SKY MOTION             │
│  If chart: clocked_chart + personal Listen          │
└─────────────┬───────────────────┬───────────────────┘
              │                   │
              │ JWT / anon        │ public (no auth)
              ▼                   ▼
┌─────────────────────┐   ┌─────────────────────┐
│ Supabase            │   │ Railway sidereal    │
│  auth + username    │   │  /api/sky-day       │
│  natal_charts (0..1)│──►│  /api/me/* natal    │
└─────────────────────┘   │  /api/sky-listen    │
                          │  seed SQLite        │
                          │  DeepSeek worker    │
                          └──────────┬──────────┘
                                     │ cache miss / stub
                                     ▼
                              DeepSeek API
                              (server key only)
```

**Text resolution for any Listen / compose:**

1. SQLite seed `status in (ready, user)`
2. Else SQLite stub / keyword compose
3. Enqueue AI fill for that **interpretation id**
4. Next request uses new seed

---

## 3. Product UX

### 3.1 First run (unchanged)

```
PLAY — WAKE THE MOONLINE → training → Full Night
```

No birth gate.

### 3.2 Pause settings (add)

| Control | Behavior |
|---------|----------|
| Name / username | Existing records name; later bind to auth |
| SKY MOTION | Theatre / natural (shipped) |
| **Save my sky** | Birth date, time (or unknown), place → save |
| **Edit / clear chart** | Update or delete natal |
| (Optional) Observing from | Default = birth place |

After save: toast `SKY · CHART SAVED`; next geometry load uses personal pack.

### 3.3 Listen (with chart)

| Block | Content |
|-------|---------|
| **YOUR CHART** | Transit seals with **title + text** (from seeds; AI-filled over time) |
| **SKY · NOW** | Placement / glossary |

Without chart: glossary only (shipped).

### 3.4 Refresh policy (personal pack)

```
recompute if last_personal_pack_date < today (user tz)
         or natal profile changed
// login twice same day → reuse cached pack
```

Public sky-day remains separate (already day-cached).

---

## 4. Data model (Supabase)

### 4.1 `profiles`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | = `auth.users.id` |
| `username` | text unique | display / board |
| `created_at` | timestamptz | |
| `sky_motion` | text nullable | optional mirror of client pref |

### 4.2 `natal_charts` (0..1 per user)

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | uuid PK/FK | |
| `birth_date` | date | required |
| `birth_time` | time nullable | null → noon + `time_unknown` |
| `time_unknown` | bool | |
| `tz` | text | IANA |
| `lat` / `lon` | float8 nullable | |
| `place_label` | text | |
| `updated_at` | timestamptz | |

**RLS:** user can select/insert/update/delete **own row only**.

### 4.3 Optional `personal_sky_cache`

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | uuid | |
| `cache_date` | date | civil date in user tz |
| `epoch_utc` | timestamptz | |
| `skypack` | jsonb | natal-bearing pack, `privacy: local_only` or `user_private` |
| `updated_at` | timestamptz | |

Alternatively cache only on Railway disk/Redis keyed by `user_id:date` without Supabase JSON — either is fine; document choice in Parcel P.

### 4.4 Leaderboard

Do **not** join birth fields into public dojo board payloads. Name + BPM + time only.

---

## 5. Railway sidereal API (authenticated personal)

### 5.1 Auth

- Client sends Supabase JWT `Authorization: Bearer <access_token>`.
- Railway validates JWT (Supabase JWT secret / JWKS).
- Unauthenticated: sky-day + public glossary path only.

### 5.2 Endpoints (Parcel P)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/me/natal` | Upsert birth profile → compute natal → store |
| `GET` | `/api/me/natal` | Fetch saved profile metadata (no need to return raw ephemeris dump) |
| `DELETE` | `/api/me/natal` | Clear chart |
| `GET` | `/api/me/skypack` | Personal skypack for **today** (cache day) |
| `GET` | `/api/sky-listen` | Extend: if JWT + body, personal block from **user natal** (not only `natal_id` file id) |

Existing file-based `natal_id` charts on disk remain for local desk; Railway public deploy uses Supabase-backed natal.

### 5.3 `POST /api/me/natal` body

```json
{
  "birth_date": "1983-11-29",
  "birth_time": "22:24:00",
  "time_unknown": false,
  "tz": "Asia/Tokyo",
  "lat": 35.68,
  "lon": 139.69,
  "place_label": "Tokyo, Japan"
}
```

Server: validate → write Supabase → run `compute` → optional store chart snapshot → invalidate personal sky cache.

### 5.4 `GET /api/me/skypack`

- Load user natal
- `when` = now (or noon policy consistent with sky-day if desired; prefer **now** for personal)
- Return skypack_v2 shape with `privacy: "user_private"`, `natal_id` = user id or stable slug
- Day cache as §3.4

---

## 6. AI seed catalog (DeepSeek worker) — Parcel Q

### 6.1 Principle

Generate **interpretation records** keyed like the existing store:

- `planet_in_sign:{planet}:{sign}`
- `aspect:{body_a}:{aspect}:{body_b}` (canonical body order as store already uses)
- `sign:{sign}` if needed

Not: `user:bobby:2026-07-12:saturn`.

### 6.2 Trigger

| Trigger | Behavior |
|---------|----------|
| Compose/Listen hits **missing** or **stub** | Enqueue `interpretation_id` |
| Nightly / admin batch | Top N stubs by hit count or static priority list |
| Explicit CLI | `python -m sidereal ai-seed fill --id ...` or `--from-gaps` |

### 6.3 Worker flow

1. De-dupe queue (don’t run 50 jobs for same id).
2. Build prompt from template + key type + keywords from inventory.
3. Call DeepSeek chat API (`DEEPSEEK_API_KEY`, model via `DEEPSEEK_MODEL` env).
4. Parse JSON → map to seed fields: title, summary, growth, keywords, status=`ready` (or `user` if flagged).
5. Validate: schema, max length, banned phrases (`you will`, diagnose, cure, lottery, death prediction, etc.).
6. On pass: insert/update interpretation with version bump rules matching store.
7. On fail: leave stub; log error; optional retry with backoff.

### 6.4 Prompt constraints (system)

Must include:

- Midpoint 13-sign true sidereal; Ophiuchus first-class
- Symbolic study language only
- No medical/financial/legal/crisis claims
- Transit vs natal framing when type is aspect used in transit
- Output **only** JSON matching a fixed schema

### 6.5 Runtime guarantee

Listen/compose **never waits** on DeepSeek longer than optional short timeout (default **0** — fire-and-forget).
First visitor may see stub; second gets AI text.

### 6.6 Storage

- Same SQLite (or Postgres later) interpretation tables as desk.
- Railway volume or baked DB image: prefer **volume** for growing AI seeds so deploys don’t wipe fills.
- Document: `SIDEREAL_DB` path on persistent volume.

### 6.7 CLI

```bash
python -m sidereal ai-seed fill --id 'aspect:moon:trine:saturn'
python -m sidereal ai-seed fill-gaps --limit 20
python -m sidereal ai-seed dry-run --id '...'
```

### 6.8 Tests

- Validator rejects banned phrases
- Mock HTTP: successful fill writes record
- Queue de-dupe
- Compose prefers new ready text over stub

---

## 7. Game client (Parcel R — aim-dojo)

| ID | Task |
|----|------|
| R1 | Pause **Save my sky** form (date, time, unknown time, place fields — place can be lat/lon text v1) |
| R2 | Supabase auth or magic-link / existing name → upgrade path (document chosen auth: email magic link recommended) |
| R3 | On chart save: `POST /api/me/natal` with JWT |
| R4 | If user has chart: boot `GET /api/me/skypack` + enable personal Listen |
| R5 | If no chart: keep public sky-day + glossary (shipped) |
| R6 | Soft error toasts; never block PLAY |

**Auth note:** If full Supabase Auth is heavy for v1, interim: localStorage birth blob + Railway endpoint with a **user token** derived from client id — weaker; prefer real Supabase Auth.

Recommended v1: **Supabase Auth email magic link** + `natal_charts` RLS.

---

## 8. Env vars (Railway)

| Var | Purpose |
|-----|---------|
| `DEEPSEEK_API_KEY` | Server only |
| `DEEPSEEK_MODEL` | e.g. deepseek-chat / current v4 id |
| `DEEPSEEK_BASE_URL` | optional API base |
| `SUPABASE_URL` | |
| `SUPABASE_JWT_SECRET` or JWKS | Validate user tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | Server upsert natal (careful) |
| `SIDEREAL_DB` | Persistent path for seeds |
| `SKY_DAY_CORS_ORIGINS` | Include Vercel |
| `PORT` | Railway |

---

## 9. Work parcels & prompts

| Parcel | Owner | Prompt file | Deliverable |
|--------|--------|-------------|-------------|
| **P** | Codex / sidereal | `sidereal/CODEX_PROMPT_SAVE_MY_SKY_API.md` | Natal upsert + personal skypack API + JWT auth hooks + day cache |
| **Q** | Codex / sidereal | `sidereal/CODEX_PROMPT_AI_SEED_WORKER.md` | DeepSeek fill, validate, CLI, queue, tests |
| **R** | Codex / aim-dojo | `aim-dojo/CODEX_PROMPT_SAVE_MY_SKY_UI.md` | Pause form + wire me/* + personal mode |

**Suggested order:** P (API contracts) → Q (can parallel after seed write path exists) → R (UI).
Q can start against **local file natal** + gap fill without Supabase if P stubs a `NatalProvider` interface.

### Dependency

```
P1 NatalProvider interface
P2 Supabase-backed natal + POST/GET/DELETE /api/me/natal
P3 GET /api/me/skypack (day cache)
P4 sky-listen accepts user natal from JWT
Q1 validator + DeepSeek client
Q2 fill CLI + enqueue from stub
Q3 wire enqueue from sky-listen miss (optional)
R1–R6 game UI
```

---

## 10. Acceptance (program-level)

- [ ] User can play with no chart (theatre + public sky).
- [ ] User can Save my sky once and get personal seals with **text** (seed or AI-filled).
- [ ] Same aspect key filled once serves second user without second DeepSeek call.
- [ ] Banned-phrase validator blocks bad generations.
- [ ] Leaderboard never returns birth fields.
- [ ] API key never in browser bundle.

---

## 11. Epistemic + legal

- UI continues: symbolic study notes, not predictions.
- AI outputs same framing.
- Swiss Ephemeris license already on Railway image path.
- DeepSeek ToS / data retention: don’t send full DOB if key-only prompts suffice.

---

## 12. Agent index

| Prompt | Path |
|--------|------|
| Save my sky API | `sidereal/CODEX_PROMPT_SAVE_MY_SKY_API.md` |
| AI seed worker | `sidereal/CODEX_PROMPT_AI_SEED_WORKER.md` |
| Save my sky UI | `aim-dojo/CODEX_PROMPT_SAVE_MY_SKY_UI.md` |

**This document wins** on product conflicts with older “personal local only forever” notes for the **public optional** path; local desk remains supported.
