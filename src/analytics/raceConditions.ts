import AssetLoader from '../data/AssetLoader';
import { motivationLabels } from '../data/UMDatabaseUtils';
import { isStandardDistance } from '../utils/course';
import { MOOD_COLORS, MOOD_ICON_KEYS } from './moodWinRate';
import type { DistributionSlice, TTSession } from './types';

export type DistributionMeta = {
    key: string;
    label: string;
    color: string;
    icon?: string;
    /** The icon already spells out the label (mood badges), so the text is dropped. */
    iconOnly?: boolean;
};

export type DistributionCounts = Map<string, { count: number; wins: number }>;

const trackDetailIcon = (fileName: string) => AssetLoader.getAssetUrl(`track_details/${fileName}.webp`);

export const SEASON_META: DistributionMeta[] = [
    { key: 'spring', label: 'Spring', color: '#f0679a', icon: trackDetailIcon('Spring') },
    { key: 'summer', label: 'Summer', color: '#4cc35a', icon: trackDetailIcon('Summer') },
    { key: 'fall', label: 'Fall', color: '#f08a4b', icon: trackDetailIcon('Fall') },
    { key: 'winter', label: 'Winter', color: '#5bb4f0', icon: trackDetailIcon('Winter') },
];

export const WEATHER_META: DistributionMeta[] = [
    { key: 'sunny', label: 'Sunny', color: '#f59a3c', icon: trackDetailIcon('Sunny') },
    { key: 'cloudy', label: 'Cloudy', color: '#9a86b0', icon: trackDetailIcon('Cloudy') },
    { key: 'rainy', label: 'Rainy', color: '#6a8ef0', icon: trackDetailIcon('Rainy') },
    { key: 'snowy', label: 'Snowy', color: '#3cc8d8', icon: trackDetailIcon('Snowy') },
];

/** Dry to wet. The game's ground icons are plain orange wordmarks, so no icons here. */
export const TRACK_CONDITION_META: DistributionMeta[] = [
    { key: 'firm', label: 'Firm', color: '#4ade80' },
    { key: 'good', label: 'Good', color: '#facc15' },
    { key: 'soft', label: 'Soft', color: '#fb923c' },
    { key: 'heavy', label: 'Heavy', color: '#f2555a' },
];

/** Great first: it is the slice the parfait toggle changes. */
export const MOOD_META: DistributionMeta[] = [5, 4, 3, 2, 1].map((mood) => ({
    key: String(mood),
    label: motivationLabels[mood] ?? String(mood),
    color: MOOD_COLORS[mood],
    icon: AssetLoader.getMotivationIcon(MOOD_ICON_KEYS[mood]),
    iconOnly: true,
}));

export const STANDARD_DISTANCE_META: DistributionMeta[] = [
    { key: 'standard', label: 'Standard', color: '#4d9fff' },
    { key: 'nonstandard', label: 'Non-Standard', color: '#a78bfa' },
];

export const TURN_META: DistributionMeta[] = [
    { key: 'right', label: 'Right', color: '#f2555a' },
    { key: 'left', label: 'Left', color: '#4d9fff' },
    { key: 'straight', label: 'Straight', color: '#fbbf24' },
];

export function standardDistanceKey(distanceMeters: number): 'standard' | 'nonstandard' {
    return isStandardDistance(distanceMeters) ? 'standard' : 'nonstandard';
}

export function distanceBarColor(distanceMeters: number): string {
    const key = standardDistanceKey(distanceMeters);
    return STANDARD_DISTANCE_META.find((meta) => meta.key === key)!.color;
}

/** trackDetails carries the raw race_start_params codes (season already folds Cherry Blossom into Spring). */
const SEASON_CODES: Record<string, string> = { 1: 'spring', 2: 'summer', 3: 'fall', 4: 'winter', 5: 'spring' };
const WEATHER_CODES: Record<string, string> = { 1: 'sunny', 2: 'cloudy', 3: 'rainy', 4: 'snowy' };
const GROUND_CODES: Record<string, string> = { 1: 'firm', 2: 'good', 3: 'soft', 4: 'heavy' };

function resolveKey(
    value: string | undefined,
    codes: Record<string, string>,
    meta: DistributionMeta[],
): string | null {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (codes[normalized]) return codes[normalized];
    return meta.some((entry) => entry.key === normalized) ? normalized : null;
}

export const resolveSeasonKey = (value?: string) => resolveKey(value, SEASON_CODES, SEASON_META);
export const resolveWeatherKey = (value?: string) => resolveKey(value, WEATHER_CODES, WEATHER_META);
export const resolveTrackConditionKey = (value?: string) => resolveKey(value, GROUND_CODES, TRACK_CONDITION_META);

const PARFAIT_ROSTER_SIZE = 15;
const GREAT_MOOD = 5;

/** A Team Trial where all 15 player umas went in at Great mood. */
export function isParfaitSession(session: TTSession): boolean {
    const umas = session.rounds.flatMap((round) => round.playerUmas);
    return umas.length >= PARFAIT_ROSTER_SIZE && umas.every((uma) => uma.motivation === GREAT_MOOD);
}

export function addToCounts(counts: DistributionCounts, key: string, won: boolean) {
    const entry = counts.get(key) ?? { count: 0, wins: 0 };
    entry.count += 1;
    if (won) entry.wins += 1;
    counts.set(key, entry);
}

/** One slice per meta entry, empty ones included, so ring segments keep their order across scopes. */
export function toSlices(meta: DistributionMeta[], counts: DistributionCounts): DistributionSlice[] {
    const total = meta.reduce((sum, { key }) => sum + (counts.get(key)?.count ?? 0), 0);
    return meta.map(({ key, label }) => {
        const entry = counts.get(key) ?? { count: 0, wins: 0 };
        return {
            key,
            label,
            count: entry.count,
            share: total > 0 ? entry.count / total : 0,
            winRate: entry.count > 0 ? entry.wins / entry.count : 0,
        };
    });
}
