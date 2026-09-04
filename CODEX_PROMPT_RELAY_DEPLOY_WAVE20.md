# Codex prompt — Deploy the Ghost Relay (wave 20 Parcel G, sidereal `ghost-relay-wave20` → main → Railway)

**Completed 2026-09-04:** sidereal `d2c460f` reached Railway SUCCESS; all three known nights survived and returned
boolean `reachedBack:false`. This is the completed wave-20 runbook snapshot, not a pending deployment request.
Before reuse, update and re-verify the commit pins, branch state, live baseline, and expected relay population.
The optional mail POST was not executed and has been removed to keep verification consistent with hard law 2.
The original scan's byte-size false positive is resolved; see `CONTINUATION_PROMPT.md` §-27.

**Working directory:** `C:/Users/rober/Downloads/Projects/sidereal` (the relay server repo; branch `ghost-relay-wave20` is checked out, tree clean at start). From WSL the same checkout is `/mnt/c/Users/rober/Downloads/Projects/sidereal`. The game client lives in the sibling repo `C:/Users/rober/Downloads/Projects/aim-dojo` — you only READ from it and run one script there.

**This task contains exactly ONE production action: a fast-forward push of sidereal `origin/main`.** Nothing else may be committed, pushed, merged, force-pushed, or deployed. Do not commit or push anything in `aim-dojo`. Do not edit `CLAUDE.md`/`AGENTS.md`/`CONTINUATION_PROMPT.md` (the dispatcher records the deploy). Do not run `railway up`, `railway redeploy`, `railway variables set`, or touch the Railway volume. Every fact below was verified on 2026-09-04 (git, Railway CLI, live HTTP, 125 relay tests, three independent adversarial reviews); re-check the preflight anyway and STOP if anything differs.

---

## Mission

The live game (aim-dojo on Vercel, `e06ebfc`) already ships the wave-20 client: three visitor seats, one mail batch per visitor, and the strict-boolean `reachedBack` line. The LIVE relay is still `5301864` (2026-08-23), which cools mail ≥60 s **per sender token** — so with two or more visitors the 2nd/3rd mail batches 429 and the notes are silently not delivered. Parcel G's relay half fixes this (`ghost_seen` table, `reachedBack` in `GET /api/ghosts`, mail cooldown scoped per sender × target revision). It sits on sidereal branch `ghost-relay-wave20` at `d2c460f`, exactly one commit ahead of `origin/main`, tests green, never deployed.

**The relay is no longer empty.** On 2026-09-04 `GET /api/ghosts?lon=8&n=4` returned three real human nights (all lonBucket 8 / moonBucket 6: 2026-09-03 at 229 s / 27 targets / 107 taps, and two on 2026-09-04 at 141 s and 134 s). Mail between them can be lost to the 429 until this ships, and those rows MUST survive the deploy (they will — see §Why it is safe).

## How the relay deploys (the mechanism)

- Railway project **`ideal-embrace`**, service **`sidereal`**, environment `production`, public host `https://sidereal-production.up.railway.app`. (Not `reliable-harmony` — that is the aim-dojo anti-cheat server.)
- The service is GitHub-connected to `robjohncolson/sidereal`, branch `main`, `watchPatterns` empty, builder `DOCKERFILE` (`Dockerfile` + `railway.toml`; healthcheck `/api/health`, 120 s). Every deployment in its history was created seconds after a push to `main`. **A push to `origin/main` IS the deploy.** There is no other step.
- The build compiles `pyswisseph` from source, so expect several minutes. Railway keeps the previous deployment serving until the new one passes the healthcheck.
- Data lives on volume `sidereal-volume` mounted at `/data`; `SIDEREAL_DB=/data/sidereal.db`; `SIDEREAL_GHOST_RELAY_DB` is unset, so the relay DB defaults to `/data/ghost-relay.db` beside it. Redeploys do not touch the volume.
- The Windows `railway` CLI (authed as bobby) is already linked in the sidereal directory (`railway status` → `ideal-embrace / production / sidereal`). Run Railway commands from a Windows shell (Git Bash or PowerShell); the WSL `railway` on PATH is the Windows npm shim and is not reliable there.

## Why it is safe (verified; do not re-derive, but do not skip the preflight)

