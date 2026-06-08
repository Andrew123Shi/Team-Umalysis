import { aggregateScoreBreakdown, countLearnedSkills, countSkillActivations } from './scoreBreakdown';
import type { ScoreBreakdownSummary, TTSession, UmaComparisonEntry, UmaEntry } from './types';
import { buildUmaFingerprint } from './umaIdentity';
import { DISTANCE_ORDER } from './types';

function bonusMultiplier(supportCardBonus: number): number {
    const pct = supportCardBonus / 100;
    return pct > 0 ? 1 + pct / 100 : 1;
}

function primaryDistanceType(counts: Map<number, number>): number {
    let bestType: number = DISTANCE_ORDER[0];
    let bestCount = -1;
    counts.forEach((count, distanceType) => {
        if (count > bestCount || (count === bestCount && distanceType < bestType)) {
            bestCount = count;
            bestType = distanceType;
        }
    });
    return bestType;
}

function emptyBreakdown(): ScoreBreakdownSummary {
    return {
        raceCount: 0,
        avgFinishOrder: 0,
        avgFinishPositionScore: 0,
        avgWinMarginLengths: 0,
        avgWinMarginBonus: 0,
        winMarginWinCount: 0,
        goodMidPositionRate: 0,
        avgGoodMidPositionBonus: 0,
        goodLatePositionRate: 0,
        avgGoodLatePositionBonus: 0,
        strongStartRate: 0,
        avgStrongStartBonus: 0,
        avgRegularSkillActivations: 0,
        regularSkillActivationRate: 0,
        avgRegularSkillPoints: 0,
        avgGoldSkillActivations: 0,
        goldSkillActivationRate: 0,
        avgGoldSkillPoints: 0,
        avgUniqueSkillActivations: 0,
        uniqueSkillActivationRate: 0,
        avgUniqueSkillPoints: 0,
        beatTargetTimeRate: 0,
        avgBeatTargetTimeBonus: 0,
        rushedOccurrenceRate: 0,
        avgRushedPenalty: 0,
        avgRushedDurationSeconds: 0,
        avgRushedDurationPenalty: 0,
        rushedDurationCount: 0,
    };
}

export function getLatestUmaEntry(sessions: TTSession[], buildKey: string): UmaEntry | null {
    let latestEntry: UmaEntry | null = null;
    let latestSavedAt = -1;
    sessions.forEach((session) => {
        const savedAt = session.savedAt?.getTime() ?? 0;
        session.rounds.forEach((round) => {
            const player = round.playerUmas.find((uma) => uma.buildKey === buildKey);
            if (!player) return;
            if (savedAt >= latestSavedAt) {
                latestSavedAt = savedAt;
                latestEntry = player;
            }
        });
    });
    return latestEntry;
}

/** Build keys for umas on the latest session roster (up to 15). */
export function getCurrentRosterBuildKeys(sessions: TTSession[]): Set<string> {
    if (sessions.length === 0) return new Set();

    const latestSession = [...sessions]
        .filter((s) => s.savedAt)
        .sort((a, b) => b.savedAt!.getTime() - a.savedAt!.getTime())[0]
        ?? sessions[sessions.length - 1];

    const keys = new Set<string>();
    latestSession.rounds.forEach((round) => {
        round.playerUmas.forEach((uma) => {
            keys.add(uma.buildKey || buildUmaFingerprint(uma));
        });
    });
    return keys;
}

