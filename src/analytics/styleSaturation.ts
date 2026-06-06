import type { StyleSaturationData, StyleSaturationSeries, TTRound, TTSession } from './types';

const STYLE_IDS = [1, 2, 3, 4, 5] as const;

/** Display order: Runaway before Front. */
export const STYLE_SATURATION_ORDER = [5, 1, 2, 3, 4] as const;

const STYLE_LABELS: Record<number, string> = {
    1: 'Front',
    2: 'Pace',
    3: 'Late',
    4: 'End',
    5: 'Runaway',
};

export type StyleSaturationOptions = {
    roomScope: 'total' | 'opponent';
    includeTeam: boolean;
};

export const DEFAULT_STYLE_SATURATION_OPTIONS: StyleSaturationOptions = {
    roomScope: 'total',
    includeTeam: true,
};

function styleCountPool(round: TTRound, options: StyleSaturationOptions) {
    const pool = options.roomScope === 'total'
        ? [...round.opponentUmas, ...round.npcUmas]
        : [...round.opponentUmas];
    if (options.includeTeam) {
        pool.push(...round.playerUmas);
    }
    return pool;
}

function countStyleInRoom(room: TTRound['opponentUmas'], styleId: number): number {
    return room.filter((uma) => uma.runningStyle === styleId).length;
}

export function collectUmaRounds(sessions: TTSession[], buildKey: string): TTRound[] {
    const rounds: TTRound[] = [];
    sessions.forEach((session) => {
        session.rounds.forEach((round) => {
            if (round.playerUmas.some((uma) => uma.buildKey === buildKey)) {
                rounds.push(round);
            }
        });
    });
    return rounds;
}

export function buildStyleSaturation(
    rounds: TTRound[],
    buildKey: string,
    options: StyleSaturationOptions = DEFAULT_STYLE_SATURATION_OPTIONS,
): StyleSaturationData {
    const buckets = new Map<number, Map<number, { wins: number; races: number }>>();
    STYLE_IDS.forEach((styleId) => buckets.set(styleId, new Map()));

    rounds.forEach((round) => {
        const player = round.playerUmas.find((uma) => uma.buildKey === buildKey);
        if (!player) return;

        const room = styleCountPool(round, options);
        const won = player.finishOrder === 1;

        STYLE_IDS.forEach((styleId) => {
            const count = countStyleInRoom(room, styleId);
            const styleBuckets = buckets.get(styleId)!;
            const entry = styleBuckets.get(count) ?? { wins: 0, races: 0 };
            entry.races += 1;
            if (won) entry.wins += 1;
            styleBuckets.set(count, entry);
        });
    });

    return STYLE_SATURATION_ORDER.map((styleId): StyleSaturationSeries => {
        const styleBuckets = buckets.get(styleId)!;
        const points = Array.from(styleBuckets.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([count, { wins, races }]) => ({
                count,
                winRate: races > 0 ? wins / races : 0,
                races,
            }));
        return {
            styleId,
            label: STYLE_LABELS[styleId],
            points,
        };
    });
}

export const STYLE_SATURATION_COLORS: Record<number, string> = {
    1: '#6ea8fe',
    2: '#75b798',
    3: '#ffc107',
    4: '#fd7e14',
    5: '#e685b5',
};
