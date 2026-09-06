# Compact sky maps

These are deterministic reductions of the existing maps in `assets/sky/`.
The original files remain available for the full texture tier. All copyright
and license terms of those source assets continue to apply; this directory
introduces no new artwork or external sources. Embedded XMP, EXIF, ICC profile,
and comment metadata are preserved when present.

The Milky Way is 1024x512; every planet map, including both Venus appearances,
is 512x256. The 2:1 equirectangular projection, orientation and RGB treatment
are unchanged. There is no color grading or gamma adjustment. Rings and zodiac
art retain their existing assets.

Regenerate with Python and Pillow 11.2.1:

```sh
python tools/resize-sky-textures.py
```

The script uses Lanczos resizing and JPEG quality 88, 4:4:4 color sampling,
progressive encoding and optimization. `manifest.json` records source/output
dimensions, download bytes, SHA-256 digests, preserved metadata, and encoder
versions. Byte-identical regeneration requires the recorded Pillow/JPEG versions.

For an RGBA8 texture, excluding mipmaps and driver overhead, the Milky Way uses
2 MiB instead of 18 MiB and each globe uses 0.5 MiB instead of 8 MiB. Globes
remain lazy on focus; these per-map savings are not a claim that every map is
resident at the same time.
