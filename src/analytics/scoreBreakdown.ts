import type { ScoreBreakdownSummary, ScoreEvent, UmaEntry } from './types';
import { getSkillRarityCategory } from './skillUtils';

/** Finish position base scores (1st–12th). */
const FINISH_POSITION_MIN = 60;
const FINISH_POSITION_MAX = 71;

/** Win margin bonus for the race winner (1st–2nd gap). */
const WIN_MARGIN_MIN = 1;
const WIN_MARGIN_MAX = 21;

const GOOD_MID_POSITION_ID = 58;
const GOOD_LATE_POSITION_ID = 59;
const STRONG_START_ID = 25;

/** Unique skill activation by level: 40–45 and 50–55 (lv6 down to lv1 in each range). */
const UNIQUE_SKILL_RANGES: ReadonlyArray<[number, number]> = [[40, 45], [50, 55]];

const GOLD_SKILL_ID = 56;
const REGULAR_SKILL_ID = 57;

/** Beat standard course time; IDs 72+ encode various time margins. */
const BEAT_TARGET_TIME_MIN = 72;

const RUSHED_FLAT_ID = 23;
const RUSHED_PER_SECOND_ID = 24;

function isFinishPositionId(id: number): boolean {
    return id >= FINISH_POSITION_MIN && id <= FINISH_POSITION_MAX;
}

function isWinMarginId(id: number): boolean {
    return id >= WIN_MARGIN_MIN && id <= WIN_MARGIN_MAX;
}

function isUniqueSkillId(id: number): boolean {
    return UNIQUE_SKILL_RANGES.some(([min, max]) => id >= min && id <= max);
}

function isBeatTargetTimeId(id: number): boolean {
    return id >= BEAT_TARGET_TIME_MIN;
}

export function countLearnedSkills(entry: UmaEntry): { gold: number; regular: number; unique: number } {
    let gold = 0;
    let regular = 0;
    let unique = 0;
    const seen = new Set<number>();
    entry.skills.forEach(({ skillId }) => {
        if (seen.has(skillId)) return;
        seen.add(skillId);
        switch (getSkillRarityCategory(skillId)) {
            case 'gold':
                gold += 1;
                break;
            case 'unique':
                unique += 1;
                break;
            case 'regular':
                regular += 1;
                break;
        }
    });
    return { gold, regular, unique };
}

export function countSkillActivations(entry: UmaEntry): { gold: number; regular: number; unique: number } {
    let gold = 0;
    let regular = 0;
    let unique = 0;
    entry.activatedSkillIds.forEach((skillId) => {
        switch (getSkillRarityCategory(skillId)) {
            case 'gold':
                gold += 1;
                break;
            case 'unique':
                unique += 1;
                break;
            case 'regular':
                regular += 1;
                break;
        }
    });
    return { gold, regular, unique };
}

export function scoreEventBaseScore(event: ScoreEvent): number {
    if (Number.isFinite(event.baseScore)) return event.baseScore;
    return event.score;
}

function uniqueSkillActivationPoints(entry: UmaEntry): number {
    const uniqueLevels = new Map(
        entry.skills
            .filter(({ skillId }) => getSkillRarityCategory(skillId) === 'unique')
            .map(({ skillId, level }) => [skillId, Math.max(0, Math.floor(Number(level) || 0))]),
    );

    return entry.activatedSkillIds.reduce((total, skillId) => {
        const level = uniqueLevels.get(skillId);
        if (level === undefined) return total;
        return total + 2000 + level * 100;
    }, 0);
}

