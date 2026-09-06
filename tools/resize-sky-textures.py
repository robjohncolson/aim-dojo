"""Build compact sky maps from the retained shipped originals (Pillow 11.2.1).

Run from any directory: python tools/resize-sky-textures.py
Only assets/sky/compact is written. No crop, reprojection, gamma adjustment,
palette change, or source-file replacement is performed.
"""

from hashlib import sha256
import json
from pathlib import Path

from PIL import Image, __version__ as pillow_version, features


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "sky"
OUTPUT = ASSETS / "compact"


def relative(path):
    return path.relative_to(ROOT).as_posix()


def describe(path, size):
    data = path.read_bytes()
    return {
        "path": relative(path),
        "width": size[0],
        "height": size[1],
        "bytes": len(data),
        "sha256": sha256(data).hexdigest(),
    }


def build():
    OUTPUT.mkdir(exist_ok=True)
    sources = [(p, (512, 256), p.stem[3:].replace("_", "-") + ".jpg")
               for p in sorted(ASSETS.glob("2k_*.jpg"))]
    sources.append((ASSETS / "8k_stars_milky_way.jpg", (1024, 512), "milky-way.jpg"))
    manifest = {
        "recipe": {
            "pillow": pillow_version,
            "jpegCodec": features.version_codec("jpg"),
            "resampling": "Lanczos",
            "quality": 88,
            "subsampling": 0,
            "progressive": True,
            "optimize": True,
            "colorAdjustment": "none",
        },
        "assets": [],
    }
    for source, size, name in sources:
        target = OUTPUT / name
        with Image.open(source) as original:
            if original.mode != "RGB" or original.width != original.height * 2:
                raise ValueError(f"Expected an RGB equirectangular 2:1 source: {source}")
            metadata = {key: original.info[key]
                        for key in ("icc_profile", "exif", "xmp", "comment")
                        if original.info.get(key)}
            original_hash = sha256(source.read_bytes()).hexdigest()
            compact = original.resize(size, Image.Resampling.LANCZOS)
            compact.save(target, "JPEG", quality=88, subsampling=0,
                         progressive=True, optimize=True, **metadata)
            with Image.open(target) as result:
                result.load()
                assert result.size == size and result.mode == original.mode
                for key, value in metadata.items():
                    assert result.info.get(key) == value, f"Lost {key}: {target}"
            assert sha256(source.read_bytes()).hexdigest() == original_hash
            manifest["assets"].append({
                "source": describe(source, original.size),
                "compact": describe(target, size),
                "preservedMetadata": sorted(metadata),
            })
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    for entry in manifest["assets"]:
        source, compact = entry["source"], entry["compact"]
        print(f"{compact['path']}: {compact['width']}x{compact['height']}, "
              f"{source['bytes']} -> {compact['bytes']} bytes")


if __name__ == "__main__":
    build()
