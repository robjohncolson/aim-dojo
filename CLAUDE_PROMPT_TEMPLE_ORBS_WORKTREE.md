# Claude kickoff — Temple Orbs in an isolated worktree

Copy **everything below the horizontal rule** into Claude Code.  
Do **not** start work in the main `aim-dojo` checkout (Codex may be editing it).

---

## Isolation (do this first — non-negotiable)

**Another agent (Codex) is actively working in:**

`/mnt/c/Users/rober/Downloads/Projects/aim-dojo`

You must **not** edit, stage, commit, or install into that directory.

### 1. Create a worktree from the latest remote main

```bash
cd /mnt/c/Users/rober/Downloads/Projects/aim-dojo

# Free any stale lock only if no other git command is mid-run (check first)
# ls .git/index.lock  # if present and old, wait; do not fight Codex

git fetch origin
git worktree list

# Fresh branch from latest origin/main — sibling directory, not inside aim-dojo/
git worktree add \
  /mnt/c/Users/rober/Downloads/Projects/aim-dojo-wt-temple-orbs \
  -b feature/temple-orbs \
  origin/main
```

If `feature/temple-orbs` already exists:

```bash
git worktree add \
  /mnt/c/Users/rober/Downloads/Projects/aim-dojo-wt-temple-orbs \
  feature/temple-orbs
# then: cd that path && git merge origin/main   # or rebase if you prefer
```

If the worktree path already exists and is valid:

```bash
cd /mnt/c/Users/rober/Downloads/Projects/aim-dojo-wt-temple-orbs
git fetch origin
git merge origin/main   # stay current; resolve only if needed
```

### 2. All subsequent work happens only here

```bash
cd /mnt/c/Users/rober/Downloads/Projects/aim-dojo-wt-temple-orbs
pwd   # must print .../aim-dojo-wt-temple-orbs
```

- Open files, run tests, `git add` / `commit` / `push` **only** from this path.  
- Never `cd` back to `.../Projects/aim-dojo` for edits.  
- If you need a file that only exists in Codex’s dirty tree, **do not copy uncommitted Codex work** unless the user explicitly says to; base on `origin/main` only.

### 3. Push your branch (does not require merging into Codex’s tree)

```bash
git push -u origin feature/temple-orbs
```

Leave merging `feature/temple-orbs` → `main` for a human after Codex finishes.

---

## Mission

Implement **Temple Orbs (Parcel TO)** per:

| Doc | Path (inside the worktree) |
|-----|----------------------------|
| Spec (wins) | `SPEC_TEMPLE_ORBS.md` |
| Implementation checklist | `CODEX_PROMPT_TEMPLE_ORBS.md` |

### Product

1. **Milky-way equirectangular shell** — giant sphere, `BackSide`, child of `skySphere` (player inside the map). Strongest in Sky Temple.  
2. **Temple focus globe** — focus a transit body with a map → large textured sphere (equirectangular NASA-derived map on `SphereGeometry`).

### Format lock

- Maps are **equirectangular** (NASA-derived).  
- Use THREE **SphereGeometry default UVs** — no cube maps, no custom unwrap.  
- Sky shell: `side: THREE.BackSide`. Planet: `side: THREE.FrontSide`.  
- THREE **r128** (project CDN version) — no r15x-only APIs without guards.

---

## TO0 — assets first

```bash
mkdir -p assets/sky
cp "/mnt/c/Users/rober/OneDrive/Desktop/8k_stars_milky_way.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_sun.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_moon.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_mercury.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_venus_atmosphere.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_venus_surface.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_mars.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_jupiter.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_saturn.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_saturn_ring_alpha.png" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_uranus.jpg" assets/sky/
cp "/mnt/c/Users/rober/OneDrive/Desktop/2k_neptune.jpg" assets/sky/
# DO NOT copy 8k_mercury.jpg (~15MB) for v1

git add assets/sky
git status   # all maps must be tracked before any code path references them
```

If a Desktop file is missing, stop and report — do not invent placeholders.

README: one line that maps are equirectangular NASA-derived visualization textures.

---

## Implementation order (from CODEX_PROMPT_TEMPLE_ORBS.md)

1. **TO1** — Milky shell on `skySphere`, temple opacity full, dojo off unless `CFG.skyMaps.dojoShell`  
2. **TO2** — Body map table, lazy load, large camera-relative globe on temple body focus  
3. **TO3** — Saturn rings + sun brightness polish  

Prefer a small `sky-maps.js` UMD module (like `sky-temple.js`) if it keeps `index.html` thinner.

### Critical hooks

- Parent shell under existing **`skySphere`** (attitude / natural sky).  
- Globe show/hide from **`setSkyTempleFocus`** / **`exitSkyTemple`**.  
- Body with map → globe; sign / aspect / natal / nodes / clear → hide globe.  
- Venus = atmosphere map by default.  
- Missing texture = no throw; glyph + HUD still work.

### Avoid merge pain with Codex

Codex may be touching **sky chat** UI in the main tree. Minimize conflict surface:

- Put most logic in **`sky-maps.js`** (new file).  
- In `index.html`, only: script tag, `CFG.skyMaps`, thin hooks in temple focus/enter/exit/updateSky.  
- Do **not** rework sky-chat, pause essay, or save-my-sky unless required for a one-line CFG.  
- Do **not** reformat large unrelated regions of `index.html`.

---

## Verification

```bash
cd /mnt/c/Users/rober/Downloads/Projects/aim-dojo-wt-temple-orbs
ls assets/sky/2k_*.jpg assets/sky/8k_stars_milky_way.jpg assets/sky/2k_saturn_ring_alpha.png
node --test tests/*.test.js
git status
git push -u origin feature/temple-orbs
```

Manual (open worktree build / local server as you normally would for aim-dojo):

1. Temple enter → milky way surrounds.  
2. Focus Mars → large globe + HUD.  
3. Saturn → rings.  
4. Exit temple → globe gone.

---

## Done means

- [ ] Worktree path only; main `aim-dojo` untouched by you  
- [ ] Branch `feature/temple-orbs` pushed to `origin`  
- [ ] Assets tracked + code + tests  
- [ ] Spec §9 acceptance in `SPEC_TEMPLE_ORBS.md`  
- [ ] Short summary of commits + any merge notes for later

**Do not** merge to `main` yourself unless the user explicitly asks after Codex is done.

**Begin:** create the worktree from `origin/main`, `cd` into it, confirm `pwd`, then TO0 assets.
