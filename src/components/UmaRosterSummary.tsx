import { Card } from 'react-bootstrap';
import { STYLE_SATURATION_COLORS } from '../analytics/styleSaturation';
import type { RosterUmaSlot } from '../analytics/types';
import { DISTANCE_LABELS, DISTANCE_ORDER } from '../analytics/types';
import AssetLoader from '../data/AssetLoader';
import UMDatabaseWrapper from '../data/UMDatabaseWrapper';
import CareerRatingBadge from './CareerRatingBadge';
import SectionHeading from './SectionHeading';
import { formatScore } from '../utils/formatScore';

const STYLE_SHORT_LABELS: Record<number, string> = {
    1: 'Front',
    2: 'Pace',
    3: 'Late',
    4: 'End',
    5: 'Front',
};

const ROSTER_STAT_ITEMS = [
    { key: 'speed' as const, icon: 'speed', alt: 'SPD' },
    { key: 'stamina' as const, icon: 'stamina', alt: 'STA' },
    { key: 'pow' as const, icon: 'power', alt: 'POW' },
    { key: 'guts' as const, icon: 'guts', alt: 'GUT' },
    { key: 'wiz' as const, icon: 'wit', alt: 'WIZ' },
] as const;

function fmtPct(v: number) {
    return `${(v * 100).toFixed(1)}%`;
}

function fmtNum(v: number, digits = 1) {
    return v.toFixed(digits);
}

function StarDisplay({ count }: { count: number }) {
    if (count <= 0) return null;
    const filled = Math.min(count, 5);
    return (
        <span className="uma-roster-sm-stars" aria-label={`${filled} stars`}>
            {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < filled ? 'uma-roster-sm-star is-filled' : 'uma-roster-sm-star'}>
                    ★
                </span>
            ))}
        </span>
    );
}

function UmaRosterStatsBar({
    stats,
    totalSkillPoints,
}: {
    stats: RosterUmaSlot['stats'];
    totalSkillPoints: number;
}) {
    return (
        <div className="uma-roster-sm-stats">
            {ROSTER_STAT_ITEMS.map(({ key, icon, alt }) => (
                <div key={key} className="uma-roster-sm-stat">
                    <img src={AssetLoader.getStatIcon(icon)} alt={alt} className="uma-roster-sm-stat-icon" />
                    <span className="uma-roster-sm-stat-value">{stats[key]}</span>
                </div>
            ))}
            <div className="uma-roster-sm-stat">
                <img src={AssetLoader.getStatIcon('hint')} alt="Skill" className="uma-roster-sm-stat-icon" />
                <span className="uma-roster-sm-stat-value">{totalSkillPoints}</span>
            </div>
        </div>
    );
}

function UmaRosterMetrics({ uma }: { uma: RosterUmaSlot }) {
    const { placement, score } = uma;

    if (placement.count === 0) {
        return <div className="uma-roster-metrics-empty text-muted">No race data</div>;
    }

    return (
        <div className="uma-roster-metrics">
            <div className="uma-roster-metrics-primary-row">
                <div className="uma-roster-metric uma-roster-metric--primary">
                    <span className="uma-roster-metric-label">Win Rate</span>
                    <span className="uma-roster-metric-value">{fmtPct(uma.winRate)}</span>
                </div>
                <div className="uma-roster-metric uma-roster-metric--primary">
                    <span className="uma-roster-metric-label">Avg Score</span>
                    <span className="uma-roster-metric-value">{formatScore(score.avg)}</span>
                </div>
                <div className="uma-roster-metric uma-roster-metric--primary">
                    <span className="uma-roster-metric-label">Races Run</span>
                    <span className="uma-roster-metric-value">{placement.count}</span>
                </div>
            </div>
            <div className="uma-roster-metrics-grid">
                <div className="uma-roster-metric">
                    <span className="uma-roster-metric-label">Avg Pos</span>
                    <span className="uma-roster-metric-value">{fmtNum(placement.avg)}</span>
                </div>
                <div className="uma-roster-metric">
                    <span className="uma-roster-metric-label">Med Pos</span>
                    <span className="uma-roster-metric-value">{fmtNum(placement.median)}</span>
                </div>
                <div className="uma-roster-metric">
                    <span className="uma-roster-metric-label">Max Pos</span>
                    <span className="uma-roster-metric-value">{fmtNum(placement.max, 0)}</span>
                </div>
            </div>
            <div className="uma-roster-metrics-grid">
                <div className="uma-roster-metric">
                    <span className="uma-roster-metric-label">Med Score</span>
                    <span className="uma-roster-metric-value">{formatScore(score.median)}</span>
                </div>
                <div className="uma-roster-metric">
                    <span className="uma-roster-metric-label">Min Score</span>
                    <span className="uma-roster-metric-value">{formatScore(score.min)}</span>
                </div>
                <div className="uma-roster-metric">
                    <span className="uma-roster-metric-label">Max Score</span>
                    <span className="uma-roster-metric-value">{formatScore(score.max)}</span>
                </div>
            </div>
        </div>
    );
}

