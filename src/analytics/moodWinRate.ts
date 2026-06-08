import { motivationLabels } from '../data/UMDatabaseUtils';
import type { TTRound } from './types';

const MOOD_IDS = [1, 2, 3, 4, 5] as const;

export type MoodWinRatePoint = {
    mood: number;
    label: string;
    winRate: number;
    races: number;
};

export type MoodWinRateData = MoodWinRatePoint[];

export const MOOD_COLORS: Record<number, string> = {
    1: '#ad54ff',
    2: '#1088f7',
    3: '#ffd418',
    4: '#ff9639',
    5: '#f85e8c',
};

export const MOOD_ICON_KEYS: Record<number, string> = {
    1: 'utx_ico_motivation_m_00',
    2: 'utx_ico_motivation_m_01',
    3: 'utx_ico_motivation_m_02',
    4: 'utx_ico_motivation_m_03',
    5: 'utx_ico_motivation_m_04',
};

export function buildMoodWinRate(rounds: TTRound[], buildKey: string): MoodWinRateData {
    const buckets = new Map<number, { wins: number; races: number }>();

    rounds.forEach((round) => {
        const player = round.playerUmas.find((uma) => uma.buildKey === buildKey);
        if (!player) return;

        const mood = player.motivation;
        const entry = buckets.get(mood) ?? { wins: 0, races: 0 };
        entry.races += 1;
        if (player.finishOrder === 1) entry.wins += 1;
        buckets.set(mood, entry);
    });

    return MOOD_IDS.map((mood) => {
        const entry = buckets.get(mood) ?? { wins: 0, races: 0 };
        return {
            mood,
            label: motivationLabels[mood] ?? String(mood),
            winRate: entry.races > 0 ? entry.wins / entry.races : 0,
            races: entry.races,
        };
    });
}
