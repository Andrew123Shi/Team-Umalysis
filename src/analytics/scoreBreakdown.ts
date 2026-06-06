import type { ScoreBreakdownSummary, ScoreEvent, UmaEntry } from './types';
import { isGoldSkill } from './skillUtils';

/** Finish position base scores (1st–12th). */
const FINISH_POSITION_IDS = new Set([
    60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
]);

/** Win margin bonus for the race winner (1st–2nd gap). */
const WIN_MARGIN_IDS = new Set([
    5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 21, 41, 51, 74, 75, 76, 77, 78, 80,
]);

/** Margin to 2nd place in lengths (バ身), from team stadium score raw IDs. */
const WIN_MARGIN_LENGTH_BY_ID: Record<number, number> = {
    5: 7,
    6: 6,
    7: 5,
    8: 4,
    9: 3.5,
    10: 3,
    11: 2.5,
    12: 2,
    13: 1.75,
    14: 1.5,
    15: 1.25,
    16: 1,
    17: 0.75,
    21: 0.25,
    41: 9,
    51: 9,
    74: 3,
    75: 2.5,
    76: 2,
    77: 1.75,
    78: 1.5,
    80: 1,
};

const GOOD_MID_POSITION_IDS = new Set([58]);
const GOOD_LATE_POSITION_IDS = new Set([59]);
const STRONG_START_IDS = new Set([25]);

const GOLD_SKILL_ID = 56;
const REGULAR_SKILL_ID = 57;

/** Beat standard course time (100 pt per 0.1 s, up to 2,000). */
const BEAT_TARGET_TIME_IDS = new Set([
    42, 52, 79, 81, 83, 84, 85, 86, 87, 88, 89, 90, 91,
]);

const RUSHED_FLAT_ID = 23;
const RUSHED_PER_SECOND_ID = 24;

export function countLearnedSkills(entry: UmaEntry): { gold: number; regular: number } {
    let gold = 0;
    let regular = 0;
    const seen = new Set<number>();
    entry.skills.forEach(({ skillId }) => {
        if (seen.has(skillId)) return;
        seen.add(skillId);
        if (isGoldSkill(skillId)) gold += 1;
        else regular += 1;
    });
    return { gold, regular };
}

export function countSkillActivations(entry: UmaEntry): { gold: number; regular: number } {
    let gold = 0;
    let regular = 0;
    entry.activatedSkillIds.forEach((skillId) => {
        if (isGoldSkill(skillId)) gold += 1;
        else regular += 1;
    });
    return { gold, regular };
}

export function scoreEventBaseScore(event: ScoreEvent): number {
    if (Number.isFinite(event.baseScore)) return event.baseScore;
    return event.score;
}

function winMarginLengthFromId(rawScoreId: number): number | null {
    return WIN_MARGIN_LENGTH_BY_ID[rawScoreId] ?? null;
}

export type RaceScoreBreakdown = {
    finishPositionScore: number;
    winMarginBonus: number;
    winMarginLength: number | null;
    hasGoodMidPosition: boolean;
    goodMidPositionScore: number;
    hasGoodLatePosition: boolean;
    goodLatePositionScore: number;
    hasStrongStart: boolean;
    strongStartScore: number;
    goldSkillPoints: number;
    regularSkillPoints: number;
    beatTargetTimeBonus: number;
    hasBeatTargetTime: boolean;
    rushedFlatPenalty: number;
    rushedDurationPenalty: number;
    rushedDurationSeconds: number | null;
    hasRushed: boolean;
};

export function breakdownRaceScoreEvents(events: ScoreEvent[]): RaceScoreBreakdown {
    const result: RaceScoreBreakdown = {
        finishPositionScore: 0,
        winMarginBonus: 0,
        winMarginLength: null,
        hasGoodMidPosition: false,
        goodMidPositionScore: 0,
        hasGoodLatePosition: false,
        goodLatePositionScore: 0,
        hasStrongStart: false,
        strongStartScore: 0,
        goldSkillPoints: 0,
        regularSkillPoints: 0,
        beatTargetTimeBonus: 0,
        hasBeatTargetTime: false,
        rushedFlatPenalty: 0,
        rushedDurationPenalty: 0,
        rushedDurationSeconds: null,
        hasRushed: false,
    };

    events.forEach((event) => {
        const base = scoreEventBaseScore(event);
        const id = event.rawScoreId;

        if (FINISH_POSITION_IDS.has(id)) {
            result.finishPositionScore += base;
            return;
        }
        if (WIN_MARGIN_IDS.has(id)) {
            result.winMarginBonus += base;
            const length = winMarginLengthFromId(id);
            if (length !== null) result.winMarginLength = length;
            return;
        }
        if (GOOD_MID_POSITION_IDS.has(id)) {
            result.hasGoodMidPosition = true;
            result.goodMidPositionScore += base;
            return;
        }
        if (GOOD_LATE_POSITION_IDS.has(id)) {
            result.hasGoodLatePosition = true;
            result.goodLatePositionScore += base;
            return;
        }
        if (STRONG_START_IDS.has(id)) {
            result.hasStrongStart = true;
            result.strongStartScore += base;
            return;
        }
        if (id === GOLD_SKILL_ID) {
            result.goldSkillPoints += base;
            return;
        }
        if (id === REGULAR_SKILL_ID) {
            result.regularSkillPoints += base;
            return;
        }
        if (BEAT_TARGET_TIME_IDS.has(id)) {
            result.beatTargetTimeBonus += base;
            result.hasBeatTargetTime = true;
            return;
        }
        if (id === RUSHED_FLAT_ID) {
            result.rushedFlatPenalty += base;
            result.hasRushed = true;
            return;
        }
        if (id === RUSHED_PER_SECOND_ID) {
            result.rushedDurationPenalty += base;
            if (event.num > 0) {
                result.rushedDurationSeconds = event.num;
            }
            result.hasRushed = true;
        }
    });

    return result;
}

