#!/usr/bin/env python3
"""Extract courseeventparams JSON from local game asset bundles.

Course geometry lives in race/courseeventparam/{id}/pfb_prm_race{id} bundles
under the game's meta/dat directories (not in master.mdb).
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
COURSE_EVENT_PARAMS_DIR = SCRIPT_DIR / "courseeventparams"
SKIP_COURSE_IDS = {11201, 11202}

ASSET_QUERY = """
SELECT "n", "h", "e" FROM "a"
WHERE "n" LIKE 'race/courseeventparam/%/pfb_prm_race%'
ORDER BY "n"
"""


def default_master_path() -> str:
    return os.path.normpath(
        os.path.join(
            os.environ.get("LOCALAPPDATA", ""),
            "..",
            "LocalLow",
            "Cygames",
            "Umamusume",
            "master",
            "master.mdb",
        )
    )


def course_id_from_asset_name(asset_name: str) -> int | None:
    # race/courseeventparam/10602/pfb_prm_race10602
    parts = asset_name.split("/")
    if len(parts) < 3:
        return None
    try:
        return int(parts[2])
    except ValueError:
        return None


def needed_course_ids(db_path: str) -> set[int]:
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    cursor = connection.cursor()
    cursor.execute("SELECT id FROM race_course_set")
    ids = {row[0] for row in cursor.fetchall() if row[0] not in SKIP_COURSE_IDS}
    connection.close()
    return ids


def extract_course_params(env) -> dict | None:
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        tree = obj.read_typetree()
        if "courseParams" in tree:
            return tree
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db_path", default=default_master_path())
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-extract all courseeventparams, not just missing ones",
    )
    args = parser.parse_args()

    db_path = os.path.normpath(args.db_path)
    if not os.path.exists(db_path):
        print(f"ERROR: master.mdb not found: {db_path}", file=sys.stderr)
        return 1

    try:
        sys.path.insert(0, str(ROOT / "scripts"))
        from extract_team_rank_icons import get_paths, load_bundle, meta_conn
    except ImportError as exc:
        print(f"ERROR: could not import game asset helpers: {exc}", file=sys.stderr)
        return 1

    try:
        meta_path, dat_root, _ = get_paths()
    except FileNotFoundError as exc:
        print(f"Skipping course geometry extraction: {exc}")
        return 0

    needed = needed_course_ids(db_path)
    COURSE_EVENT_PARAMS_DIR.mkdir(parents=True, exist_ok=True)

    if args.force:
        targets = needed
    else:
        targets = {
            course_id
            for course_id in needed
            if not (COURSE_EVENT_PARAMS_DIR / f"{course_id}.json").exists()
        }

    if not targets:
        print("Courseeventparams are up to date.")
        return 0

    conn = meta_conn(meta_path)
    rows = list(conn.execute(ASSET_QUERY))
    conn.close()

    assets_by_id: dict[int, dict] = {}
    for row in rows:
        course_id = course_id_from_asset_name(row["n"])
        if course_id is not None:
            assets_by_id[course_id] = row

    extracted = 0
    missing_assets = 0
    failed = 0

    for course_id in sorted(targets):
        row = assets_by_id.get(course_id)
        if row is None:
            missing_assets += 1
            print(f"  warning: no game asset for course {course_id}")
            continue

        env = load_bundle(dat_root, row)
        if env is None:
            missing_assets += 1
            print(f"  warning: missing bundle for course {course_id}")
            continue

        try:
            tree = extract_course_params(env)
        except Exception as exc:
            failed += 1
            print(f"  warning: failed to parse course {course_id}: {exc}")
            continue

        if tree is None:
            failed += 1
            print(f"  warning: no courseParams in bundle for course {course_id}")
            continue

        dest = COURSE_EVENT_PARAMS_DIR / f"{course_id}.json"
        with open(dest, "w", encoding="utf-8") as handle:
            json.dump(tree, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        extracted += 1
        print(f"  extracted course {course_id}")

    print(
        f"Courseeventparams: {extracted} extracted, "
        f"{missing_assets} missing assets, {failed} failed"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
