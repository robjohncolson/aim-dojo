# Aim Dojo

A browser-based **rhythm & spatial-audio aim trainer**. A slow groove sets the pulse, with a
woodblock tick on every beat to count by. An orb appears on a beat, somewhere around you —
**beat 1 you find it, beat 2 you track it, beat 3 you fire**. The tempo (or world speed)
adapts automatically to how well you're hitting.

It's a small static site — no build step, no install. Three.js renders the 3D
arena and Tone.js + the Web Audio API drive the rhythm and the distance-aware spatial sound
(close orbs are dry and loud, far ones quiet and washed in reverb).

## Play

**Live:** https://robjohncolson.github.io/aim-dojo/

Or run it locally — just open `index.html` in any modern browser (Chrome/Edge/Firefox/Safari).
Click **ENTER THE DOJO** to lock the mouse and start.

| Input | Action |
|-------|--------|
| **Mouse** | Turn & aim |
| **Left click** | Fire on the beat |
| **Esc** | Pause & settings |

🎧 Headphones help (the spatial audio is a real localization cue), but laptop speakers work too.

## Modes

- **Rhythm** — orbs spawn on the beat and you fire in time; the tempo adapts to your accuracy.
- **Free hunt** — orbs stream continuously and the world speed adapts.

Spawn field can be **360° around** (you have to localize by ear and turn) or **front only**.
Everything — sensitivity, FOV, speed-up / slow-down thresholds, orb density — is adjustable
from the pause/settings screen.

## Share

Use the **⧉ SHARE THIS DOJO** button on the start/pause screen for a QR code and a copy-able
link to the live page.

## Deploy

It's a static site, so any static host works. This repo is published with **GitHub Pages**
(Settings → Pages → Deploy from branch → `main` / root). The QR code and share link use the
page's own URL at runtime, so they work wherever it's hosted.

### Public sky API

The default `clocked` sky always works from static assets: constellation sticks,
Meeus Sun/Moon positions, and the in-game symbolic glossary. It also makes a
soft, timed request to the Sidereal public day endpoint so all 12 major movers
can appear when that service is available.

New visitors start with accelerated **THEATRE** sky motion. Switch to **NATURAL**
in the pause settings to follow real day/night pace; that choice is saved.

The checked-in client uses the public Railway sky-day service. Override it per
visit for local development or another deployment:

```text
https://aim-dojo.vercel.app/?skyApi=http://127.0.0.1:8742
```

A valid `skyApi` URL is persisted as `localStorage['aimdojo.skyApi']`; clear
that key to return to the configured production base. A build may instead set
`CFG.skyDay.api` in `index.html`. The selected override is used only for
anonymous `/api/sky-day` geometry. It never receives an auth token or birth
details.

### Optional Save my sky

The pause settings include a collapsed **SAVE MY SKY** section. Play and
training never require it. A user can request a Supabase email magic link,
save one private birth profile to Sidereal Railway, and clear or replace that
profile later. A saved profile enables authenticated `/api/me/skypack` geometry
and personal `/api/sky-listen` notes; without one, the existing public
sky-day and static glossary remain the complete path.
An explicitly selected `?sky=decorative` keeps the legacy art sky isolated;
the profile stays saved and links again on a `clocked`/`clocked_chart` load.

The checked-in deployment has public browser defaults for the Supabase URL,
anon key, and Sidereal Railway URL. A host can inject different public client
configuration before the main game script runs:

```html
<script>
window.__SIDEREAL__ = {
  saveMySky: true,
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY",
  personalApi: "https://YOUR-SIDEREAL.up.railway.app"
};
</script>
```

`personalApi` defaults to the fixed configured `CFG.skyDay.api` host. It does
not follow `?skyApi` or `localStorage['aimdojo.skyApi']`; those are intentionally
anonymous-only overrides. A nonblank invalid `personalApi` fails closed and
disables personal requests instead of falling through to another host. Set
`saveMySky: false` to hide the section. Never put
a Supabase service-role, secret, or JWT-signing key in this object or any
browser file.

### Cloud play preferences

When signed in, non-sensitive settings sync to Supabase table `aimdojo_prefs`
(own-row RLS) and **supersede** `localStorage` on load:

| Column | Meaning |
|--------|---------|
| `sky_time` | `theatre` / `natural` |
| `wasd_hud` | beat circle on/off |
| `offset_ms` | audio offset |
| `low_rez` | resolution preference |
| `display_name` | records name |
| `dojo_sort` | board sort (`peak_bpm` / `runtime`) |
| `sky_mode` | `clocked` / `decorative` / `clocked_chart` (reload) |
| `sound_on` | mute toggle |
| `wasd_tap_text` | optional timing readout |

Run SQL once: `supabase-prefs.sql`, then `supabase-prefs-v2.sql` for the extra columns.
Without migration, the client falls back to the original four columns.
Birth data never enters this table.

In Supabase Auth, enable email magic links and add each exact deployed page
origin/path (plus local development, for example `http://localhost:8931/`) to
the allowed redirect URLs. The browser follows the current
[`signInWithOtp`](https://supabase.com/docs/reference/javascript/auth-signinwithotp)
flow and keeps only the Supabase-managed session. Birth-form drafts are not
written to local storage, URLs, share links, realtime presence, or the dojo
leaderboard.
Because this client uses Supabase's
[`PKCE` flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), open the
emailed link in the same browser/device that requested it; the initiating
browser holds the verifier needed to finish the session exchange.

The Sidereal API must allow the deployed origin through its sky CORS allowlist
and must be configured to verify access tokens from the same Supabase project.
For local Sidereal development, inject `personalApi: "http://127.0.0.1:8742"`
and serve Aim Dojo over HTTP; `file://` remains fine for guest play but cannot
complete a magic-link/CORS flow.

Client checks use Node's built-in runner and need no install:

```bash
node --check save-my-sky.js
node --test tests/*.test.js
```

## Tech

- [Three.js](https://threejs.org/) r128 (3D scene, WebGL)
- [Tone.js](https://tonejs.github.io/) 14.x (transport, drums) + Web Audio `PositionalAudio` / convolver reverb
- [qrcodejs](https://github.com/davidshimjs/qrcodejs) (client-side QR generation)

All loaded from CDN; nothing to install.

## License

MIT — see [LICENSE](LICENSE).
