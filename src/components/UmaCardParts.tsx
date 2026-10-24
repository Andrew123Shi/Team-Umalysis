import type { CSSProperties } from 'react';
import { STYLE_SATURATION_COLORS } from '../analytics/styleSaturation';
import type { UmaEntry } from '../analytics/types';
import AssetLoader from '../data/AssetLoader';
import UMDatabaseWrapper from '../data/UMDatabaseWrapper';
import { formatScore } from '../utils/formatScore';
import CareerRatingBadge from './CareerRatingBadge';

const STYLE_SHORT_LABELS: Record<number, string> = {
    1: 'Front',
    2: 'Pace',
    3: 'Late',
    4: 'End',
    5: 'Runaway',
};

const STAT_ITEMS = [
    { key: 'speed' as const, icon: 'speed', alt: 'Speed', color: '#23abff' },
    { key: 'stamina' as const, icon: 'stamina', alt: 'Stamina', color: '#ff6c58' },
    { key: 'pow' as const, icon: 'power', alt: 'Power', color: '#ff9919' },
    { key: 'guts' as const, icon: 'guts', alt: 'Guts', color: '#ff67a2' },
    { key: 'wiz' as const, icon: 'wit', alt: 'Wit', color: '#07c282' },
] as const;

/** Stat bars fill against this value; higher stats clamp to a full bar. */
const STAT_BAR_MAX = 1600;
/** In-game threshold above which stats count as special (drawn as a distinct bar segment). */
const STAT_SPECIAL_MIN = 1200;

export function StarDisplay({ count }: { count: number }) {
    if (count <= 0) return null;
    const filled = Math.min(count, 5);
    return (
        <span className="uma-stars" aria-label={`${filled} stars`}>
            {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < filled ? 'is-filled' : undefined}>★</span>
            ))}
        </span>
    );
}

export function StyleTag({ runningStyle }: { runningStyle: number }) {
    const label = STYLE_SHORT_LABELS[runningStyle] ?? 'Pace';
    const color = STYLE_SATURATION_COLORS[runningStyle] ?? STYLE_SATURATION_COLORS[2];
    return (
        <span className="uma-style-tag" style={{ '--tag-color': color } as CSSProperties}>
            {label}
        </span>
    );
}

/** Avatar, outfit + name, stars, style tag and the career rating badge. */
export function UmaIdentity({
    cardId,
    charaName,
    rankScore,
    starCount,
    runningStyle,
    badgeSize = 44,
    size = 'md',
}: {
    cardId: number;
    charaName: string;
    rankScore: number;
    starCount?: number;
    runningStyle?: number;
    badgeSize?: number;
    size?: 'md' | 'lg';
}) {
    const outfitName = UMDatabaseWrapper.cards[cardId]?.name;
    return (
        <div className={`uma-identity is-${size}`}>
            <img src={AssetLoader.getRacewearIcon(cardId)} alt="" className="uma-identity-avatar" />
            <div className="uma-identity-text">
                <div className="uma-identity-outfit">{outfitName}</div>
                <div className="uma-identity-name">{charaName}</div>
                {starCount !== undefined && <StarDisplay count={starCount} />}
                {runningStyle !== undefined && <StyleTag runningStyle={runningStyle} />}
            </div>
            <div className="uma-identity-rank">
                <CareerRatingBadge score={rankScore} size={badgeSize} />
                <span className="uma-identity-rank-value">{formatScore(rankScore)}</span>
            </div>
        </div>
    );
}

/** In-game stat icons with values and a fill bar per stat, plus total skill points. */
export function StatStrip({
    stats,
    totalSkillPoints,
    compact = false,
}: {
    stats: UmaEntry['stats'];
    totalSkillPoints?: number;
    /** Numbers only (no meters), with skill points on the same row. */
    compact?: boolean;
}) {
    return (
        <div className={`stat-strip${compact ? ' is-compact' : ''}`}>
            {STAT_ITEMS.map(({ key, icon, alt, color }) => (
                <div
                    key={key}
                    className="stat-strip-item"
                    style={{
                        '--stat-color': color,
                        '--stat-pct': `${Math.min(100, (stats[key] / STAT_BAR_MAX) * 100)}%`,
                        '--stat-cap': `${(STAT_SPECIAL_MIN / STAT_BAR_MAX) * 100}%`,
                    } as CSSProperties}
                >
                    <img src={AssetLoader.getStatIcon(icon)} alt={alt} className="stat-strip-icon" />
                    <span className="stat-strip-value">{stats[key]}</span>
                    {!compact && (
                        <span
                            className={`stat-strip-bar${stats[key] > STAT_SPECIAL_MIN ? ' is-over' : ''}`}
                            aria-hidden="true"
                        />
                    )}
                </div>
            ))}
            {totalSkillPoints !== undefined && (
                <div className="stat-strip-item is-skill">
                    <img src={AssetLoader.getStatIcon('hint')} alt="Skill points" className="stat-strip-icon" />
                    <span className="stat-strip-value">{totalSkillPoints}</span>
                </div>
            )}
        </div>
    );
}
