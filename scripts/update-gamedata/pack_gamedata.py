#!/usr/bin/env python3
"""Pack .gamedata-assets JSON files into public/data/gamedata.bin.gz."""

from __future__ import annotations

import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS_DIR = ROOT / ".gamedata-assets"
OUTPUT_PATH = ROOT / "public" / "data" / "gamedata.bin.gz"


def main() -> int:
    if not ASSETS_DIR.exists():
        raise SystemExit(f"Missing assets directory: {ASSETS_DIR}")

    combined: dict[str, object] = {}
    for path in sorted(ASSETS_DIR.rglob("*.json")):
        key = path.relative_to(ASSETS_DIR).with_suffix("").as_posix()
        with open(path, encoding="utf-8") as handle:
            combined[key] = json.load(handle)
        print(f"  Loaded {key}")

    raw = json.dumps(combined, separators=(",", ":")).encode("utf-8")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUTPUT_PATH, "wb", compresslevel=9) as handle:
        handle.write(raw)

    print(f"Wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
