# Moon Chorus

*(repo, domain and storage keys stay `aim-dojo` — the name is display-only)*

A browser-based **rhythm & spatial-audio aim trainer played under a real sky**. A slow groove sets
the pulse; Echoes appear on the beat, somewhere around you, and each one's *distance is its rhythm* —
spawn distances are quantized so the flight time of your shot is a whole number of sixteenths. You
are graded at **arrival**, not on the trigger: the link has to reach the Echo while it is glowing, so
a far voice needs an earlier send than a near one, and two shots fired a beat apart can land together.
Between sends you press the letter the floor flashes, which steadies the Moonline. The tempo adapts
to how you're doing, and every Echo you land is a voice carried home.

Around that loop the night has a life of its own: it comes in **swells** with a mercy bar to breathe
in; the metronome **thins out** as your arrivals steady, until the quiet is the reward; the amber
multi-hit Echo asks for a stated **drum fill** instead of a flurry; each Echo calls from the bearing
of a **real star that is actually up**, and landing its voice brightens that star in your sky
permanently — brightened stars form a **standing chorus** that sings back to you on the start screen
when you return. The real moon phase **deals the night's one rule**, named in a single line at the
threshold. Holster — stop playing for a dozen quiet seconds — and the night **bows** on purpose: the
last Echoes rise, the music resolves, one wordless glyph of your own timing, one true line, and a
**night card** waiting at the door. Nothing in there is configured; it is all discovered.

It's a small static site — no build step, no install. Three.js renders the arena and the sky,
Tone.js + the Web Audio API drive the rhythm and the distance-aware spatial sound (close Echoes are
dry and loud, far ones quiet and washed in reverb).

## Play

**Live:** [aim-dojo.vercel.app](https://aim-dojo.vercel.app) · mirror: https://robjohncolson.github.io/aim-dojo/

Or run it locally — just open `index.html` in any modern browser (Chrome/Edge/Firefox/Safari).
Press **PLAY — WAKE THE MOONLINE** to lock the mouse and start. Every visit begins with Moon Sensei's
short training night (step → send → land, three phases), then opens into the full night.

| Input | Action |
|-------|--------|
| **Mouse** | Turn & aim |
| **WASD** | Step on the letter the floor flashes |
| **Left click** | Send — land it while the Echo glows |
| **Right click** | Close a sky note (in THEATRE, hold the sky still) |
| **Hold E + click** | Mark a star under the reticle |
| **E** | With a mark: enter the Sky Temple · in the Temple: leave |
| **Shift+E** | In the Temple: free the mouse (view stays put) |
| **T** | In the Temple: ask the sky (needs a saved chart) |
| **Esc** | Pause / resume |
| **Drag / SEND** | Touch equivalents of aim and fire |

In-game **HELP** lives in the pause card (PLAY · SKY · CHART · **HELP**) and repeats all of this in
the game's own language.

🎧 Headphones help — the spatial audio is a real localization cue, and the chorus is worth hearing —
but laptop speakers work too.

## Share

Use the **⧉ SHARE** button on the start/pause screen for a QR code and a copy-able link to the live
page.

## Deploy

It's a static site, so any static host works.

**Production (primary):** [aim-dojo.vercel.app](https://aim-dojo.vercel.app) — Git push to `main` auto-deploys.

**GitHub Pages** also works (Settings → Pages → Deploy from branch → `main` / root). The QR code
and share link use the page's own URL at runtime, so they work wherever it's hosted.

### Vercel cache (`vercel.json`)

| Path | Cache-Control | Why |
|------|---------------|-----|
| `/` · `/index.html` | `max-age=0, must-revalidate` | New deploys show up immediately |
| Root modules (`observer-location.js`, `local-sky.js`, `sky-temple.js`, `sky-maps.js`, `save-my-sky.js`) | `max-age=0, must-revalidate` | Root modules revalidate on every load alongside fresh HTML |
| `/assets/**` · `/fixtures/**` · `*.css` · `*.woff` · `*.woff2` | `max-age=604800` (7 days) + SWR | Heavy sky textures and styles stay warm on return visits |

Filenames are **not** content-hashed. After changing a sky JPEG/PNG in place, browsers may keep
the old file for up to 7 days (or until a hard refresh). To force a bust, rename the file and
update the path in `sky-maps.js` / `CFG.skyMaps`.

### Public sky API

The default `clocked` sky always works from static assets: constellation sticks,
Meeus Sun/Moon positions, and the in-game symbolic glossary. It also makes a
soft, timed request to the Sidereal public day endpoint so all 12 major movers
can appear when that service is available.

The sky runs at **NATURAL** pace by default — real day/night motion for your location. **THEATRE**
(a sky that wheels in minutes) is opt-in from the pause card's SKY tab or `?theatre=1`; that choice
is saved.

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

The pause card's **CHART** tab holds a **SAVE MY SKY** section. Play and
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

Your lit sky, witnessed moon phases, and most recent night card live in `localStorage['aimdojo.*']` only.
`aimdojo.ghost` holds the last night locally and may be shared when the Visitor is enabled; optional same-moon
memories in `aimdojo.ghostPhase` remain private to this browser and are never uploaded.

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
- [Tone.js](https://tonejs.github.io/) 14.8.49 (transport, drums) + Web Audio `PositionalAudio` / convolver reverb
- [supabase-js](https://supabase.com/docs/reference/javascript) 2.x (optional sign-in, records, cloud prefs)
- [qrcodejs](https://github.com/davidshimjs/qrcodejs) (client-side QR generation)

All loaded from CDN; nothing to install.

## Sky & planet maps

The Sky Temple's celestial backdrop and planet globes use **equirectangular
NASA-derived visualization textures** (`assets/sky/`). Not affiliated with NASA;
symbolic game use only. The zodiac stick figures the Echoes call from are drawn from
`fixtures/zodiac_sticks_v1.json`.

## License

MIT — see [LICENSE](LICENSE).
