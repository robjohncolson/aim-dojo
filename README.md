# Aim Dojo

A browser-based **rhythm & spatial-audio aim trainer**. A slow groove sets the pulse, with a
woodblock tick on every beat to count by. An orb appears on a beat, somewhere around you —
**beat 1 you find it, beat 2 you track it, beat 3 you fire**. The tempo (or world speed)
adapts automatically to how well you're hitting.

It's a single, self-contained HTML file — no build step, no install. Three.js renders the 3D
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
`CFG.skyDay.api` in `index.html`. The selected base is used only
for anonymous `/api/sky-day` geometry. Personal natal `sky-listen` enrichment
remains explicitly local on `CFG.skyListen.api` and is requested only when a
real personal skypack supplies `natal_id`.

## Tech

- [Three.js](https://threejs.org/) r128 (3D scene, WebGL)
- [Tone.js](https://tonejs.github.io/) 14.x (transport, drums) + Web Audio `PositionalAudio` / convolver reverb
- [qrcodejs](https://github.com/davidshimjs/qrcodejs) (client-side QR generation)

All loaded from CDN; nothing to install.

## License

MIT — see [LICENSE](LICENSE).
