// Aim Dojo — daily-challenge verification server (deploy on Railway).
// Holds the Supabase SERVICE-ROLE key (never shipped to the browser) and is the
// only writer to aimdojo_daily. It sanity-checks each submission against its
// replay before inserting, so blatant fakes (e.g. POSTing score 9999 with no
// replay) are rejected. Once this is live, lock down the table so anon can only
// READ (see README) — then the leaderboard can only be written through here.
import express from 'express';

const app = express();
app.use(express.json({ limit: '2mb' }));

const SB_URL = process.env.SUPABASE_URL;                 // https://hgvnytaqmuybzbotosyj.supabase.co
const SVC    = process.env.SUPABASE_SERVICE_KEY;         // service_role JWT — SECRET
const ALLOW  = process.env.ALLOW_ORIGIN || '*';          // e.g. https://robjohncolson.github.io
const HZ = 20;                                           // replay sample rate (matches the client)

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', ALLOW);
  res.set('Access-Control-Allow-Headers', 'content-type');
  res.set('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => res.json({ ok: true, configured: !!(SB_URL && SVC) }));

function dayKeyUTC() { const d = new Date(); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); }

const seen = new Map();                                  // client_id -> { day, count }  (simple per-day rate limit)

app.post('/daily', async (req, res) => {
  if (!SB_URL || !SVC) return res.status(500).json({ err: 'server-not-configured' });
  try {
    const { client_id, name, day, score, accuracy, best_streak, replay } = req.body || {};
    if (typeof client_id !== 'string' || !client_id || client_id.length > 64) return res.status(400).json({ err: 'client_id' });
    if (typeof name !== 'string' || name.length > 24) return res.status(400).json({ err: 'name' });
    if (day !== dayKeyUTC()) return res.status(400).json({ err: 'day' });              // must be *today* by the server clock
    if (!Number.isInteger(score) || score < 0 || score > 5000) return res.status(400).json({ err: 'score' });

    // --- replay sanity check ---
    let r = null; try { r = JSON.parse(replay); } catch (_) {}
    if (!r || !Array.isArray(r.a) || !Array.isArray(r.h) || r.a.length % 2 !== 0) return res.status(400).json({ err: 'replay' });
    const durS = (r.a.length / 2) / HZ;                                               // samples → seconds played
    if (durS < 5 || durS > 200) return res.status(400).json({ err: 'duration' });
    if (score > r.h.length) return res.status(400).json({ err: 'score>hits' });        // can't kill more than you recorded hitting
    if (r.h.length > durS * 8) return res.status(400).json({ err: 'hitrate' });        // >8 hits/sec is superhuman

    // --- per-client per-day rate limit (in-memory; resets on redeploy) ---
    const rec = seen.get(client_id);
    if (rec && rec.day === day) { if (rec.count >= 25) return res.status(429).json({ err: 'rate' }); rec.count++; }
    else seen.set(client_id, { day, count: 1 });

    // --- write with the service role ---
    const ins = await fetch(SB_URL + '/rest/v1/aimdojo_daily', {
      method: 'POST',
      headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ client_id, name, day, score, accuracy: accuracy ?? null, best_streak: best_streak ?? null, replay })
    });
    if (!ins.ok) return res.status(502).json({ err: 'db', detail: (await ins.text()).slice(0, 200) });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ err: 'server' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log('aim-dojo verify server listening on ' + port));
