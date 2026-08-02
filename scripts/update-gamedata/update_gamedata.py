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


def print_change_lines(label: str, lines: list[str], limit: int = 40) -> None:
    if not lines:
        print(f"  {label}: none")
        return
    print(f"  {label}: {len(lines)}")
    for line in lines[:limit]:
        print(f"    - {line}")
    remaining = len(lines) - limit
    if remaining > 0:
        print(f"    ... and {remaining} more")


def update_skills(cursor: sqlite3.Cursor) -> tuple[int, list[str], list[str]]:
    existing_list = [
        entry
        for entry in load_json(SKILLS_PATH, [])
        if isinstance(entry, dict) and "id" in entry
    ]
    existing = {entry["id"]: entry for entry in existing_list}
    added: list[str] = []
    changed: list[str] = []

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
        enname = row["enname"]
        prior = existing.get(skill_id)
        if prior is None:
            existing[skill_id] = {
                "id": skill_id,
                "enname": enname,
                "jpname": enname,
            }
            added.append(f"{skill_id}: {enname}")
        else:
            old_name = prior.get("enname", "")
            if old_name != enname:
                changed.append(f"{skill_id}: {old_name!r} -> {enname!r}")
            prior["enname"] = enname

    skills = [existing[skill_id] for skill_id in sorted(existing)]
    write_json(SKILLS_PATH, skills)
    return len(skills), added, changed


def update_tracknames(cursor: sqlite3.Cursor) -> tuple[int, list[str], list[str]]:
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
    added: list[str] = []
    changed: list[str] = []
    for row in cursor.fetchall():
        track_id = str(row["id"])
        prior = existing.get(track_id)
        japanese = prior[0] if isinstance(prior, list) and len(prior) > 0 else ""
        english = row["short_name"] or (
            prior[1] if isinstance(prior, list) and len(prior) > 1 else ""
        )
        next_value = [japanese, english]
        if prior is None:
            added.append(f"{track_id}: {english or japanese or '(unnamed)'}")
        elif prior != next_value:
            old_english = prior[1] if isinstance(prior, list) and len(prior) > 1 else ""
            changed.append(f"{track_id}: {old_english!r} -> {english!r}")
        tracknames[track_id] = next_value
    write_json(TRACKNAMES_PATH, tracknames)
    return len(tracknames), added, changed


def update_course_data(db_path: str) -> tuple[int, list[str], list[str], list[str]]:
    existing = load_json(COURSE_DATA_PATH, {})
    course_data, warnings = build_course_data(db_path, existing)
    added: list[str] = []
    changed: list[str] = []
    for course_id, course in course_data.items():
        prior = existing.get(course_id)
        if prior is None:
            added.append(str(course_id))
        elif prior != course:
            changed.append(str(course_id))
    write_json(COURSE_DATA_PATH, course_data)
    return len(course_data), added, changed, warnings


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
    skill_count, skills_added, skills_changed = update_skills(cursor)
    track_count, tracks_added, tracks_changed = update_tracknames(cursor)
    course_count, courses_added, courses_changed, warnings = update_course_data(db_path)

    print()
    print("=== Gamedata update summary ===")
    print(f"skills.json: {skill_count} total")
    print_change_lines("added", skills_added)
    print_change_lines("changed", skills_changed)
    print(f"tracknames.json: {track_count} total")
    print_change_lines("added", tracks_added)
    print_change_lines("changed", tracks_changed)
    print(f"course_data.json: {course_count} total")
    print_change_lines("added", courses_added)
    print_change_lines("changed", courses_changed)
    if warnings:
        print(f"  warnings: {len(warnings)}")
        for warning in warnings:
            print(f"    - {warning}")
    else:
        print("  warnings: none")

    any_changes = any(
        (skills_added, skills_changed, tracks_added, tracks_changed, courses_added, courses_changed)
    )
    if not any_changes:
        print("No gamedata asset content changes detected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
