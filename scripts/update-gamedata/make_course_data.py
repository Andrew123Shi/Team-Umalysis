#!/usr/bin/env python3
"""Build tracks/course_data JSON from master.mdb and bundled courseeventparams."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
COURSE_EVENT_PARAMS_DIR = SCRIPT_DIR / "courseeventparams"
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


def build_course_data(db_path: str, existing: dict | None = None) -> tuple[dict, list[str]]:
    existing = existing or {}
    warnings: list[str] = []
    course_set_status: dict[int, list[int]] = {}

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
        params_path = COURSE_EVENT_PARAMS_DIR / f"{course_id}.json"
        if not params_path.exists():
            if course_key in existing:
                courses[course_key] = existing[course_key]
                warnings.append(f"kept existing geometry for course {course_id} (no courseeventparams)")
            else:
                warnings.append(f"skipped course {course_id} (no courseeventparams)")
            continue

        with open(params_path, encoding="utf-8") as handle:
            events = json.load(handle)["courseParams"]
        corners, straights, slopes = parse_course_events(events)
        css_id = row["course_set_status_id"]

        courses[course_key] = {
            "raceTrackId": row["race_track_id"],
            "distance": row["distance"],
            "distanceType": distance_type(row["distance"]),
            "surface": row["ground"],
            "turn": row["turn"],
            "course": row["inout"],
            "laneMax": row["float_lane_max"],
            "finishTimeMin": row["finish_time_min"],
            "finishTimeMax": row["finish_time_max"],
            "courseSetStatus": course_set_status.get(css_id, []),
            "corners": corners,
            "straights": straights,
            "slopes": slopes,
        }

    connection.close()
    return courses, warnings
