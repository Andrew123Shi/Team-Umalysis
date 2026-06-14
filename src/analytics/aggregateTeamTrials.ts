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
    ScoreEvent,
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
import { buildStyleSaturation } from './styleSaturation';
import { DISTANCE_LABELS, DISTANCE_ORDER, STRATEGY_LABELS } from './types';

type AggregateOptions = { buildKey?: string; distanceType?: number; scoreBonuses?: ScoreBonusSettings };

const DEFAULT_SCORE_BONUSES: ScoreBonusSettings = {
    ace: false,
    opponentRating: false,
    streak: false,
    supportCard: false,
};

const TEAM_PLACEMENT_SCORE_IDS = new Set([94, 95]);

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

function styleKey(style: number): keyof StyleComposition {
    switch (style) {
        case 1: return 'front';
        case 2: return 'pace';
        case 3: return 'late';
        case 4: return 'end';
        case 5: return 'front';
        default: return 'front';
    }
}

function pctStyleComposition(umas: UmaEntry[]): StyleComposition {
    const comp: StyleComposition = { front: 0, pace: 0, late: 0, end: 0 };
    if (umas.length === 0) return comp;
    umas.forEach((u) => { comp[styleKey(u.runningStyle)] += 1; });
    const n = umas.length;
    return {
        front: comp.front / n,
        pace: comp.pace / n,
        late: comp.late / n,
        end: comp.end / n,
    };
}

function mergeStyleCompositions(comps: StyleComposition[]): StyleComposition {
    if (comps.length === 0) {
        return { front: 0, pace: 0, late: 0, end: 0 };
    }
    const sum = comps.reduce((acc, c) => ({
        front: acc.front + c.front,
        pace: acc.pace + c.pace,
        late: acc.late + c.late,
        end: acc.end + c.end,
    }), { front: 0, pace: 0, late: 0, end: 0 });
    const n = comps.length;
    return {
        front: sum.front / n,
        pace: sum.pace / n,
        late: sum.late / n,
        end: sum.end / n,
    };
}

function styleCountComposition(umas: UmaEntry[]): StyleComposition {
    const comp: StyleComposition = { front: 0, pace: 0, late: 0, end: 0 };
    if (umas.length === 0) return comp;
    umas.forEach((u) => { comp[styleKey(u.runningStyle)] += 1; });
    return comp;
}

function mergeCountCompositions(comps: StyleComposition[]): StyleComposition {
    if (comps.length === 0) {
        return { front: 0, pace: 0, late: 0, end: 0 };
    }
    const sum = comps.reduce((acc, c) => ({
        front: acc.front + c.front,
        pace: acc.pace + c.pace,
        late: acc.late + c.late,
        end: acc.end + c.end,
    }), { front: 0, pace: 0, late: 0, end: 0 });
    const n = comps.length;
    return {
        front: sum.front / n,
        pace: sum.pace / n,
        late: sum.late / n,
        end: sum.end / n,
    };
}

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
            const score = roundPlayerScore(round, bonuses, options?.buildKey, options?.buildKey === undefined);

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

function bonusMultiplier(supportCardBonus: number): number {
    const pct = supportCardBonus / 100;
    return pct > 0 ? 1 + pct / 100 : 1;
}

function scoreBonuses(options?: AggregateOptions): ScoreBonusSettings {
    return options?.scoreBonuses ?? DEFAULT_SCORE_BONUSES;
}

function umaDisplayScore(uma: UmaEntry, bonuses: ScoreBonusSettings): number {
    const baseScore = Number.isFinite(uma.totalBaseScore) ? uma.totalBaseScore : uma.totalScore;
    return baseScore + scoreEventBonusTotal(uma.scoreEvents, bonuses);
}

function scoreEventDisplayScore(event: ScoreEvent, bonuses: ScoreBonusSettings): number {
    return (Number.isFinite(event.baseScore) ? event.baseScore : event.score)
        + (bonuses.ace ? (event.bonusScores?.ace ?? 0) : 0)
        + (bonuses.opponentRating ? (event.bonusScores?.opponentRating ?? 0) : 0)
        + (bonuses.streak ? (event.bonusScores?.streak ?? 0) : 0)
        + (bonuses.supportCard ? (event.bonusScores?.supportCard ?? 0) : 0);
}

function scoreEventBonusTotal(events: ScoreEvent[], bonuses: ScoreBonusSettings): number {
    return events.reduce((sum, event) => (
        sum
        + (bonuses.ace ? (event.bonusScores?.ace ?? 0) : 0)
        + (bonuses.opponentRating ? (event.bonusScores?.opponentRating ?? 0) : 0)
        + (bonuses.streak ? (event.bonusScores?.streak ?? 0) : 0)
        + (bonuses.supportCard ? (event.bonusScores?.supportCard ?? 0) : 0)
    ), 0);
}

function allMembersPlacedScore(round: TTRound, bonuses: ScoreBonusSettings): number {
    return round.teamScoreEvents
        .filter((event) => TEAM_PLACEMENT_SCORE_IDS.has(event.rawScoreId))
        .reduce((sum, event) => sum + scoreEventDisplayScore(event, bonuses), 0);
}