export function buildUmaComparisonEntries(
    sessions: TTSession[],
    options?: { rosterOnly?: boolean },
): UmaComparisonEntry[] {
    if (sessions.length === 0) return [];

    const rosterKeys = getCurrentRosterBuildKeys(sessions);
    const map = new Map<string, {
        buildKey: string;
        charaId: number;
        cardId: number;
        charaName: string;
        rankScore: number;
        stats: UmaEntry['stats'];
        entries: UmaEntry[];
        normalizedScores: number[];
        wins: number;
        distanceCounts: Map<number, number>;
        lastSeenAt: number | null;
    }>();

    sessions.forEach((session) => {
        const bonus = bonusMultiplier(session.supportCardBonus);
        const sessionTime = session.savedAt?.getTime() ?? null;
        session.rounds.forEach((round) => {
            round.playerUmas.forEach((player) => {
                const key = player.buildKey || buildUmaFingerprint(player);
                const entry = map.get(key) ?? {
                    buildKey: key,
                    charaId: player.charaId,
                    cardId: player.cardId,
                    charaName: player.charaName,
                    rankScore: player.rankScore,
                    stats: player.stats,
                    entries: [],
                    normalizedScores: [],
                    wins: 0,
                    distanceCounts: new Map<number, number>(),
                    lastSeenAt: null,
                };
                entry.entries.push(player);
                entry.normalizedScores.push(player.totalScore / bonus);
                if (player.finishOrder === 1) entry.wins += 1;
                entry.distanceCounts.set(
                    round.distanceType,
                    (entry.distanceCounts.get(round.distanceType) ?? 0) + 1,
                );
                if (sessionTime !== null && (entry.lastSeenAt === null || sessionTime > entry.lastSeenAt)) {
                    entry.lastSeenAt = sessionTime;
                }
                map.set(key, entry);
            });
        });
    });

    let results = Array.from(map.values()).map((acc): UmaComparisonEntry => {
        const raceCount = acc.entries.length;
        const breakdown = aggregateScoreBreakdown(acc.entries) ?? emptyBreakdown();
        const normalizedTotal = acc.normalizedScores.reduce((sum, value) => sum + value, 0);
        let totalGoldSkillActivations = 0;
        let totalRegularSkillActivations = 0;
        let totalUniqueSkillActivations = 0;
        let totalGoldSkillChances = 0;
        let totalRegularSkillChances = 0;
        let totalUniqueSkillChances = 0;
        acc.entries.forEach((entry) => {
            const activations = countSkillActivations(entry);
            const learned = countLearnedSkills(entry);
            totalGoldSkillActivations += activations.gold;
            totalRegularSkillActivations += activations.regular;
            totalUniqueSkillActivations += activations.unique;
            totalGoldSkillChances += learned.gold;
            totalRegularSkillChances += learned.regular;
            totalUniqueSkillChances += learned.unique;
        });
        return {
            buildKey: acc.buildKey,
            charaId: acc.charaId,
            cardId: acc.cardId,
            charaName: acc.charaName,
            rankScore: acc.rankScore,
            stats: acc.stats,
            appearances: raceCount,
            wins: acc.wins,
            winRate: raceCount > 0 ? acc.wins / raceCount : 0,
            avgNormalizedScore: raceCount > 0 ? normalizedTotal / raceCount : 0,
            distanceType: primaryDistanceType(acc.distanceCounts),
            lastSeenAt: acc.lastSeenAt,
            scoreBreakdown: breakdown,
            avgGoldSkillActivations: raceCount > 0 ? totalGoldSkillActivations / raceCount : 0,
            avgRegularSkillActivations: raceCount > 0 ? totalRegularSkillActivations / raceCount : 0,
            avgUniqueSkillActivations: raceCount > 0 ? totalUniqueSkillActivations / raceCount : 0,
            totalGoldSkillActivations,
            totalRegularSkillActivations,
            totalUniqueSkillActivations,
            totalGoldSkillChances,
            totalRegularSkillChances,
            totalUniqueSkillChances,
        };
    });

    if (options?.rosterOnly) {
        results = results.filter((entry) => rosterKeys.has(entry.buildKey));
    }

    return results;
}

export function listHistoricalUmas(sessions: TTSession[]): UmaComparisonEntry[] {
    const rosterKeys = getCurrentRosterBuildKeys(sessions);
    return buildUmaComparisonEntries(sessions)
        .filter((entry) => !rosterKeys.has(entry.buildKey))
        .sort((a, b) => {
            if (a.distanceType !== b.distanceType) return a.distanceType - b.distanceType;
            return (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0);
        });
}

export function countFromRate(rate: number, total: number): number {
    return Math.round(rate * total);
}
