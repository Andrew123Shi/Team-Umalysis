import GameDataLoader from '../data/GameDataLoader';
import UMDatabaseWrapper from '../data/UMDatabaseWrapper';
import type {
    AggregatedStats,
    MatchupEntry,
    NumericSummary,
    OpponentStatSummary,
    PlayerUmaSummary,
    RosterChangeUma,
    RosterUmaSlot,
    RosterUpdate,
    ScoreBonusSettings,
    SkillFrequencyEntry,
    StyleComposition,
    StyleMatchupEntry,
    TrackMatchupEntry,
    TTSession,
    TTRound,
    UmaEntry,
} from './types';
import { computeTotalSkillPoints, isGoldSkill } from './skillUtils';
import { buildUmaFingerprint } from './umaIdentity';
import { aggregateScoreBreakdown } from './scoreBreakdown';
import { VICTORY_MIN_ROUND_WINS } from './scoreIds';
import { buildStyleSaturation } from './styleSaturation';
import { DISTANCE_LABELS, DISTANCE_ORDER, STRATEGY_LABELS } from './types';
import {
    BASE_SCORE_ONLY,
    inGameRoundScore,
    inGameSessionScore,
    roundScore,
    sessionScore,
    umaScore,
} from '../utils/teamTrialScore';

type AggregateOptions = { buildKey?: string; distanceType?: number; scoreBonuses?: ScoreBonusSettings };

/** Team Trials races always field 12 runners. */
const RACE_FIELD_SIZE = 12;

function countPlacements(placements: number[]): number[] {
    const counts = Array.from({ length: RACE_FIELD_SIZE }, () => 0);
    placements.forEach((placement) => {
        if (placement >= 1 && placement <= RACE_FIELD_SIZE) counts[placement - 1] += 1;
    });
    return counts;
}