function roundPlayerScore(
    round: TTRound,
    bonuses: ScoreBonusSettings,
    buildKey?: string,
    includeAllMembersPlaced = false,
): number {
    const playerScore = round.playerUmas.reduce((sum, uma) => {
        if (buildKey !== undefined && uma.buildKey !== buildKey) return sum;
        return sum + umaDisplayScore(uma, bonuses);
    }, 0);
    return playerScore + (includeAllMembersPlaced ? allMembersPlacedScore(round, bonuses) : 0);
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
            entry.normalizedScores.push(roundPlayerScore(round, bonuses, options?.buildKey, options?.buildKey === undefined));
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
    const counts = { front: 0, pace: 0, late: 0, end: 0 };
    umas.forEach((u) => { counts[styleKey(u.runningStyle)] += 1; });
    return `F${counts.front}-P${counts.pace}-L${counts.late}-E${counts.end}`;
}

function buildStyleMatchups(rounds: TTRound[]): StyleMatchupEntry[] {
    const map = new Map<string, { composition: StyleComposition; placements: number[]; wins: number[] }>();

    rounds.forEach((round) => {
        const key = styleCompositionKey(round.opponentUmas);
        const comp = pctStyleComposition(round.opponentUmas);
        const scaled = {
            front: comp.front * 3,
            pace: comp.pace * 3,
            late: comp.late * 3,
            end: comp.end * 3,
        };
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
            const label = `F${Math.round(e.composition.front)} P${Math.round(e.composition.pace)} L${Math.round(e.composition.late)} E${Math.round(e.composition.end)}`;
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
    if (options?.distanceType !== undefined) {
        const round = session.rounds.find((r) => r.distanceType === options.distanceType);
        return round ? roundPlayerScore(round, scoreBonuses(options), options.buildKey, options.buildKey === undefined) : 0;
    }
    if (options?.buildKey !== undefined) {
        for (const round of session.rounds) {
            if (round.playerUmas.some((u) => u.buildKey === options.buildKey)) {
                return roundPlayerScore(round, scoreBonuses(options), options.buildKey);
            }
        }
        return 0;
    }
    return session.rounds.reduce((sum, r) => sum + r.teamTotalScore, 0);
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
            .map((u) => umaDisplayScore(u, bonuses)),
    );

    const teamScores = rounds.map((r) => (
        options?.distanceType !== undefined || options?.buildKey !== undefined
            ? roundPlayerScore(r, bonuses, options?.buildKey, options?.distanceType !== undefined && options?.buildKey === undefined)
            : r.teamTotalScore
    ));
    const rawTeamScores = rounds.map((r) => r.teamTotalScore);
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
    const sessionScoreTotalsNormalized = filteredSessions.map((s) => {
        const score = sessionAggregateScore(s, options);
        return options?.buildKey !== undefined || options?.distanceType !== undefined
            ? score
            : score / bonusMultiplier(s.supportCardBonus);
    });

    const sessionWins = filteredSessions.filter((s) => {
        if (options?.distanceType !== undefined) {
            const round = s.rounds.find((r) => r.distanceType === options.distanceType);
            return round?.playerWonRound ?? false;
        }
        const teamRoundWins = s.rounds.filter((r) => r.playerWonRound).length;
        return teamRoundWins >= 3;
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
            entry.scoreTotals.push(roundPlayerScore(round, bonuses, options?.buildKey, options?.buildKey === undefined));
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
            entry.scores.push(umaDisplayScore(p, bonuses));
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
        score: summarize(scores),
        raceScoreTotal: summarize(sessionScoreTotals),
        raceScoreTotalNormalized: summarize(sessionScoreTotalsNormalized),
        teamScore: summarize(teamScores),
        teamScoreRaw: summarize(rawTeamScores),
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
                                teamScore: umaDisplayScore(uma, bonuses),
                                supportCardBonus: s.supportCardBonus,
                                selfTeamRating: teamRatings.selfTeamRating,
                                opponentTeamRating: teamRatings.opponentTeamRating,
                                ...(rosterUpdate ? { rosterUpdate } : {}),
                            }];
                        }
                    }
                    return [];
                }
                if (!teamRatings) return [];
                return [{
                    date: s.savedAt!.toISOString().slice(0, 10),
                    fileName: s.fileName,
                    teamScore: sessionAggregateScore(s, options),
                    supportCardBonus: s.supportCardBonus,
                    selfTeamRating: teamRatings.selfTeamRating,
                    opponentTeamRating: teamRatings.opponentTeamRating,
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

export function listPlayerUmas(sessions: TTSession[], scoreBonuses?: ScoreBonusSettings): PlayerUmaSummary[] {
    return aggregateOverall(sessions, scoreBonuses).playerUmas;
}

/** Current team roster as 5 distance columns × up to 3 slot rows (Ace first by teamMemberId). */
export function getTeamRosterGrid(sessions: TTSession[], scoreBonuses?: ScoreBonusSettings): (RosterUmaSlot | null)[][] {
    if (sessions.length === 0) return [];

    const statsByBuildKey = new Map(
        aggregateOverall(sessions, scoreBonuses).playerUmas.map((u) => [u.buildKey, u]),
    );

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
