#!/usr/bin/env python3
"""Generate public/data/umdb.json from the local Uma Musume master.mdb."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_JSON = ROOT / "public" / "data" / "umdb.json"

SCENARIO_SKILL_IDS = {
    300011, 300021, 300031, 300041, 300051, 300061, 300071, 300081, 300091, 300101,
    300111, 300121, 300131, 300141, 300151,
}

LB_COLUMNS = ["limit_lv5", "limit_lv15", "limit_lv20", "limit_lv35", "limit_lv40"]


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


def ground_type_name(ground: int | None) -> str:
    if ground == 1:
        return "TURF"
    if ground == 2:
        return "DIRT"
    return "UNKNOWN_GROUND_TYPE"


def build_condition_groups(row: sqlite3.Row) -> list[dict]:
    groups: list[dict] = []
    for idx in (1, 2):
        condition = (row[f"condition_{idx}"] or "").strip()
        if not condition or condition == "0":
            continue
        precondition = (row[f"precondition_{idx}"] or "").strip()
        if precondition and precondition != "0":
            condition = f"{precondition}&{condition}"
        effects = []
        for effect_idx in (1, 2, 3):
            effect_type = row[f"ability_type_{idx}_{effect_idx}"]
            effect_value = row[f"float_ability_value_{idx}_{effect_idx}"]
            if effect_type and effect_type != 0:
                effects.append({"type": int(effect_type), "value": int(effect_value)})
        groups.append(
            {
                "condition": condition,
                "baseTime": int(row[f"float_ability_time_{idx}"] or 0),
                "effects": effects,
            }
        )
    return groups


def support_card_race_bonus(cursor: sqlite3.Cursor, card_id: int) -> tuple[int, list[int]]:
    cursor.execute(
        f"""
        SELECT {", ".join(["init", *LB_COLUMNS])}
        FROM support_card_effect_table
        WHERE id = ? AND type = 15
        """,
        (card_id,),
    )
    row = cursor.fetchone()
    if row is None:
        return 0, [0, 0, 0, 0, 0]

    values: list[int] = []
    last = 0
    init = row["init"]
    if init is not None and init >= 0:
        last = int(init)
    for column in LB_COLUMNS:
        value = row[column]
        if value is not None and value >= 0:
            last = int(value)
        values.append(last)

    while len(values) < 5:
        values.append(last)

    race_bonus = max(values) if values else 0
    if init is not None and init >= 0 and race_bonus > init:
        values = [race_bonus] * 5

    return race_bonus, values[:5]


def populate_charas(cursor: sqlite3.Cursor) -> list[dict]:
    cursor.execute(
        """
        SELECT t1."index" AS id, t1.text AS name, t2.text AS cast_name
        FROM text_data AS t1
        LEFT JOIN text_data AS t2 ON t1."index" = t2."index" AND t2.category = 7
        WHERE t1.category = 170
        ORDER BY t1."index"
        """
    )
    return [
        {"id": row["id"], "name": row["name"], "castName": row["cast_name"] or ""}
        for row in cursor.fetchall()
    ]


def populate_cards(cursor: sqlite3.Cursor) -> list[dict]:
    cursor.execute(
        'SELECT "index" AS id, text AS name FROM text_data WHERE category = 5 ORDER BY "index"'
    )
    return [{"id": row["id"], "name": row["name"]} for row in cursor.fetchall()]


def populate_support_cards(cursor: sqlite3.Cursor) -> list[dict]:
    cursor.execute(
        """
        SELECT s.id, t.text AS name, s.chara_id
        FROM support_card_data AS s
        JOIN text_data AS t ON t."index" = s.id AND t.category = 75
        ORDER BY s.id
        """
    )
    cards = []
    for row in cursor.fetchall():
        race_bonus, race_bonus_by_lb = support_card_race_bonus(cursor, row["id"])
        cards.append(
            {
                "id": row["id"],
                "name": row["name"],
                "charaId": row["chara_id"],
                "raceBonus": race_bonus,
                "raceBonusByLimitBreak": race_bonus_by_lb,
            }
        )
    return cards


def populate_race_instances(cursor: sqlite3.Cursor) -> list[dict]:
    cursor.execute(
        """
        SELECT ri.id, rcs.distance, rcs.ground, r.course_set AS course_set_id, t.text AS name
        FROM race_instance AS ri
        LEFT JOIN race AS r ON ri.race_id = r.id
        LEFT JOIN race_course_set AS rcs ON r.course_set = rcs.id
        LEFT JOIN text_data AS t ON t."index" = ri.id AND t.category = 29
        ORDER BY ri.id
        """
    )
    races = []
    for row in cursor.fetchall():
        entry = {
            "id": row["id"],
            "name": row["name"] or "Unknown",
            "distance": row["distance"] or 0,
            "groundType": ground_type_name(row["ground"]),
        }
        if row["course_set_id"]:
            entry["courseSetId"] = row["course_set_id"]
        races.append(entry)
    return races


def populate_skills(cursor: sqlite3.Cursor) -> list[dict]:
    cursor.execute(
        """
        SELECT s.*, t.text AS name
        FROM skill_data AS s
        JOIN text_data AS t ON t."index" = s.id AND t.category = 47
        WHERE s.is_general_skill = 1 OR s.rarity >= 3 OR s.id IN ({})
        ORDER BY s.id
        """.format(",".join(str(skill_id) for skill_id in sorted(SCENARIO_SKILL_IDS)))
    )
    skills = []
    for row in cursor.fetchall():
        tag_id = [part for part in (row["tag_id"] or "").split("/") if part]
        skills.append(
            {
                "id": row["id"],
                "name": row["name"],
                "gradeValue": row["grade_value"] or 0,
                "tagId": tag_id,
                "rarity": row["rarity"] or 0,
                "conditionGroups": build_condition_groups(row),
                "iconId": row["icon_id"] or 0,
            }
        )
    return skills


def populate_text_data(cursor: sqlite3.Cursor) -> list[dict]:
    cursor.execute(
        'SELECT id, category, "index", text FROM text_data WHERE category IN (4, 111, 147) ORDER BY id'
    )
    return [
        {
            "id": row["id"],
            "category": row["category"],
            "index": row["index"],
            "text": row["text"],
        }
        for row in cursor.fetchall()
    ]


def populate_single_mode_skill_need_point(cursor: sqlite3.Cursor) -> list[dict]:
    cursor.execute(
        """
        SELECT id, need_skill_point, status_type, status_value, solvable_type
        FROM single_mode_skill_need_point
        ORDER BY id
        """
    )
    return [
        {
            "id": row["id"],
            "needSkillPoint": row["need_skill_point"] or 0,
            "statusType": row["status_type"] or 0,
            "statusValue": row["status_value"] or 0,
            "solvableType": row["solvable_type"] or 0,
        }
        for row in cursor.fetchall()
    ]


def populate_single_mode_rank(cursor: sqlite3.Cursor) -> list[dict]:
    cursor.execute("SELECT id, min_value, max_value FROM single_mode_rank ORDER BY id")
    return [
        {"id": row["id"], "minValue": row["min_value"], "maxValue": row["max_value"]}
        for row in cursor.fetchall()
    ]


def populate_succession_relation(cursor: sqlite3.Cursor) -> list[dict]:
    cursor.execute(
        "SELECT relation_type, relation_point FROM succession_relation ORDER BY relation_type"
    )
    return [
        {"relationType": row["relation_type"], "relationPoint": row["relation_point"]}
        for row in cursor.fetchall()
    ]


def populate_succession_relation_member(cursor: sqlite3.Cursor) -> list[dict]:
    cursor.execute(
        """
        SELECT id, relation_type, chara_id
        FROM succession_relation_member
        ORDER BY id
        """
    )
    return [
        {
            "id": row["id"],
            "relationType": row["relation_type"],
            "charaId": row["chara_id"],
        }
        for row in cursor.fetchall()
    ]


def populate_single_mode_wins_saddle(cursor: sqlite3.Cursor) -> list[dict]:
    columns = ", ".join(f"race_instance_id_{idx}" for idx in range(1, 9))
    cursor.execute(
        f"""
        SELECT id, {columns}
        FROM single_mode_wins_saddle
        ORDER BY id
        """
    )
    saddles = []
    for row in cursor.fetchall():
        race_ids = [int(row[f"race_instance_id_{idx}"]) for idx in range(1, 9) if row[f"race_instance_id_{idx}"]]
        entry = {"id": row["id"], "raceInstanceIds": race_ids}
        if len(race_ids) == 1:
            entry["raceInstanceId"] = race_ids[0]
        saddles.append(entry)
    return saddles


def generate_umdb(db_path: str, version: str) -> dict:
    cursor = open_cursor(db_path)
    return {
        "version": version,
        "chara": populate_charas(cursor),
        "raceInstance": populate_race_instances(cursor),
        "skill": populate_skills(cursor),
        "card": populate_cards(cursor),
        "supportCard": populate_support_cards(cursor),
        "textData": populate_text_data(cursor),
        "singleModeSkillNeedPoint": populate_single_mode_skill_need_point(cursor),
        "singleModeRank": populate_single_mode_rank(cursor),
        "successionRelation": populate_succession_relation(cursor),
        "successionRelationMember": populate_succession_relation_member(cursor),
        "singleModeWinsSaddle": populate_single_mode_wins_saddle(cursor),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db_path", default=default_master_path())
    parser.add_argument("--version", default=date.today().isoformat())
    args = parser.parse_args()

    db_path = os.path.normpath(args.db_path)
    if not os.path.exists(db_path):
        print(f"ERROR: master.mdb not found: {db_path}", file=sys.stderr)
        return 1

    print(f"Reading {db_path}")
    umdb = generate_umdb(db_path, args.version)
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as handle:
        json.dump(umdb, handle, ensure_ascii=False, indent=2)

    counts = {key: len(value) if isinstance(value, list) else value for key, value in umdb.items()}
    print(f"Wrote {OUTPUT_JSON}")
    print(json.dumps(counts, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
