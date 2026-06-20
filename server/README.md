# Aim Dojo — verify server (Railway)

A tiny Express service that **validates daily-challenge submissions and is the only writer** to
`aimdojo_daily`. It holds the Supabase **service-role** key (never shipped to the browser) and
rejects implausible scores before inserting. This makes the daily leaderboard trustworthy.

The game keeps working without this — `submitDaily()` falls back to writing straight to Supabase
when no Railway URL is set. Turn verification on by deploying this and pointing the client at it.

## Deploy on Railway

1. **New Project → Deploy from GitHub repo** → pick `aim-dojo`, set **Root Directory** to `server`.
   (Railway runs `npm install` then `npm start`.)
2. **Variables** (from `.env.example`):
   - `SUPABASE_URL` = `https://hgvnytaqmuybzbotosyj.supabase.co`
   - `SUPABASE_SERVICE_KEY` = the **service_role** key (Supabase → Project Settings → API). Keep it secret.
   - `ALLOW_ORIGIN` = `https://robjohncolson.github.io`
3. Deploy, then open `https://<your-app>.up.railway.app/health` — expect `{"ok":true,"configured":true}`.

## Point the client at it

In `index.html`, set the constant:

```js
const RAILWAY_URL='https://<your-app>.up.railway.app';
```

Now daily scores are submitted through the server (`POST /daily`) instead of directly to Supabase.

## Lock the table down (do this AFTER the server is live and verified)

Until now anon could insert directly. Once the server works, remove the anon-insert policy so the
**service role (this server) is the only writer** — anon keeps read access for the board:

```sql
drop policy if exists "aimdojo_daily insert" on public.aimdojo_daily;
-- (keep "aimdojo_daily read"; the service role bypasses RLS, so the server can still insert)
```

## Validation (current)

Structural + plausibility checks: replay must parse, `score ≤ recorded hits`, hit-rate ≤ 8/s,
duration 5–200 s, `day` must equal the server's UTC day, and a per-client per-day rate limit.

**Next level (optional):** full re-simulation — port the seeded spawn law + tempo ramp to Node,
replay the recorded hits against the real orb positions/times, and confirm the claimed kills are
actually achievable. That makes fakes practically impossible but requires keeping the sim in sync
with the client.
