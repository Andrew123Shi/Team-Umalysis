"""Extract Team Stadium team-rank icons from local game assets.

Team rank badges live at race/teamstadium/tex_team_rank_icon_XXX (not atlas/rank/).
Thresholds are in master.mdb team_stadium_rank.
"""

from __future__ import annotations

import json
import os
import sqlite3
import struct
import sys
from collections import defaultdict
from pathlib import Path

import apsw
import UnityPy
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "assets" / "textures" / "team_ranks"
RANK_DATA_OUT = ROOT / "public" / "data" / "team_stadium_rank.json"
RANK_DATA_SRC = ROOT / "src" / "data" / "team_stadium_rank.json"

DB_BASE_KEY = b"\xF1\x70\xCE\xA4\xDF\xCE\xA3\xE1\xA5\xD8\xC7\x0B\xD1\x00\x00\x00"
JP_DB_KEY = b"\x6D\x5B\x65\x33\x63\x36\x63\x25\x54\x71\x2D\x73\x50\x53\x63\x38\x6D\x34\x37\x7B\x35\x63\x70\x23\x37\x34\x53\x29\x73\x43\x36\x33"
# Matches UmaViewer Config.GlobalDBKey (Steam Global meta encryption).
GLOBAL_DB_KEY = bytes(
    [
        0x36,
        0x23,
        0x6B,
        0x4C,
        0x2A,
        0x39,
        0x21,
        0x75,
        0x52,
        0x26,
        0x32,
        0x76,
        0x25,
        0x50,
        0x3F,
        0x35,
        0x5D,
        0x77,
        0x58,
        0x6D,
        0x40,
        0x71,
        0x38,
        0x5E,
        0x4C,
        0x31,
        0x28,
        0x74,
        0x29,
        0x59,
        0x37,
        0x24,
        0x53,
    ]
)
AB_KEY = b"\x53\x2B\x46\x31\xE4\xA7\xB9\x47\x3E\x7C\xFB"

ASSET_QUERY = """
SELECT "n", "h", "e" FROM "a"
WHERE "n" LIKE 'race/teamstadium/tex_team_rank_icon_%'
ORDER BY "n"
"""


def dict_factory(cursor, row):
    description = [d[0] for d in cursor.get_description()]
    return {key: value for key, value in zip(description, row)}


def derive_db_key(region: str = "auto") -> bytes:
    if region == "auto":
        region = os.environ.get("UMA_REGION", "auto")
    if region == "auto":
        region = _detect_region()
    raw = GLOBAL_DB_KEY if region == "global" else JP_DB_KEY
    key = bytearray(raw)
    for i in range(len(key)):
        key[i] ^= DB_BASE_KEY[i % 13]
    return bytes(key)


def _detect_region() -> str:
    meta, _, _ = get_paths()
    for label, raw in (("global", GLOBAL_DB_KEY), ("jp", JP_DB_KEY)):
        key = bytearray(raw)
        for i in range(len(key)):
            key[i] ^= DB_BASE_KEY[i % 13]
        try:
            conn = apsw.Connection(str(meta))
            conn.pragma("cipher", "chacha20")
            conn.pragma("hexkey", bytes(key).hex())
            next(conn.execute('SELECT COUNT(*) FROM "a"'))
            conn.close()
            return label
        except Exception:
            continue
    raise RuntimeError("Could not decrypt meta with JP or Global keys")


def get_paths() -> tuple[Path, Path, Path]:
    appdata = Path(os.environ["LOCALAPPDATA"]) / ".." / "LocalLow" / "Cygames" / "umamusume"
    appdata = appdata.resolve()
    meta = appdata / "meta"
    dat = appdata / "dat"
    master = appdata / "master" / "master.mdb"
    if not meta.exists():
        raise FileNotFoundError(f"meta not found: {meta}")
    if not dat.exists():
        raise FileNotFoundError(f"dat not found: {dat}")
    return meta, dat, master


def meta_conn(meta_path: Path, region: str = "auto"):
    conn = apsw.Connection(str(meta_path))
    conn.row_trace = dict_factory
    conn.pragma("cipher", "chacha20")
    conn.pragma("hexkey", derive_db_key(region).hex())
    return conn