export type RaceScoreBreakdown = {
    finishPositionScore: number;
    winMarginBonus: number;
    hasGoodMidPosition: boolean;
    goodMidPositionScore: number;
    hasGoodLatePosition: boolean;
    goodLatePositionScore: number;
    hasStrongStart: boolean;
    strongStartScore: number;
    goldSkillPoints: number;
    regularSkillPoints: number;
    uniqueSkillPoints: number;
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
        hasGoodMidPosition: false,
        goodMidPositionScore: 0,
        hasGoodLatePosition: false,
        goodLatePositionScore: 0,
        hasStrongStart: false,
        strongStartScore: 0,
        goldSkillPoints: 0,
        regularSkillPoints: 0,
        uniqueSkillPoints: 0,
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

        if (isFinishPositionId(id)) {
            result.finishPositionScore += base;
            return;
        }
        if (isWinMarginId(id)) {
            result.winMarginBonus += base;
            return;
        }
        if (id === GOOD_MID_POSITION_ID) {
            result.hasGoodMidPosition = true;
            result.goodMidPositionScore += base;
            return;
        }
        if (id === GOOD_LATE_POSITION_ID) {
            result.hasGoodLatePosition = true;
            result.goodLatePositionScore += base;
            return;
        }
        if (id === STRONG_START_ID) {
            result.hasStrongStart = true;
            result.strongStartScore += base;
            return;
        }
        if (isUniqueSkillId(id)) {
            result.uniqueSkillPoints += base;
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
        if (isBeatTargetTimeId(id)) {
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
    let uniqueSkillTotal = 0;
    let totalGoldSkillActivations = 0;
    let totalRegularSkillActivations = 0;
    let totalUniqueSkillActivations = 0;
    let totalGoldSkillChances = 0;
    let totalRegularSkillChances = 0;
    let totalUniqueSkillChances = 0;
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
        if (entry.finishOrder === 1) {
            winMarginBonuses.push(race.winMarginBonus);
            if (entry.winMarginLengths !== undefined) {
                winMarginLengths.push(entry.winMarginLengths);
            }
        }
        if (race.hasGoodMidPosition) goodMidCount += 1;
        goodMidTotal += race.goodMidPositionScore;
        if (race.hasGoodLatePosition) goodLateCount += 1;
        goodLateTotal += race.goodLatePositionScore;
        if (race.hasStrongStart) strongStartCount += 1;
        strongStartTotal += race.strongStartScore;
        const activations = countSkillActivations(entry);
        const learned = countLearnedSkills(entry);
        goldSkillTotal += race.goldSkillPoints;
        regularSkillTotal += race.regularSkillPoints;
        uniqueSkillTotal += race.uniqueSkillPoints > 0
            ? race.uniqueSkillPoints
            : uniqueSkillActivationPoints(entry);
        totalGoldSkillActivations += activations.gold;
        totalRegularSkillActivations += activations.regular;
        totalUniqueSkillActivations += activations.unique;
        totalGoldSkillChances += learned.gold;
        totalRegularSkillChances += learned.regular;
        totalUniqueSkillChances += learned.unique;
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
    const winMarginLengthCount = winMarginLengths.length;
    const winMarginTotal = winMarginBonuses.reduce((sum, value) => sum + value, 0);
    const winMarginLengthTotal = winMarginLengths.reduce((sum, value) => sum + value, 0);
    const rushedDurationCount = rushedDurations.length;
    const rushedDurationTotal = rushedDurations.reduce((sum, value) => sum + value, 0);
    const rushedDurationPenaltyTotal = rushedDurationPenalties.reduce((sum, value) => sum + value, 0);
    return {
        raceCount,
        avgFinishOrder: finishOrderTotal / raceCount,
        avgFinishPositionScore: finishPositionTotal / raceCount,
        avgWinMarginLengths: winMarginLengthCount > 0 ? winMarginLengthTotal / winMarginLengthCount : 0,
        avgWinMarginBonus: winMarginWinCount > 0 ? winMarginTotal / winMarginWinCount : 0,
        winMarginWinCount,
        winMarginLengthCount,
        goodMidPositionRate: goodMidCount / raceCount,
        avgGoodMidPositionBonus: goodMidTotal / raceCount,
        goodLatePositionRate: goodLateCount / raceCount,
        avgGoodLatePositionBonus: goodLateTotal / raceCount,
        strongStartRate: strongStartCount / raceCount,
        avgStrongStartBonus: strongStartTotal / raceCount,
        avgUniqueSkillActivations: totalUniqueSkillActivations / raceCount,
        uniqueSkillActivationRate: totalUniqueSkillChances > 0
            ? totalUniqueSkillActivations / totalUniqueSkillChances
            : 0,
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
        avgUniqueSkillPoints: uniqueSkillTotal / raceCount,
        beatTargetTimeRate: beatTargetCount / raceCount,
        avgBeatTargetTimeBonus: beatTargetTotal / raceCount,
        rushedOccurrenceRate: rushedCount / raceCount,
        avgRushedPenalty: rushedTotal / raceCount,
        avgRushedDurationSeconds: rushedDurationCount > 0 ? rushedDurationTotal / rushedDurationCount : 0,
        avgRushedDurationPenalty: rushedDurationCount > 0 ? rushedDurationPenaltyTotal / rushedDurationCount : 0,
        rushedDurationCount,
    };
}