- `d2c460f` has the single parent `5301864` = `origin/main` (`git ls-remote` confirmed the remote has not moved). Fast-forward only; GitHub `main` is unprotected, no rulesets.
- The commit touches only `RAILWAY.md`, `SPEC_GHOST_RELAY.md`, `src/sidereal/ghost_relay.py`, `tests/test_ghost_relay.py`. `Dockerfile`, `railway.toml`, `scripts/railway-start.sh`, `pyproject.toml`, `.dockerignore` are byte-identical to the running deployment. No new imports, no new env var (`ghost_relay.py` still reads only `SIDEREAL_GHOST_RELAY_DB`, optional).
- Schema delta is purely additive and lazy (`CREATE TABLE/INDEX/TRIGGER IF NOT EXISTS` in `_connect`): `ghost_seen` + two indexes, `ghost_mail_batch_target_token_idx`, trigger `ghost_relay_seen_delete`. No ALTER, no `user_version`. Opening a populated `5301864` file with the new code preserved every row (tested against a real DB copy; `tests/test_ghost_relay.py::test_seen_schema_migrates_additively_and_carries_no_identity_fields` pins it). Rollback is also safe: the old module reads the upgraded file.
- Debian bookworm's SQLite 3.40.1 (Docker base) has everything the new SQL uses (CTE, `ON CONFLICT DO UPDATE`, triggers, incremental vacuum).
- Client contract: the live client validates `typeof item.reachedBack==='boolean'?item.reachedBack:false` (absent → plain line), POSTs `{toId, catches}` which matches the server's exact-key check, and uses the same paths and the `X-Ghost-Token` header. No client change is needed.

## Hard laws for the live smoke (violating these damages real players' nights)

1. **NEVER `GET /api/ghost-mail` with any token you did not create this minute.** It is read-once: the server SELECTs then DELETEs the mailbox in one transaction.
2. **NEVER `POST /api/ghost-mail` to a real night's `id`, even with `catches: []`.** It still inserts a `ghost_mail_batch` row: your smoke token becomes `reachedBack=true` for that player and is seated FIRST as "a visitor who reached back" for 10 days, it burns one of that target revision's only **4** ingress batches, and it permanently burns the one-batch-per-sender→target allowance.
3. **Do not upload smoke ghosts (`POST /api/ghost`)** unless the user explicitly asks for the live two-target mail proof. There is no DELETE; a smoke ghost is a visible visitor to the three real players for 10 days, and the new ordering (reached-back → unseen → distance) seats unseen smoke ghosts ahead of already-seen real nights.
4. The §-16 item-0 smoke as written ("two mail POSTs to two targets from one throwaway sender both 200") is **wrong on both builds**: `append_mail` looks the SENDER up in `ghost_relay` first and raises `GhostRelayNotFoundError` → HTTP 404 `Sender or target ghost is unavailable` for any token that never uploaded. The per-target cooldown is already pinned by `tests/test_ghost_relay.py::test_mail_cooldown_is_per_target_revision_for_three_same_instant_posts` (three same-instant posts → 200/200/200, duplicate → 429). Do not try to prove it live.
5. `GET /api/ghosts` with a throwaway token is allowed and bounded: it writes at most one `ghost_seen` row per (viewer, ghost) pair (≤3 rows today), expiring in 10 days, lowest eviction priority. Reads are limited to 120/min per address and 8 concurrent — stay sequential.
6. `/api/health` carries no build marker (`sidereal_version` is `0.1.0` on both builds). The ONLY discriminator that the new code is live is the presence of a **boolean `reachedBack` key on every ghost** in `GET /api/ghosts` (the old build omits the key), or `railway deployment list` showing `d2c460f` `SUCCESS`.

---

## Steps

### S0 — Preflight (all must hold; otherwise STOP and report, do not push)

```bash
cd C:/Users/rober/Downloads/Projects/sidereal
git fetch origin
git status --short --branch            # exactly: ## ghost-relay-wave20...origin/main [ahead 1]   (clean tree)
git rev-parse --short HEAD; git rev-parse --short origin/main   # d2c460f then 5301864
git rev-list --left-right --count ghost-relay-wave20...origin/main   # 1	0
git merge-base --is-ancestor origin/main ghost-relay-wave20 && echo FF-OK
git diff --name-status origin/main ghost-relay-wave20   # exactly the four files named above
git log -1 --format='%H %P' d2c460f    # single parent 530186481df95b028eb0e73b6406668b9e5620fc
railway status                          # Project: ideal-embrace / Environment: production / Service: sidereal
curl -s https://sidereal-production.up.railway.app/api/health   # {"status":"ok",...}
```