def derive_asset_key(key_long: int) -> bytes | None:
    if key_long == 0:
        return None
    key_bytes = struct.pack("<q", key_long)
    final_key = bytearray(len(AB_KEY) * 8)
    for i, b in enumerate(AB_KEY):
        base_offset = i * 8
        for j in range(8):
            final_key[base_offset + j] = b ^ key_bytes[j]
    return bytes(final_key)


def decrypt_asset(data: bytearray, asset_key: int) -> bytes:
    key = derive_asset_key(asset_key)
    if key and len(data) > 256:
        key_len = len(key)
        for j in range(256, len(data)):
            data[j] ^= key[j % key_len]
    return bytes(data)


def load_bundle(dat_root: Path, row: dict) -> UnityPy.environment.Environment | None:
    blob_hash = row["h"]
    blob_path = dat_root / blob_hash[:2] / blob_hash
    if not blob_path.exists():
        return None
    data = bytearray(blob_path.read_bytes())
    data = decrypt_asset(data, int(row.get("e") or 0))
    return UnityPy.load(data)


def extract_textures(env: UnityPy.environment.Environment) -> list[tuple[Image.Image, str]]:
    class_objects: dict[str, list] = defaultdict(list)
    for obj in env.objects:
        class_objects[obj.type.name].append(obj)

    results: list[tuple[Image.Image, str]] = []
    for texture_obj in class_objects.get("Texture2D", []):
        try:
            data_obj = texture_obj.read()
            image = data_obj.image
        except Exception:
            continue
        name = data_obj.m_Name or Path(texture_obj.container or "texture").stem
        results.append((image, name))
    return results


def save_webp(image: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA")
    image.save(dest, format="WEBP", lossless=True)


def export_rank_thresholds(master_path: Path) -> None:
    if not master_path.exists():
        print(f"Skipping rank data export; master.mdb not found at {master_path}")
        return
    conn = sqlite3.connect(master_path)
    cur = conn.cursor()
    cur.execute(
        "SELECT id, team_rank, team_rank_group, team_min_value, team_max_value "
        "FROM team_stadium_rank ORDER BY team_min_value",
    )
    rows = [
        {
            "id": r[0],
            "teamRank": r[1],
            "teamRankGroup": r[2],
            "teamMinValue": r[3],
            "teamMaxValue": r[4],
            "icon": f"tex_team_rank_icon_{r[0]:03d}",
            "iconLarge": f"tex_team_rank_icon_m_{r[0]:03d}",
        }
        for r in cur.fetchall()
    ]
    conn.close()
    payload = json.dumps(rows, indent=2)
    RANK_DATA_OUT.parent.mkdir(parents=True, exist_ok=True)
    RANK_DATA_OUT.write_text(payload, encoding="utf-8")
    RANK_DATA_SRC.parent.mkdir(parents=True, exist_ok=True)
    RANK_DATA_SRC.write_text(payload, encoding="utf-8")
    print(f"Wrote rank thresholds: {RANK_DATA_OUT.relative_to(ROOT)}")
    print(f"Wrote rank thresholds: {RANK_DATA_SRC.relative_to(ROOT)}")


def clear_output_dir() -> None:
    if not OUT_DIR.exists():
        return
    for path in OUT_DIR.glob("*.webp"):
        path.unlink()


def main() -> int:
    meta_path, dat_root, master_path = get_paths()
    clear_output_dir()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    export_rank_thresholds(master_path)

    conn = meta_conn(meta_path)
    rows = list(conn.execute(ASSET_QUERY))
    conn.close()

    print(f"Found {len(rows)} team rank icon bundles")
    if not rows:
        return 1

    extracted = 0
    missing = 0
    failed = 0

    for row in rows:
        asset_name = row["n"]
        env = load_bundle(dat_root, row)
        if env is None:
            missing += 1
            print(f"MISSING {asset_name}")
            continue
        try:
            textures = extract_textures(env)
        except Exception as exc:
            print(f"FAIL parse {asset_name}: {exc}")
            failed += 1
            continue

        if not textures:
            failed += 1
            print(f"FAIL empty {asset_name}")
            continue

        for image, texture_name in textures:
            dest = OUT_DIR / f"{texture_name}.webp"
            save_webp(image, dest)
            extracted += 1
            print(f"  {asset_name} -> {dest.relative_to(ROOT)}")

    print(f"Done: {extracted} icons, {missing} missing bundles, {failed} failed")
    print(f"Output: {OUT_DIR}")
    return 0 if extracted else 1


if __name__ == "__main__":
    sys.exit(main())
