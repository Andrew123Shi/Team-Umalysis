#!/usr/bin/env python3
"""Refresh dynamic gamedata sections from master.mdb, preserving static track assets."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path

from make_course_data import build_course_data

ROOT = Path(__file__).resolve().parents[2]
ASSETS_DIR = ROOT / ".gamedata-assets"
SKILLS_PATH = ASSETS_DIR / "skills.json"
TRACKNAMES_PATH = ASSETS_DIR / "tracks" / "tracknames.json"
COURSE_DATA_PATH = ASSETS_DIR / "tracks" / "course_data.json"


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


def open_cursor(db_path: str) -> sqlite3.Cursor:
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection.cursor()


def load_json(path: Path, default):
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def update_skills(cursor: sqlite3.Cursor) -> int:
    existing_list = [
        entry
        for entry in load_json(SKILLS_PATH, [])
        if isinstance(entry, dict) and "id" in entry
    ]
    existing = {entry["id"]: entry for entry in existing_list}

    cursor.execute(
        """
        SELECT "index" AS id, text AS enname
        FROM text_data
        WHERE category = 47
        ORDER BY "index"
        """
    )

    for row in cursor.fetchall():
        skill_id = row["id"]
        prior = existing.get(skill_id)
        if prior is None:
            existing[skill_id] = {
                "id": skill_id,
                "enname": row["enname"],
                "jpname": row["enname"],
            }
        else:
            prior["enname"] = row["enname"]

    skills = [existing[skill_id] for skill_id in sorted(existing)]
    write_json(SKILLS_PATH, skills)
    return len(skills)


def update_tracknames(cursor: sqlite3.Cursor) -> int:
    existing = load_json(TRACKNAMES_PATH, {})
    cursor.execute(
        """
        SELECT rt.id, short.text AS short_name
        FROM race_track AS rt
        LEFT JOIN text_data AS short ON short."index" = rt.id AND short.category = 35
        ORDER BY rt.id
        """
    )
    tracknames = dict(existing)
    for row in cursor.fetchall():
        track_id = str(row["id"])
        prior = existing.get(track_id, ["", ""])
        japanese = prior[0] if isinstance(prior, list) and len(prior) > 0 else ""
        english = row["short_name"] or (prior[1] if isinstance(prior, list) and len(prior) > 1 else "")
        tracknames[track_id] = [japanese, english]
    write_json(TRACKNAMES_PATH, tracknames)
    return len(tracknames)


def update_course_data(db_path: str) -> bool:
    existing = load_json(COURSE_DATA_PATH, {})
    course_data, warnings = build_course_data(db_path, existing)
    write_json(COURSE_DATA_PATH, course_data)
    print(f"Updated tracks/course_data ({len(course_data)} courses)")
    for warning in warnings:
        print(f"  warning: {warning}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db_path", default=default_master_path())
    args = parser.parse_args()

    db_path = os.path.normpath(args.db_path)
    if not os.path.exists(db_path):
        print(f"ERROR: master.mdb not found: {db_path}", file=sys.stderr)
        return 1

    if not ASSETS_DIR.exists():
        print("Extracting existing gamedata assets...")
        subprocess.run(["node", str(ROOT / "scripts" / "update-gamedata" / "extract_gamedata_assets.mjs")], check=True)

    extract_script = Path(__file__).resolve().parent / "extract_courseeventparams.py"
    subprocess.run(
        [sys.executable, str(extract_script), "--db_path", db_path],
        check=False,
    )

    cursor = open_cursor(db_path)
    skill_count = update_skills(cursor)
    track_count = update_tracknames(cursor)
    print(f"Updated skills ({skill_count}) and tracknames ({track_count})")

    update_course_data(db_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
