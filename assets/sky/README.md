# Sky assets

Static equirectangular textures for the Sky Temple (milky shell + planet globes)
and the always-on zodiac belt. Loaded by `index.html` via `sky-maps.js`; served
long-cache/immutable by `vercel.json` (see `SPEC_PERF_V1.md` §P1).

## Layout

| Path | Use | Load timing |
|------|-----|-------------|
| `8k_stars_milky_way.jpg` | Inner milky-way shell (BackSide sphere) | **Temple-first** (on temple enter) |
| `2k_*.jpg` | Planet/luminary globe maps | **Lazy on body focus** |
| `2k_*_ring_alpha.png` | Saturn / Uranus ring alpha strips | Lazy with globe |
| `zodiac/*.png` | 13 Midpoint sign planes (additive, ~0.09 opacity) | **Always-on belt** (queued/idle) |

The `8k_` prefix is the upstream label, not the shipped resolution (see below).

## P2 image pipeline (SPEC_PERF_V1.md §P2, 2026-07-14)

Filenames are unchanged so contract strings (`milkyPath`, `mapForSignPng`) stay
pinned; only the bytes shrank. Originals are recoverable from git history.

| Asset | Before | After | Recipe |
|-------|-------:|------:|--------|
| `8k_stars_milky_way.jpg` | 1861 KB (8192×4096) | **180 KB (3072×1536)** | Lanczos downsample → JPEG q88, progressive, optimized |
| `zodiac/*.png` (×13) | 3911 KB total | **~660 KB total** (38–64 KB ea.) | max-edge 512, FASTOCTREE 128-color quantize, optimized PNG (alpha kept) |

First-temple sky fetch (milky + belt): **~5.8 MB → ~0.84 MB**. Planet maps
(~5.9 MB) are untouched — they are lazy-on-focus and the globe contrast/gamma
pass is tuned against the current encodes, so re-encoding them is a separate pass.

Re-encode recipe lives at `scratchpad/p2/encode_p2.py` (Pillow); regenerate from
the git-history originals if the source art is ever restored at higher res.