function summarize(values: number[]): NumericSummary {
    if (values.length === 0) {
        return { count: 0, avg: 0, median: 0, min: 0, max: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    return {
        count: sorted.length,
        avg: sum / sorted.length,
        median,
        min: sorted[0],
        max: sorted[sorted.length - 1],
    };
}

const STYLE_COMPOSITION_KEYS = ['runaway', 'front', 'pace', 'late', 'end'] as const;

function emptyStyleComposition(): StyleComposition {
    return { runaway: 0, front: 0, pace: 0, late: 0, end: 0 };
}

function styleKey(style: number): keyof StyleComposition {
    switch (style) {
        case 1: return 'front';
        case 2: return 'pace';
        case 3: return 'late';
        case 4: return 'end';
        case 5: return 'runaway';
        default: return 'front';
    }
}

function scaleStyleComposition(comp: StyleComposition, factor: number): StyleComposition {
    const scaled = emptyStyleComposition();
    STYLE_COMPOSITION_KEYS.forEach((key) => { scaled[key] = comp[key] * factor; });
    return scaled;
}

function styleCountComposition(umas: UmaEntry[]): StyleComposition {
    const comp = emptyStyleComposition();
    umas.forEach((u) => { comp[styleKey(u.runningStyle)] += 1; });
    return comp;
}

function pctStyleComposition(umas: UmaEntry[]): StyleComposition {
    if (umas.length === 0) return emptyStyleComposition();
    return scaleStyleComposition(styleCountComposition(umas), 1 / umas.length);
}

/** Per-key mean across compositions (shares or counts). */
function meanStyleComposition(comps: StyleComposition[]): StyleComposition {
    if (comps.length === 0) return emptyStyleComposition();
    const sum = emptyStyleComposition();
    comps.forEach((comp) => {
        STYLE_COMPOSITION_KEYS.forEach((key) => { sum[key] += comp[key]; });
    });
    return scaleStyleComposition(sum, 1 / comps.length);
}

const mergeStyleCompositions = meanStyleComposition;
const mergeCountCompositions = meanStyleComposition;

function statSummary(umas: UmaEntry[], teamRatings: number[] = []): OpponentStatSummary {
    return {
        speed: summarize(umas.map((u) => u.stats.speed)),
        stamina: summarize(umas.map((u) => u.stats.stamina)),
        pow: summarize(umas.map((u) => u.stats.pow)),
        guts: summarize(umas.map((u) => u.stats.guts)),
        wiz: summarize(umas.map((u) => u.stats.wiz)),
        rankScore: summarize(umas.map((u) => u.rankScore)),
        teamRating: summarize(teamRatings),
        finalGrade: summarize(umas.map((u) => u.finalGrade)),
    };
}

function resolveSessionTeamRatings(
    session: TTSession,
    options?: { buildKey?: string; distanceType?: number },
): { selfTeamRating: number; opponentTeamRating: number } | null {
    if (options?.distanceType !== undefined) {
        const round = session.rounds.find((r) => r.distanceType === options.distanceType);
        if (!round) return null;
        return { selfTeamRating: round.selfEvaluate, opponentTeamRating: round.opponentEvaluate };
    }
    if (options?.buildKey !== undefined) {
        for (const round of session.rounds) {
            if (round.playerUmas.some((u) => u.buildKey === options.buildKey)) {
                return { selfTeamRating: round.selfEvaluate, opponentTeamRating: round.opponentEvaluate };
            }
        }
        return null;
    }
    if (session.rounds.length === 0) return null;
    const selfTeamRating = session.rounds.reduce((sum, r) => sum + r.selfEvaluate, 0) / session.rounds.length;
    const opponentTeamRating = session.rounds.reduce((sum, r) => sum + r.opponentEvaluate, 0) / session.rounds.length;
    return { selfTeamRating, opponentTeamRating };
}

function aptitudeSummary(umas: UmaEntry[]): Record<string, NumericSummary> {
    const fields: (keyof UmaEntry['aptitudes'])[] = [
        'short', 'mile', 'middle', 'long', 'turf', 'dirt', 'nige', 'senko', 'sashi', 'oikomi',
    ];
    const out: Record<string, NumericSummary> = {};
    fields.forEach((field) => {
        out[field] = summarize(umas.map((u) => u.aptitudes[field]));
    });
    return out;
}

function collectSkillStats(umas: UmaEntry[]): SkillFrequencyEntry[] {
    const totalUmas = umas.length;
    const map = new Map<number, { learned: number; activated: number }>();
    umas.forEach((uma) => {
        const learned = new Set(uma.skills.map((s) => s.skillId));
        const activated = new Set(uma.activatedSkillIds);
        learned.forEach((skillId) => {
            const entry = map.get(skillId) ?? { learned: 0, activated: 0 };
            entry.learned += 1;
            if (activated.has(skillId)) entry.activated += 1;
            map.set(skillId, entry);
        });
        activated.forEach((skillId) => {
            if (!learned.has(skillId)) {
                const entry = map.get(skillId) ?? { learned: 0, activated: 0 };
                entry.activated += 1;
                map.set(skillId, entry);
            }
        });
    });

    return Array.from(map.entries())
        .filter(([skillId]) => Number.isFinite(skillId) && skillId > 0)
        .map(([skillId, counts]) => ({
            skillId,
            skillName: UMDatabaseWrapper.skillNameWithEnglishFallback(skillId),
            activated: counts.activated,
            learned: counts.learned,
            activationRate: counts.learned > 0 ? counts.activated / counts.learned : 0,
            prevalenceRate: totalUmas > 0 ? counts.learned / totalUmas : 0,
            isGold: isGoldSkill(skillId),
        }))
        .sort((a, b) => b.activated - a.activated);
}

const SURFACE_LABELS: Record<number, string> = { 1: 'Turf', 2: 'Dirt' };

function matchupDisplayName(charaName: string, cardId: number): string {
    const cardName = UMDatabaseWrapper.cards[cardId]?.name;
    return cardName ? `${cardName} ${charaName}` : charaName;
}

function trackDisplayName(courseId: number): string {
    const course = (GameDataLoader.courseData as Record<string, { raceTrackId: number; surface: number; distance: number; course?: number }>)[String(courseId)];
    if (!course) return `Course ${courseId}`;
    const trackName = (GameDataLoader.tracknames as Record<string, string[]>)[course.raceTrackId]?.[1] ?? 'Unknown';
    const surface = SURFACE_LABELS[course.surface] ?? 'Unknown';
    const suffix = course.course === 2 ? ' (inner)' : course.course === 3 ? ' (outer)' : '';
    return `${trackName} ${surface} ${course.distance}m${suffix}`;
}

function buildMatchups(
    sessions: TTSession[],
    options?: AggregateOptions,
): MatchupEntry[] {
    const bonuses = scoreBonuses(options);
    let totalRounds = 0;
    const map = new Map<string, {
        charaId: number;
        cardId: number;
        charaName: string;
        instances: number;
        placements: number[];
        roundWins: number;
        normalizedScores: number[];
    }>();

    sessions.forEach((session) => {
        session.rounds.forEach((round) => {
            if (options?.distanceType !== undefined && round.distanceType !== options.distanceType) return;
            if (options?.buildKey !== undefined) {
                if (!round.playerUmas.some((u) => u.buildKey === options.buildKey)) return;
            }

            totalRounds += 1;
            const seenInRound = new Set<string>();
            const score = roundScore(round, bonuses, options?.buildKey);

            round.opponentUmas.forEach((opp) => {
                const key = `${opp.charaId}:${opp.cardId}`;
                if (seenInRound.has(key)) return;
                seenInRound.add(key);

                const entry = map.get(key) ?? {
                    charaId: opp.charaId,
                    cardId: opp.cardId,
                    charaName: opp.charaName,
                    instances: 0,
                    placements: [],
                    roundWins: 0,
                    normalizedScores: [],
                };
                entry.instances += 1;
                let countedWin = false;
                round.playerUmas.forEach((player) => {
                    if (options?.buildKey !== undefined && player.buildKey !== options.buildKey) return;
                    entry.placements.push(player.finishOrder);
                    if (!countedWin) {
                        if (options?.buildKey !== undefined) {
                            if (player.finishOrder === 1) entry.roundWins += 1;
                        } else if (round.playerWonRound) {
                            entry.roundWins += 1;
                        }
                        countedWin = true;
                    }
                });
                entry.normalizedScores.push(score);
                map.set(key, entry);
            });
        });
    });

    return Array.from(map.values()).map((e) => ({
        charaId: e.charaId,
        cardId: e.cardId,
        charaName: e.charaName,
        displayName: matchupDisplayName(e.charaName, e.cardId),
        appearances: e.instances,
        avgPlacement: e.placements.length > 0
            ? e.placements.reduce((a, b) => a + b, 0) / e.placements.length
            : 0,
        winRate: e.instances > 0 ? e.roundWins / e.instances : 0,
        occurrenceRate: totalRounds > 0 ? e.instances / totalRounds : 0,
        avgNormalizedScore: e.normalizedScores.length > 0
            ? e.normalizedScores.reduce((a, b) => a + b, 0) / e.normalizedScores.length
            : 0,
    }));
}

function scoreBonuses(options?: AggregateOptions): ScoreBonusSettings {
    return options?.scoreBonuses ?? BASE_SCORE_ONLY;
}

function buildTrackMatchups(
    sessions: TTSession[],
    options?: AggregateOptions,
): TrackMatchupEntry[] {
    const bonuses = scoreBonuses(options);
    let totalRounds = 0;
    const map = new Map<number, {
        instances: number;
        placements: number[];
        roundWins: number;
        normalizedScores: number[];
    }>();

    sessions.forEach((session) => {
        session.rounds.forEach((round) => {
            if (options?.distanceType !== undefined && round.distanceType !== options.distanceType) return;
            if (options?.buildKey !== undefined) {
                if (!round.playerUmas.some((u) => u.buildKey === options.buildKey)) return;
            }
            const courseId = round.courseId;
            if (!courseId) return;

            totalRounds += 1;
            const entry = map.get(courseId) ?? {
                instances: 0,
                placements: [],
                roundWins: 0,
                normalizedScores: [],
            };
            entry.instances += 1;
            let countedWin = false;
            round.playerUmas.forEach((player) => {
                if (options?.buildKey !== undefined && player.buildKey !== options.buildKey) return;
                entry.placements.push(player.finishOrder);
                if (!countedWin) {
                    if (options?.buildKey !== undefined) {
                        if (player.finishOrder === 1) entry.roundWins += 1;
                    } else if (round.playerWonRound) {
                        entry.roundWins += 1;
                    }
                    countedWin = true;
                }
            });
            entry.normalizedScores.push(roundScore(round, bonuses, options?.buildKey));
            map.set(courseId, entry);
        });
    });

    return Array.from(map.entries()).map(([courseId, e]) => ({
        courseId,
        displayName: trackDisplayName(courseId),
        appearances: e.instances,
        avgPlacement: e.placements.length > 0
            ? e.placements.reduce((a, b) => a + b, 0) / e.placements.length
            : 0,
        winRate: e.instances > 0 ? e.roundWins / e.instances : 0,
        occurrenceRate: totalRounds > 0 ? e.instances / totalRounds : 0,
        avgNormalizedScore: e.normalizedScores.length > 0
            ? e.normalizedScores.reduce((a, b) => a + b, 0) / e.normalizedScores.length
            : 0,
    }));
}

function styleCompositionKey(umas: UmaEntry[]): string {
    const counts = styleCountComposition(umas);
    return `R${counts.runaway}-F${counts.front}-P${counts.pace}-L${counts.late}-E${counts.end}`;
}

function buildStyleMatchups(rounds: TTRound[]): StyleMatchupEntry[] {
    const map = new Map<string, { composition: StyleComposition; placements: number[]; wins: number[] }>();

    rounds.forEach((round) => {
        const key = styleCompositionKey(round.opponentUmas);
        const scaled = scaleStyleComposition(pctStyleComposition(round.opponentUmas), 3);
        const entry = map.get(key) ?? { composition: scaled, placements: [], wins: [] };
        round.playerUmas.forEach((p) => {
            entry.placements.push(p.finishOrder);
            if (p.finishOrder === 1) entry.wins.push(1);
            else entry.wins.push(0);
        });
        map.set(key, entry);
    });

    return Array.from(map.entries())
        .map(([key, e]) => {
            const appearances = e.placements.length;
            const wins = e.wins.reduce((a, b) => a + b, 0);
            const label = `R${Math.round(e.composition.runaway)} F${Math.round(e.composition.front)} P${Math.round(e.composition.pace)} L${Math.round(e.composition.late)} E${Math.round(e.composition.end)}`;
            return {
                key,
                label,
                composition: e.composition,
                appearances,
                avgPlacement: e.placements.reduce((a, b) => a + b, 0) / appearances,
                wins,
                winRate: wins / appearances,
            };
        })
        .filter((e) => e.appearances >= 3)
        .sort((a, b) => b.appearances - a.appearances);
}

function filterRounds(sessions: TTSession[], predicate: (round: TTRound, session: TTSession) => boolean): TTRound[] {
    const rounds: TTRound[] = [];
    sessions.forEach((session) => {
        session.rounds.forEach((round) => {
            if (predicate(round, session)) rounds.push(round);
        });
    });
    return rounds;
}

function getSessionRoster(session: TTSession, distanceType?: number): Map<string, RosterChangeUma> {
    const roster = new Map<string, RosterChangeUma>();
    const rounds = distanceType !== undefined
        ? session.rounds.filter((round) => round.distanceType === distanceType)
        : session.rounds;
    rounds.forEach((round) => {
        round.playerUmas.forEach((uma) => {
            const key = uma.buildKey || buildUmaFingerprint(uma);
            if (roster.has(key)) return;
            roster.set(key, {
                buildKey: key,
                charaName: uma.charaName,
                cardId: uma.cardId,
                rankScore: uma.rankScore,
            });
        });
    });
    return roster;
}

function resolvePrimaryDistanceType(sessions: TTSession[], buildKey: string): number | undefined {
    const counts = new Map<number, number>();
    sessions.forEach((session) => {
        session.rounds.forEach((round) => {
            if (!round.playerUmas.some((uma) => uma.buildKey === buildKey)) return;
            counts.set(round.distanceType, (counts.get(round.distanceType) ?? 0) + 1);
        });
    });
    if (counts.size === 0) return undefined;

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

function rosterUpdateForUmaView(update: RosterUpdate | undefined, buildKey: string): RosterUpdate | undefined {
    if (!update) return undefined;
    const involvesViewedUma = update.added.some((uma) => uma.buildKey === buildKey)
        || update.removed.some((uma) => uma.buildKey === buildKey);
    if (involvesViewedUma) return undefined;
    return update;
}

/** Outcome for one scoreTrend point — matches sessionWins / placement win rules. */
function trendPointWon(
    session: TTSession,
    options?: { buildKey?: string; distanceType?: number },
    umaFinishOrder?: number,
): boolean {
    if (options?.buildKey !== undefined) {
        return umaFinishOrder === 1;
    }
    if (options?.distanceType !== undefined) {
        const round = session.rounds.find((r) => r.distanceType === options.distanceType);
        return round?.playerWonRound ?? false;
    }
    return isSessionWon(session);
}

function sessionRaceWinRate(session: TTSession): number {
    if (session.rounds.length === 0) return 0;
    return session.rounds.filter((r) => r.playerWonRound).length / session.rounds.length;
}

function diffRoster(prev: Map<string, RosterChangeUma>, curr: Map<string, RosterChangeUma>): RosterUpdate | undefined {
    const added: RosterChangeUma[] = [];
    const removed: RosterChangeUma[] = [];
    curr.forEach((uma, key) => {
        if (!prev.has(key)) added.push(uma);
    });
    prev.forEach((uma, key) => {
        if (!curr.has(key)) removed.push(uma);
    });
    if (added.length === 0 && removed.length === 0) return undefined;
    return { added, removed };
}

function buildRosterUpdatesBySessionId(
    sessions: TTSession[],
    distanceType?: number,
): Map<string, RosterUpdate> {
    const sorted = [...sessions]
        .filter((s) => s.savedAt)
        .sort((a, b) => a.savedAt!.getTime() - b.savedAt!.getTime());
    const updates = new Map<string, RosterUpdate>();
    let previousRoster: Map<string, RosterChangeUma> | null = null;

    sorted.forEach((session) => {
        const currentRoster = getSessionRoster(session, distanceType);
        if (previousRoster) {
            const update = diffRoster(previousRoster, currentRoster);
            if (update) updates.set(session.id, update);
        }
        previousRoster = currentRoster;
    });

    return updates;
}

function sessionAggregateScore(session: TTSession, options?: AggregateOptions): number {
    const bonuses = scoreBonuses(options);
    if (options?.distanceType !== undefined) {
        const round = session.rounds.find((r) => r.distanceType === options.distanceType);
        return round ? roundScore(round, bonuses, options.buildKey) : 0;
    }
    if (options?.buildKey !== undefined) {
        const round = session.rounds.find((r) => r.playerUmas.some((u) => u.buildKey === options.buildKey));
        return round ? roundScore(round, bonuses, options.buildKey) : 0;
    }
    return sessionScore(session, bonuses);
}

function isSessionWon(session: TTSession): boolean {
    return session.rounds.filter((r) => r.playerWonRound).length >= VICTORY_MIN_ROUND_WINS;
}

export function aggregateStats(
    sessions: TTSession[],
    options?: AggregateOptions,
): AggregatedStats {
    const bonuses = scoreBonuses(options);
    const rounds = filterRounds(sessions, (round, _session) => {
        if (options?.distanceType !== undefined && round.distanceType !== options.distanceType) return false;
        if (options?.buildKey !== undefined) {
            return round.playerUmas.some((u) => u.buildKey === options.buildKey);
        }
        return true;
    });

    const playerEntries = rounds.flatMap((r) =>
        options?.buildKey !== undefined
            ? r.playerUmas.filter((u) => u.buildKey === options.buildKey)
            : r.playerUmas,
    );
    const opponentEntries = rounds.flatMap((r) => r.opponentUmas);
    const npcEntries = rounds.flatMap((r) => r.npcUmas);

    const placements = playerEntries.map((u) => u.finishOrder);
    const scores = rounds.flatMap((r) =>
        r.playerUmas
            .filter((u) => options?.buildKey === undefined || u.buildKey === options.buildKey)
            .map((u) => umaScore(u, bonuses)),
    );

    const teamScores = rounds.map((r) => roundScore(r, bonuses, options?.buildKey));
    const inGameTeamScores = rounds.map(inGameRoundScore);
    const wins = placements.filter((p) => p === 1).length;
    const top2 = placements.filter((p) => p <= 2).length;
    const top3 = placements.filter((p) => p <= 3).length;

    const roundBestPlacements = rounds.map((r) => {
        const entries = options?.buildKey !== undefined
            ? r.playerUmas.filter((u) => u.buildKey === options.buildKey)
            : r.playerUmas;
        if (entries.length === 0) return 99;
        return Math.min(...entries.map((u) => u.finishOrder));
    });
    const roundWins = rounds.filter((r) => r.playerWonRound).length;
    const roundTop2 = roundBestPlacements.filter((p) => p <= 2).length;
    const roundTop3 = roundBestPlacements.filter((p) => p <= 3).length;
    const roundAllPodium = rounds.filter((round) => {
        const entries = options?.buildKey !== undefined
            ? round.playerUmas.filter((u) => u.buildKey === options.buildKey)
            : round.playerUmas;
        return entries.length > 0 && entries.every((u) => u.finishOrder <= 3);
    }).length;
    const roundAllPlaced = rounds.filter((round) => {
        const entries = options?.buildKey !== undefined
            ? round.playerUmas.filter((u) => u.buildKey === options.buildKey)
            : round.playerUmas;
        return entries.length > 0 && entries.every((u) => u.finishOrder <= 5);
    }).length;

    const opponentComps = rounds.map((r) => pctStyleComposition(r.opponentUmas));
    const npcComps = rounds.map((r) => pctStyleComposition(r.npcUmas));
    const roomComps = rounds.map((r) => pctStyleComposition([...r.opponentUmas, ...r.npcUmas]));

    const opponentCountComps = rounds.map((r) => styleCountComposition(r.opponentUmas));
    const npcCountComps = rounds.map((r) => styleCountComposition(r.npcUmas));
    const roomCountComps = rounds.map((r) => styleCountComposition([...r.opponentUmas, ...r.npcUmas]));

    const goldActsByRound: number[] = [];
    const whiteActsByRound: number[] = [];
    rounds.forEach((r) => {
        let gold = 0;
        let white = 0;
        r.playerUmas.forEach((u) => {
            if (options?.buildKey !== undefined && u.buildKey !== options.buildKey) return;
            u.activatedSkillIds.forEach((skillId) => {
                if (isGoldSkill(skillId)) gold += 1;
                else white += 1;
            });
        });
        goldActsByRound.push(gold);
        whiteActsByRound.push(white);
    });

    const matchups = buildMatchups(sessions, options);
    const trackMatchups = buildTrackMatchups(sessions, options);
    const filteredSessions = sessions.filter((s) => s.rounds.some((r) => rounds.includes(r)));
    const rosterScopeDistance = options?.distanceType
        ?? (options?.buildKey !== undefined
            ? resolvePrimaryDistanceType(sessions, options.buildKey)
            : undefined);
    const rosterUpdatesBySessionId = buildRosterUpdatesBySessionId(sessions, rosterScopeDistance);
    const sessionScoreTotals = filteredSessions.map((s) => sessionAggregateScore(s, options));
    const inGameSessionScoreTotals = filteredSessions.map(inGameSessionScore);

    const sessionWins = filteredSessions.filter((s) => {
        if (options?.distanceType !== undefined) {
            const round = s.rounds.find((r) => r.distanceType === options.distanceType);
            return round?.playerWonRound ?? false;
        }
        return isSessionWon(s);
    }).length;

    const ratingBuckets = new Map<string, { placements: number[]; wins: number }>();
    rounds.forEach((r) => {
        const bucket = `${Math.floor(r.opponentEvaluate / 10000) * 10}k`;
        const entry = ratingBuckets.get(bucket) ?? { placements: [], wins: 0 };
        r.playerUmas.forEach((p) => {
            if (options?.buildKey !== undefined && p.buildKey !== options.buildKey) return;
            entry.placements.push(p.finishOrder);
            if (p.finishOrder === 1) entry.wins += 1;
        });
        ratingBuckets.set(bucket, entry);
    });

    const distanceMap = new Map<string, { roundWins: number; rounds: number; scoreTotals: number[] }>();
    sessions.forEach((session) => {
        session.rounds.forEach((round) => {
            if (options?.distanceType !== undefined && round.distanceType !== options.distanceType) return;
            if (options?.buildKey !== undefined) {
                if (!round.playerUmas.some((u) => u.buildKey === options.buildKey)) return;
            }
            const entry = distanceMap.get(round.distanceLabel) ?? { roundWins: 0, rounds: 0, scoreTotals: [] };
            entry.rounds += 1;
            if (round.playerWonRound) entry.roundWins += 1;
            entry.scoreTotals.push(roundScore(round, bonuses, options?.buildKey));
            distanceMap.set(round.distanceLabel, entry);
        });
    });

    const umaMap = new Map<string, {
        buildKey: string;
        charaId: number;
        cardId: number;
        charaName: string;
        rankScore: number;
        stats: UmaEntry['stats'];
        placements: number[];
        scores: number[];
        wins: number;
    }>();
    rounds.forEach((r) => {
        r.playerUmas.forEach((p) => {
            const key = p.buildKey || buildUmaFingerprint(p);
            const entry = umaMap.get(key) ?? {
                buildKey: key,
                charaId: p.charaId,
                cardId: p.cardId,
                charaName: p.charaName,
                rankScore: p.rankScore,
                stats: p.stats,
                placements: [],
                scores: [],
                wins: 0,
            };
            entry.placements.push(p.finishOrder);
            entry.scores.push(umaScore(p, bonuses));
            if (p.finishOrder === 1) entry.wins += 1;
            umaMap.set(key, entry);
        });
    });

    return {
        totalRounds: rounds.length,
        totalSessions: filteredSessions.length,
        playerRoundWins: rounds.filter((r) => r.playerWonRound).length,
        scoreBonuses: bonuses,
        sessionWinRate: filteredSessions.length > 0 ? sessionWins / filteredSessions.length : 0,
        placement: summarize(placements),
        placementCounts: countPlacements(placements),
        score: summarize(scores),
        raceScoreTotal: summarize(sessionScoreTotals),
        raceScoreTotalInGame: summarize(inGameSessionScoreTotals),
        teamScore: summarize(teamScores),
        teamScoreInGame: summarize(inGameTeamScores),
        winRate: placements.length > 0 ? wins / placements.length : 0,
        top2Rate: placements.length > 0 ? top2 / placements.length : 0,
        top3Rate: placements.length > 0 ? top3 / placements.length : 0,
        roundWinRate: rounds.length > 0 ? roundWins / rounds.length : 0,
        roundTop2Rate: rounds.length > 0 ? roundTop2 / rounds.length : 0,
        roundTop3Rate: rounds.length > 0 ? roundTop3 / rounds.length : 0,
        roundAllPodiumRate: rounds.length > 0 ? roundAllPodium / rounds.length : 0,
        roundAllPlacedRate: rounds.length > 0 ? roundAllPlaced / rounds.length : 0,
        opponentStyleComposition: mergeStyleCompositions(opponentComps),
        npcStyleComposition: mergeStyleCompositions(npcComps),
        roomStyleComposition: mergeStyleCompositions(roomComps),
        opponentStyleCompositionAvgCount: mergeCountCompositions(opponentCountComps),
        npcStyleCompositionAvgCount: mergeCountCompositions(npcCountComps),
        roomStyleCompositionAvgCount: mergeCountCompositions(roomCountComps),
        opponentStats: statSummary(opponentEntries, rounds.map((r) => r.opponentEvaluate)),
        npcStats: statSummary(npcEntries),
        opponentAptitudes: aptitudeSummary(opponentEntries),
        npcAptitudes: aptitudeSummary(npcEntries),
        opponentSkills: collectSkillStats(opponentEntries),
        playerSkillActivations: collectSkillStats(playerEntries),
        avgGoldActivations: rounds.length > 0 ? goldActsByRound.reduce((a, b) => a + b, 0) / rounds.length : 0,
        avgWhiteActivations: rounds.length > 0 ? whiteActsByRound.reduce((a, b) => a + b, 0) / rounds.length : 0,
        goldActivations: summarize(goldActsByRound),
        whiteActivations: summarize(whiteActsByRound),
        matchups,
        trackMatchups,
        styleMatchups: buildStyleMatchups(rounds),
        styleSaturation: options?.buildKey !== undefined
            ? buildStyleSaturation(rounds, options.buildKey)
            : null,
        scoreTrend: filteredSessions
            .filter((s) => s.savedAt)
            .sort((a, b) => (a.savedAt!.getTime() - b.savedAt!.getTime()))
            .flatMap((s) => {
                const rosterUpdate = options?.buildKey !== undefined
                    ? rosterUpdateForUmaView(rosterUpdatesBySessionId.get(s.id), options.buildKey)
                    : rosterUpdatesBySessionId.get(s.id);
                const teamRatings = resolveSessionTeamRatings(s, options);
                if (options?.buildKey !== undefined) {
                    for (const round of s.rounds) {
                        const uma = round.playerUmas.find((u) => u.buildKey === options.buildKey);
                        if (uma && teamRatings) {
                            return [{
                                date: s.savedAt!.toISOString().slice(0, 10),
                                fileName: s.fileName,
                                teamScore: umaScore(uma, bonuses),
                                supportCardBonus: s.supportCardBonus,
                                selfTeamRating: teamRatings.selfTeamRating,
                                opponentTeamRating: teamRatings.opponentTeamRating,
                                won: trendPointWon(s, options, uma.finishOrder),
                                ...(rosterUpdate ? { rosterUpdate } : {}),
                            }];
                        }
                    }
                    return [];
                }
                if (!teamRatings) return [];
                const isTeamOverview = options?.buildKey === undefined
                    && options?.distanceType === undefined;
                return [{
                    date: s.savedAt!.toISOString().slice(0, 10),
                    fileName: s.fileName,
                    teamScore: sessionAggregateScore(s, options),
                    supportCardBonus: s.supportCardBonus,
                    selfTeamRating: teamRatings.selfTeamRating,
                    opponentTeamRating: teamRatings.opponentTeamRating,
                    won: trendPointWon(s, options),
                    ...(isTeamOverview ? { raceWinRate: sessionRaceWinRate(s) } : {}),
                    ...(rosterUpdate ? { rosterUpdate } : {}),
                }];
            }),
        opponentRatingBuckets: Array.from(ratingBuckets.entries())
            .map(([bucket, e]) => ({
                bucket,
                appearances: e.placements.length,
                avgPlacement: e.placements.reduce((a, b) => a + b, 0) / Math.max(e.placements.length, 1),
                winRate: e.wins / Math.max(e.placements.length, 1),
            }))
            .sort((a, b) => a.bucket.localeCompare(b.bucket)),
        distanceWinRates: DISTANCE_ORDER
            .map((distanceType) => {
                const distance = DISTANCE_LABELS[distanceType];
                const e = distanceMap.get(distance);
                if (!e) return null;
                return {
                    distance,
                    appearances: e.rounds,
                    winRate: e.rounds > 0 ? e.roundWins / e.rounds : 0,
                    avgScore: e.scoreTotals.length > 0 ? e.scoreTotals.reduce((a, b) => a + b, 0) / e.scoreTotals.length : 0,
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
        playerUmas: Array.from(umaMap.values())
            .map((e): PlayerUmaSummary => {
                const placement = summarize(e.placements);
                const score = summarize(e.scores);
                return {
                    buildKey: e.buildKey,
                    charaId: e.charaId,
                    cardId: e.cardId,
                    charaName: e.charaName,
                    rankScore: e.rankScore,
                    stats: e.stats,
                    appearances: e.placements.length,
                    winRate: e.placements.length > 0 ? e.wins / e.placements.length : 0,
                    avgPlacement: placement.avg,
                    avgScore: score.avg,
                    placement,
                    score,
                };
            })
            .sort((a, b) => b.appearances - a.appearances),
        scoreBreakdown: options?.buildKey !== undefined
            ? aggregateScoreBreakdown(playerEntries, bonuses)
            : null,
    };
}

export function aggregateOverall(sessions: TTSession[], scoreBonuses?: ScoreBonusSettings): AggregatedStats {
    return aggregateStats(sessions, { scoreBonuses });
}

export function aggregateByUma(sessions: TTSession[], buildKey: string, scoreBonuses?: ScoreBonusSettings): AggregatedStats {
    return aggregateStats(sessions, { buildKey, scoreBonuses });
}

export function aggregateByDistance(sessions: TTSession[], distanceType: number, scoreBonuses?: ScoreBonusSettings): AggregatedStats {
    return aggregateStats(sessions, { distanceType, scoreBonuses });
}

/**
 * Current team roster as 5 distance columns × up to 3 slot rows (Ace first by teamMemberId).
 * `playerUmas` is the Overall aggregate's list, which carries each uma's stats.
 */
export function getTeamRosterGrid(sessions: TTSession[], playerUmas: PlayerUmaSummary[]): (RosterUmaSlot | null)[][] {
    if (sessions.length === 0) return [];

    const statsByBuildKey = new Map(playerUmas.map((u) => [u.buildKey, u]));

    const latestSession = [...sessions]
        .filter((s) => s.savedAt)
        .sort((a, b) => b.savedAt!.getTime() - a.savedAt!.getTime())[0]
        ?? sessions[sessions.length - 1];

    return DISTANCE_ORDER.map((distanceType) => {
        const round = latestSession.rounds.find((r) => r.distanceType === distanceType);
        if (!round) return [null, null, null];

        const slots: (RosterUmaSlot | null)[] = [null, null, null];
        const sorted = [...round.playerUmas].sort((a, b) => a.teamMemberId - b.teamMemberId);
        sorted.slice(0, 3).forEach((uma, rowIdx) => {
            const stats = statsByBuildKey.get(uma.buildKey);
            if (!stats) return;
            slots[rowIdx] = {
                ...stats,
                teamMemberId: uma.teamMemberId,
                distanceType,
                runningStyle: uma.runningStyle,
                starCount: uma.starCount,
                totalSkillPoints: computeTotalSkillPoints(uma.skills),
            };
        });
        return slots;
    });
}

export { STRATEGY_LABELS };
