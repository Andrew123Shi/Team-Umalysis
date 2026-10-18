/** raw_score_id values from Team Trials score_array / team_score_array. */

/** Win margin over 2nd place, widest (1) to narrowest (18) in lengths, then nose / head / neck. */
export const WIN_MARGIN_MIN = 1;
export const WIN_MARGIN_MAX = 21;
export const WIN_MARGIN_NOSE_ID = 19;
export const WIN_MARGIN_HEAD_ID = 20;
export const WIN_MARGIN_NECK_ID = 21;

/** Finished top 3 at popularity 8 or lower. */
export const LONG_SHOT_ID = 22;

export const RUSHED_FLAT_ID = 23;
export const RUSHED_PER_SECOND_ID = 24;
export const STRONG_START_ID = 25;

/** Unique skill activation: 40–45 for rarity-4 uniques, 50–55 for rarity-5; last digit is 6 − unique level. */
export const UNIQUE_SKILL_RANGES: ReadonlyArray<[number, number]> = [[40, 45], [50, 55]];

export const GOLD_SKILL_ID = 56;
export const REGULAR_SKILL_ID = 57;
export const GOOD_MID_POSITION_ID = 58;
export const GOOD_LATE_POSITION_ID = 59;

/** Finish position 1st (60) through 12th (71). */
export const FINISH_POSITION_MIN = 60;
export const FINISH_POSITION_MAX = 71;

/** Beat the course's target time; base is (92 − id) × 100. */
export const BEAT_TARGET_TIME_MIN = 72;
export const BEAT_TARGET_TIME_MAX = 91;

/** Team events in team_score_array. */
export const ALL_MEMBERS_PODIUMED_ID = 94;
export const ALL_MEMBERS_PLACED_ID = 95;

/** Not stored in the save file; synthesized by the parser when 3+ races are won. */
export const VICTORY_BONUS_ID = 0;
export const VICTORY_BONUS_BASE = 10_000;
export const VICTORY_MIN_ROUND_WINS = 3;

export function isFinishPositionId(id: number): boolean {
    return id >= FINISH_POSITION_MIN && id <= FINISH_POSITION_MAX;
}

export function isWinMarginId(id: number): boolean {
    return id >= WIN_MARGIN_MIN && id <= WIN_MARGIN_MAX;
}

export function isUniqueSkillId(id: number): boolean {
    return UNIQUE_SKILL_RANGES.some(([min, max]) => id >= min && id <= max);
}

export function isBeatTargetTimeId(id: number): boolean {
    return id >= BEAT_TARGET_TIME_MIN && id <= BEAT_TARGET_TIME_MAX;
}
