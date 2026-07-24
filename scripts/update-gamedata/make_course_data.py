#!/usr/bin/env python3
"""Build course metadata and geometry from master.mdb plus bundled sources."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
COURSE_EVENT_PARAMS_DIR = SCRIPT_DIR / "courseeventparams"
COURSE_GEOMETRY_FALLBACKS_PATH = SCRIPT_DIR / "course_geometry_fallbacks.json"
SKIP_COURSE_IDS = {11201, 11202}


def distance_type(distance: int) -> int:
    if distance <= 1400:
        return 1
    if distance <= 1800:
        return 2
    if distance < 2500:
        return 3
    return 4


def parse_course_events(events: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    corners: list[dict] = []
    straights: list[dict] = []
    slopes: list[dict] = []
    pending_straight: dict | None = None
    straight_state = 0

    for event in events:
        param_type = event.get("_paramType")
        if param_type == 0:
            corners.append(
                {
                    "start": event["_distance"],
                    "length": event["_values"][1],
                }
            )
        elif param_type == 2:
            values = event["_values"]
            if straight_state == 0:
                if values[0] != 1:
                    raise ValueError("straight ended before it started")
                pending_straight = {
                    "start": event["_distance"],
                    "frontType": values[1],
                }
                straight_state = 1
            else:
                if values[0] != 2:
                    raise ValueError("new straight started before previous straight ended")
                pending_straight["end"] = event["_distance"]
                straights.append(pending_straight)
                pending_straight = None
                straight_state = 0
        elif param_type == 11:
            slopes.append(
                {
                    "start": event["_distance"],
                    "length": event["_values"][1],
                    "slope": event["_values"][0],
                }
            )

    corners.sort(key=lambda item: item["start"])
    straights.sort(key=lambda item: item["start"])
    slopes.sort(key=lambda item: item["start"])
    return corners, straights, slopes


def load_geometry_fallbacks() -> dict[str, dict]:
    if not COURSE_GEOMETRY_FALLBACKS_PATH.exists():
        return {}
    with open(COURSE_GEOMETRY_FALLBACKS_PATH, encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload.get("courses", {})


def build_course_data(db_path: str, existing: dict | None = None) -> tuple[dict, list[str]]:
    existing = existing or {}
    warnings: list[str] = []
    course_set_status: dict[int, list[int]] = {}
    geometry_fallbacks = load_geometry_fallbacks()

    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()

    cursor.execute(
        "SELECT course_set_status_id, target_status_1, target_status_2 FROM race_course_set_status"
    )
    for row in cursor.fetchall():
        statuses = [row["target_status_1"]]
        if row["target_status_2"] != 0:
            statuses.append(row["target_status_2"])
        course_set_status[row["course_set_status_id"]] = statuses

    cursor.execute(
        """
        SELECT id, race_track_id, distance, ground, inout, turn, float_lane_max,
               course_set_status_id, finish_time_min, finish_time_max
        FROM race_course_set
        ORDER BY id
        """
    )

    courses: dict[str, dict] = {}
    for row in cursor.fetchall():
        course_id = row["id"]
        if course_id in SKIP_COURSE_IDS:
            continue

        course_key = str(course_id)
        course = {
            "raceTrackId": row["race_track_id"],
            "distance": row["distance"],
            "distanceType": distance_type(row["distance"]),
            "surface": row["ground"],
            "turn": row["turn"],
            "course": row["inout"],
            "laneMax": row["float_lane_max"],
            "finishTimeMin": row["finish_time_min"],
            "finishTimeMax": row["finish_time_max"],
            "courseSetStatus": course_set_status.get(row["course_set_status_id"], []),
        }
        params_path = COURSE_EVENT_PARAMS_DIR / f"{course_id}.json"
        if not params_path.exists():
            if course_key in geometry_fallbacks:
                fallback = geometry_fallbacks[course_key]
                course["corners"] = fallback.get("corners", [])
                course["straights"] = fallback.get("straights", [])
                course["slopes"] = fallback.get("slopes", [])
                warnings.append(f"used bundled fallback geometry for course {course_id}")
            elif course_key in existing:
                previous = existing[course_key]
                course["corners"] = previous.get("corners", [])
                course["straights"] = previous.get("straights", [])
                course["slopes"] = previous.get("slopes", [])
                warnings.append(f"kept existing geometry for course {course_id} (no courseeventparams)")
            else:
                course["corners"] = []
                course["straights"] = []
                course["slopes"] = []
                warnings.append(f"added metadata-only course {course_id} (no courseeventparams)")
            courses[course_key] = course
            continue

        with open(params_path, encoding="utf-8") as handle:
            events = json.load(handle)["courseParams"]
        corners, straights, slopes = parse_course_events(events)
        course["corners"] = corners
        course["straights"] = straights
        course["slopes"] = slopes
        courses[course_key] = course

    connection.close()
    return courses, warnings