export function aggregateScoreBreakdown(entries: UmaEntry[]): ScoreBreakdownSummary | null {
    if (entries.length === 0) return null;

    let finishOrderTotal = 0;
    let finishPositionTotal = 0;
    const winMarginBonuses: number[] = [];
    const winMarginLengths: number[] = [];
    let goodMidCount = 0;
    let goodMidTotal = 0;
    let goodLateCount = 0;
    let goodLateTotal = 0;
    let strongStartCount = 0;
    let strongStartTotal = 0;
    let goldSkillTotal = 0;
    let regularSkillTotal = 0;
    let totalGoldSkillActivations = 0;
    let totalRegularSkillActivations = 0;
    let totalGoldSkillChances = 0;
    let totalRegularSkillChances = 0;
    let beatTargetCount = 0;
    let rushedCount = 0;
    let beatTargetTotal = 0;
    let rushedTotal = 0;
    const rushedDurations: number[] = [];
    const rushedDurationPenalties: number[] = [];

    entries.forEach((entry) => {
        const race = breakdownRaceScoreEvents(entry.scoreEvents);
        finishOrderTotal += entry.finishOrder;
        finishPositionTotal += race.finishPositionScore;
        if (entry.finishOrder === 1 && race.winMarginBonus > 0) {
            winMarginBonuses.push(race.winMarginBonus);
            if (race.winMarginLength !== null) winMarginLengths.push(race.winMarginLength);
        }
        if (race.hasGoodMidPosition) goodMidCount += 1;
        goodMidTotal += race.goodMidPositionScore;
        if (race.hasGoodLatePosition) goodLateCount += 1;
        goodLateTotal += race.goodLatePositionScore;
        if (race.hasStrongStart) strongStartCount += 1;
        strongStartTotal += race.strongStartScore;
        goldSkillTotal += race.goldSkillPoints;
        regularSkillTotal += race.regularSkillPoints;
        const activations = countSkillActivations(entry);
        const learned = countLearnedSkills(entry);
        totalGoldSkillActivations += activations.gold;
        totalRegularSkillActivations += activations.regular;
        totalGoldSkillChances += learned.gold;
        totalRegularSkillChances += learned.regular;
        if (race.hasBeatTargetTime) beatTargetCount += 1;
        beatTargetTotal += race.beatTargetTimeBonus;
        if (race.hasRushed) {
            rushedCount += 1;
            rushedTotal += race.rushedFlatPenalty + race.rushedDurationPenalty;
            if (race.rushedDurationSeconds !== null) {
                rushedDurations.push(race.rushedDurationSeconds);
                rushedDurationPenalties.push(race.rushedDurationPenalty);
            }
        }
    });

    const raceCount = entries.length;
    const winMarginWinCount = winMarginBonuses.length;
    const winMarginTotal = winMarginBonuses.reduce((sum, value) => sum + value, 0);
    const winMarginLengthTotal = winMarginLengths.reduce((sum, value) => sum + value, 0);
    const rushedDurationCount = rushedDurations.length;
    const rushedDurationTotal = rushedDurations.reduce((sum, value) => sum + value, 0);
    const rushedDurationPenaltyTotal = rushedDurationPenalties.reduce((sum, value) => sum + value, 0);
    return {
        raceCount,
        avgFinishOrder: finishOrderTotal / raceCount,
        avgFinishPositionScore: finishPositionTotal / raceCount,
        avgWinMarginLengths: winMarginLengths.length > 0 ? winMarginLengthTotal / winMarginLengths.length : 0,
        avgWinMarginBonus: winMarginWinCount > 0 ? winMarginTotal / winMarginWinCount : 0,
        winMarginWinCount,
        goodMidPositionRate: goodMidCount / raceCount,
        avgGoodMidPositionBonus: goodMidTotal / raceCount,
        goodLatePositionRate: goodLateCount / raceCount,
        avgGoodLatePositionBonus: goodLateTotal / raceCount,
        strongStartRate: strongStartCount / raceCount,
        avgStrongStartBonus: strongStartTotal / raceCount,
        avgRegularSkillActivations: totalRegularSkillActivations / raceCount,
        regularSkillActivationRate: totalRegularSkillChances > 0
            ? totalRegularSkillActivations / totalRegularSkillChances
            : 0,
        avgRegularSkillPoints: regularSkillTotal / raceCount,
        avgGoldSkillActivations: totalGoldSkillActivations / raceCount,
        goldSkillActivationRate: totalGoldSkillChances > 0
            ? totalGoldSkillActivations / totalGoldSkillChances
            : 0,
        avgGoldSkillPoints: goldSkillTotal / raceCount,
        beatTargetTimeRate: beatTargetCount / raceCount,
        avgBeatTargetTimeBonus: beatTargetTotal / raceCount,
        rushedOccurrenceRate: rushedCount / raceCount,
        avgRushedPenalty: rushedTotal / raceCount,
        avgRushedDurationSeconds: rushedDurationCount > 0 ? rushedDurationTotal / rushedDurationCount : 0,
        avgRushedDurationPenalty: rushedDurationCount > 0 ? rushedDurationPenaltyTotal / rushedDurationCount : 0,
        rushedDurationCount,
    };
}