Run the relay tests once more (Linux venv, so via WSL):

```bash
wsl -e bash -lc "cd /mnt/c/Users/rober/Downloads/Projects/sidereal && . .venv/bin/activate && python -m pytest tests/test_ghost_relay.py -q"
# expect: 125 passed
```

If `origin/main` is not `5301864`, the count is not `1 0`, the tree is dirty, the file list differs, or any test fails: STOP, do not push, report what you saw.

### S1 — Deploy (the one production action)

```bash
git push origin ghost-relay-wave20:main
git ls-remote origin refs/heads/main    # d2c460f02d72c783ff2c165f774cfcc3b9236670
```

### S2 — Wait for the build to go live (gate before any smoke)

```bash
railway deployment list                 # newest row: commit d2c460f, status BUILDING → DEPLOYING → SUCCESS
```

Poll every ~60 s, up to ~15 minutes. Only proceed when `d2c460f` is `SUCCESS`. If it ends `FAILED`/`CRASHED`: `railway logs` (read only), report the log tail, do NOT redeploy or push anything else — the previous deployment keeps serving. (If the CLI misbehaves, the dashboard for project `ideal-embrace` shows the same.)

### S3 — Verify (read-only against production)

```bash
curl -s -i https://sidereal-production.up.railway.app/api/health | head -1     # HTTP/1.1 200

T=$(openssl rand -hex 16)   # throwaway viewer token, used ONLY for GET /api/ghosts
curl -s -H "X-Ghost-Token: $T" "https://sidereal-production.up.railway.app/api/ghosts?lon=8&n=4" \
 | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);let ok=true;for(const g of o.ghosts){const t=typeof g.reachedBack;ok=ok&&t==="boolean";console.log(g.id.slice(0,8),"lon="+g.lonBucket,"date="+g.artifact.date,"dur="+g.artifact.dur,"reachedBack="+g.reachedBack,"("+t+")")}console.log(o.ghosts.length+" ghosts; reachedBack boolean on all: "+ok)})'
# expect: the 3 known nights (lon 8; dates 2026-09-03 / 2026-09-04 / 2026-09-04), each reachedBack=false (boolean), "on all: true"
```

Then the scan from the game repo (GET-only, 24 sequential buckets, its own throwaway token):

```bash
cd C:/Users/rober/Downloads/Projects/aim-dojo && node tools/relay-scan.mjs
# expect: the same 3 nights, all flagged human (not SMOKE)
```

Read the first deploy log lines once for a relay storage error (the additive DDL runs lazily on the FIRST relay request, not at boot):

```bash
cd C:/Users/rober/Downloads/Projects/sidereal && railway logs 2>&1 | grep -i -E "GhostRelayStoreError|storage is unavailable|Traceback" | head
# expect: no output
```

### S4 — Sync local git (no production effect)

```bash
cd C:/Users/rober/Downloads/Projects/sidereal
git checkout main && git pull --ff-only     # 534da85 → d2c460f
git branch -d ghost-relay-wave20            # optional; it is now identical to main
git status --short --branch                 # ## main...origin/main   (clean)
```

### S5 — Nothing else

Out of scope: any aim-dojo edit, any relay code change, seeding or cleaning the relay, changing Railway variables, the wave-8 ruling for Parcel H, wave 21/22 parcels. If you notice something wrong, report it; do not fix it here.

---

## Rollback (only if S2 fails or S3 shows a broken relay; report first, act only if the user says so)

Railway dashboard → project `ideal-embrace` → service `sidereal` → deployment `5301864` → Redeploy. The old code reads the upgraded database file safely (verified). Do not `git push --force`.

## Final message format

1. Preflight: the exact output of every S0 command (or the STOP reason).
2. Deploy: the `git push` output and the `git ls-remote` hash.
3. Build: the `railway deployment list` row for `d2c460f` with its final status and roughly how long it took.
4. Verify: the health status line, the parsed ghost list with the `reachedBack` types, the `relay-scan.mjs` summary, and the (empty) log grep.
5. Sync: the final `git status --short --branch` of sidereal.
6. Anything unexpected, said plainly — including any night on the relay that is not one of the three listed above (a new friend may have played; that is good news, not an error).