function UmaRosterCard({
    uma,
    onSelect,
}: {
    uma: RosterUmaSlot;
    onSelect?: (buildKey: string) => void;
}) {
    const outfitName = UMDatabaseWrapper.cards[uma.cardId]?.name;
    const styleLabel = STYLE_SHORT_LABELS[uma.runningStyle] ?? 'Pace';
    const styleColor = STYLE_SATURATION_COLORS[uma.runningStyle] ?? STYLE_SATURATION_COLORS[2];
    return (
        <Card
            className="app-card h-100 uma-roster-card uma-roster-member"
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={onSelect ? () => onSelect(uma.buildKey) : undefined}
            onKeyDown={onSelect ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(uma.buildKey);
                }
            } : undefined}
        >
            <Card.Body className="uma-roster-member-body">
                <div className="uma-roster-sm-header">
                    <img
                        src={AssetLoader.getRacewearIcon(uma.cardId)}
                        alt=""
                        className="uma-roster-sm-avatar"
                    />
                    <div className="uma-roster-sm-info">
                        <div className="uma-roster-sm-name">
                            {outfitName && (
                                <div className="uma-roster-sm-outfit text-truncate">{outfitName}</div>
                            )}
                            <div className="uma-roster-sm-chara-line">
                                <span className="uma-roster-sm-chara text-truncate">{uma.charaName}</span>
                                <StarDisplay count={uma.starCount} />
                            </div>
                        </div>
                        <div className="uma-roster-sm-tags">
                            <span
                                className="uma-roster-sm-tag style"
                                style={{
                                    color: styleColor,
                                    background: `color-mix(in srgb, ${styleColor} 18%, transparent)`,
                                }}
                            >
                                {styleLabel}
                            </span>
                        </div>
                    </div>
                    <div className="uma-roster-sm-rank-block">
                        <CareerRatingBadge score={uma.rankScore} size={48} />
                        <span className="uma-roster-sm-score-value">{formatScore(uma.rankScore)}</span>
                    </div>
                </div>
                <UmaRosterStatsBar stats={uma.stats} totalSkillPoints={uma.totalSkillPoints} />
                <UmaRosterMetrics uma={uma} />
            </Card.Body>
        </Card>
    );
}

export default function UmaRosterSummary({
    rosterGrid,
    onSelectUma,
}: {
    rosterGrid: (RosterUmaSlot | null)[][];
    onSelectUma?: (buildKey: string) => void;
}) {
    const rowCount = 3;

    return (
        <div className="uma-roster-grid row g-2 mb-3">
            {DISTANCE_ORDER.map((distanceType, colIdx) => {
                const column = rosterGrid[colIdx] ?? [];
                return (
                    <div key={distanceType} className="col uma-roster-col">
                        <div className="uma-roster-distance-panel app-card h-100">
                            <SectionHeading
                                level="panel"
                                title={DISTANCE_LABELS[distanceType]}
                                compact
                                className="uma-roster-distance-header mt-0"
                            />
                            <div className="uma-roster-distance-slots">
                                {Array.from({ length: rowCount }, (_, rowIdx) => {
                                    const uma = column[rowIdx];
                                    return uma
                                        ? <UmaRosterCard key={rowIdx} uma={uma} onSelect={onSelectUma} />
                                        : <div key={rowIdx} className="uma-roster-empty" />;
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
