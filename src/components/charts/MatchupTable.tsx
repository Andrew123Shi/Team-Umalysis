import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import AssetLoader from '../../data/AssetLoader';
import type { MatchupEntry, TrackMatchupEntry } from '../../analytics/types';
import { formatScore } from '../../utils/formatScore';
import { UmaDisplayName } from '../../utils/umaDisplayName';
import { fallbackAccentColor, useImageAccentColors } from '../../hooks/useImageAccentColors';
import { getUmaImageColorByCardId } from '../../utils/umaImageColors';
import { AnimatedText } from '../AnimatedNumber';
import SectionHeading from '../SectionHeading';

type OccurrenceFilter = 'all' | 'gt1' | 'gt5' | 'gt10';
type SortKey = 'displayName' | 'appearances' | 'avgPlacement' | 'winRate' | 'occurrenceRate' | 'avgNormalizedScore';
type SortDir = 'asc' | 'desc';
type MatchupVariant = 'uma' | 'track';

type MatchupRow = {
    key: string;
    displayName: string;
    charaName?: string;
    appearances: number;
    avgPlacement: number;
    winRate: number;
    occurrenceRate: number;
    avgNormalizedScore?: number;
    cardId?: number;
};

const TRACK_HUES: Record<string, number> = {
    tokyo: 210,
    nakayama: 35,
    hanshin: 140,
    kyoto: 275,
    chukyo: 185,
    sapporo: 25,
    hakodate: 165,
    niigata: 300,
    kokura: 335,
    ooi: 20,
    longchamp: 260,
};

function trackBarColor(displayName: string): string {
    const lower = displayName.toLowerCase();
    const location = Object.keys(TRACK_HUES).find((key) => lower.includes(key));
    const hue = location ? TRACK_HUES[location] : fallbackHue(displayName);
    const distance = Number(lower.match(/(\d{3,4})\s*m/)?.[1] ?? lower.match(/(\d{3,4})/)?.[1] ?? 1800);
    const clampedDistance = Math.max(1000, Math.min(3600, distance));
    const distanceRatio = (clampedDistance - 1000) / 2600;
    const lightness = Math.round(66 - distanceRatio * 22);
    return `hsl(${hue} 72% ${lightness}%)`;
}

function fallbackHue(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash % 360;
}

function toRows(
    entries: MatchupEntry[] | TrackMatchupEntry[],
    variant: MatchupVariant,
): MatchupRow[] {
    if (variant === 'track') {
        return (entries as TrackMatchupEntry[]).map((e) => ({
            key: `track-${e.courseId}`,
            displayName: e.displayName,
            appearances: e.appearances,
            avgPlacement: e.avgPlacement,
            winRate: e.winRate,
            occurrenceRate: e.occurrenceRate,
            avgNormalizedScore: e.avgNormalizedScore,
        }));
    }
    return (entries as MatchupEntry[]).map((e) => ({
        key: `${e.charaId}-${e.cardId}`,
        displayName: e.displayName,
        charaName: e.charaName,
        appearances: e.appearances,
        avgPlacement: e.avgPlacement,
        winRate: e.winRate,
        occurrenceRate: e.occurrenceRate,
        avgNormalizedScore: e.avgNormalizedScore,
        cardId: e.cardId,
    }));
}

function filterByOccurrence(entries: MatchupRow[], filter: OccurrenceFilter): MatchupRow[] {
    if (filter === 'gt1') return entries.filter((e) => e.occurrenceRate > 0.01);
    if (filter === 'gt5') return entries.filter((e) => e.occurrenceRate > 0.05);
    if (filter === 'gt10') return entries.filter((e) => e.occurrenceRate > 0.10);
    return entries;
}

function sortEntries(entries: MatchupRow[], sortKey: SortKey, sortDir: SortDir): MatchupRow[] {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...entries].sort((a, b) => {
        if (sortKey === 'displayName') return a.displayName.localeCompare(b.displayName) * dir;
        const aVal = a[sortKey] ?? 0;
        const bVal = b[sortKey] ?? 0;
        return (aVal - bVal) * dir;
    });
}

function SortButton({
    label,
    sortKey,
    activeKey,
    sortDir,
    onSort,
    title,
}: {
    label: string;
    sortKey: SortKey;
    activeKey: SortKey;
    sortDir: SortDir;
    onSort: (key: SortKey) => void;
    title?: string;
}) {
    const active = activeKey === sortKey;
    const arrow = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className={`bar-sort-button${active ? ' is-active' : ''}`}
            title={title}
        >
            {label}{arrow}
        </button>
    );
}

function MatchupRows({
    entries,
    title,
    variant = 'uma',
    nameColumnLabel,
    defaultSortKey = 'winRate',
    defaultSortDir = 'desc',
    defaultOccurrenceFilter = 'gt1',
    compactColumns = false,
    showNormalizedScore = false,
    scoreColumnLabel,
    showOccurrenceFilter = variant !== 'track',
}: {
    entries: MatchupEntry[] | TrackMatchupEntry[];
    title: string;
    variant?: MatchupVariant;
    nameColumnLabel?: string;
    defaultSortKey?: SortKey;
    defaultSortDir?: SortDir;
    defaultOccurrenceFilter?: OccurrenceFilter;
    compactColumns?: boolean;
    showNormalizedScore?: boolean;
    scoreColumnLabel?: string;
    showOccurrenceFilter?: boolean;
}) {
    const resolvedOccurrenceFilter: OccurrenceFilter = showOccurrenceFilter
        ? defaultOccurrenceFilter
        : 'all';
    const [occurrenceFilter, setOccurrenceFilter] = useState<OccurrenceFilter>(resolvedOccurrenceFilter);
    const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey);
    const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
    const rows = useMemo(() => toRows(entries, variant), [entries, variant]);
    const label = nameColumnLabel ?? (variant === 'track' ? 'Racetrack' : 'Uma');
    const instancesLabel = compactColumns ? 'Inst' : 'Instances';
    const avgPlacementLabel = compactColumns ? 'Avg Pos' : 'Avg. Position';
    const winRateLabel = compactColumns ? 'WR' : 'Win Rate';
    const avgNormScoreLabel = scoreColumnLabel ?? (compactColumns ? 'Avg Scr' : 'Average Score');

    useEffect(() => {
        setSortKey(defaultSortKey);
        setSortDir(defaultSortDir);
    }, [defaultSortKey, defaultSortDir, title]);

    useEffect(() => {
        setOccurrenceFilter(resolvedOccurrenceFilter);
    }, [resolvedOccurrenceFilter, title]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir(key === defaultSortKey ? defaultSortDir : 'desc');
        }
    };

    const filtered = useMemo(
        () => filterByOccurrence(rows, occurrenceFilter),
        [rows, occurrenceFilter],
    );
    const sorted = useMemo(
        () => sortEntries(filtered, sortKey, sortDir),
        [filtered, sortKey, sortDir],
    );
    const visible = sorted;
    const colorSources = useMemo(
        () => visible
            .filter((row) => row.cardId != null && row.cardId > 0)
            .map((row) => ({
                key: row.key,
                url: AssetLoader.getCharaThumb(row.cardId!),
            })),
        [visible],
    );
    const accentColors = useImageAccentColors(colorSources);
    const showScoreColumn = variant === 'track' || showNormalizedScore;
    const metricValue = (row: MatchupRow) => {
        if (sortKey === 'appearances') return Math.max(0, row.appearances);
        if (sortKey === 'avgPlacement') return Math.max(0, row.avgPlacement);
        if (sortKey === 'winRate') return Math.max(0, row.winRate);
        if (sortKey === 'occurrenceRate') return Math.max(0, row.occurrenceRate);
        if (sortKey === 'avgNormalizedScore') return Math.max(0, row.avgNormalizedScore ?? 0);
        return Math.max(0, row.winRate);
    };
    const metricIsRate = sortKey === 'winRate' || sortKey === 'occurrenceRate' || sortKey === 'displayName';
    const maxBarValue = Math.max(metricIsRate ? 1 : 0.0001, ...visible.map(metricValue));

    return (
        <div className="app-card p-3 mb-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1">
                <SectionHeading title={title} compact />
                {showOccurrenceFilter && (
                    <ButtonGroup size="sm" className="ms-auto flex-shrink-0">
                        <Button
                            variant={occurrenceFilter === 'all' ? 'secondary' : 'outline-secondary'}
                            onClick={() => setOccurrenceFilter('all')}
                        >
                            All
                        </Button>
                        <Button
                            variant={occurrenceFilter === 'gt1' ? 'secondary' : 'outline-secondary'}
                            onClick={() => setOccurrenceFilter('gt1')}
                        >
                            &gt;1%
                        </Button>
                        <Button
                            variant={occurrenceFilter === 'gt5' ? 'secondary' : 'outline-secondary'}
                            onClick={() => setOccurrenceFilter('gt5')}
                        >
                            &gt;5%
                        </Button>
                        <Button
                            variant={occurrenceFilter === 'gt10' ? 'secondary' : 'outline-secondary'}
                            onClick={() => setOccurrenceFilter('gt10')}
                        >
                            &gt;10%
                        </Button>
                    </ButtonGroup>
                )}
            </div>
            <div className="bar-table-toolbar">
                <div className="bar-sort-controls">
                    <SortButton label={label} sortKey="displayName" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortButton label={instancesLabel} sortKey="appearances" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} title={compactColumns ? 'Instances' : undefined} />
                    <SortButton label={avgPlacementLabel} sortKey="avgPlacement" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} title={compactColumns ? 'Avg. Position' : undefined} />
                    <SortButton label={winRateLabel} sortKey="winRate" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} title={compactColumns ? 'Win Rate' : undefined} />
                    {showScoreColumn && (
                        <SortButton
                            label={avgNormScoreLabel}
                            sortKey="avgNormalizedScore"
                            activeKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                            title={compactColumns ? (scoreColumnLabel ?? 'Average Score') : undefined}
                        />
                    )}
                </div>
            </div>
            <div className="bar-list bar-list-scroll">
                {visible.length === 0 && <div className="bar-empty">Not enough data</div>}
                {visible.map((e) => {
                    const width = Math.max(4, Math.min(100, (metricValue(e) / maxBarValue) * 100));
                    const barColor = variant === 'track'
                        ? trackBarColor(e.displayName)
                        : (e.cardId ? getUmaImageColorByCardId(e.cardId) : undefined)
                            ?? accentColors[e.key]
                            ?? fallbackAccentColor(e.cardId ?? e.displayName);
                    return (
                        <div key={e.key} className="bar-row">
                            <span
                                className="bar-row-fill"
                                style={{ '--bar-width': `${width}%`, '--bar-color': barColor } as CSSProperties}
                            />
                            <span className="bar-row-content">
                                <span className="bar-row-label">
                                    {e.cardId != null && e.cardId > 0 && (
                                        <img
                                            src={AssetLoader.getCharaThumb(e.cardId)}
                                            alt=""
                                            className="bar-row-icon"
                                        />
                                    )}
                                    <span className="bar-row-label-text">
                                        {e.cardId != null && e.cardId > 0 && e.charaName ? (
                                            <UmaDisplayName charaName={e.charaName} cardId={e.cardId} />
                                        ) : e.displayName}
                                    </span>
                                </span>
                                <span className="bar-row-values">
                                    <span className={`bar-chip${sortKey === 'appearances' ? ' is-active' : ''}`}><AnimatedText text={`${e.appearances} Instances`} /></span>
                                    <span className={`bar-chip${sortKey === 'avgPlacement' ? ' is-active' : ''}`}><AnimatedText text={e.avgPlacement.toFixed(2)} /></span>
                                    <span className={`bar-chip${sortKey === 'winRate' ? ' is-active' : ''}`}><AnimatedText text={`${(e.winRate * 100).toFixed(1)}%`} /></span>
                                    {showScoreColumn && (
                                        <span className={`bar-chip${sortKey === 'avgNormalizedScore' ? ' is-active' : ''}`}><AnimatedText text={formatScore(e.avgNormalizedScore ?? 0)} /></span>
                                    )}
                                </span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function MatchupTable({
    entries,
    title,
    variant = 'uma',
    nameColumnLabel,
    defaultSortKey = 'winRate',
    defaultSortDir = 'desc',
    defaultOccurrenceFilter = 'gt1',
    compactColumns = false,
    showNormalizedScore = false,
    scoreColumnLabel,
    showOccurrenceFilter,
}: {
    entries: MatchupEntry[] | TrackMatchupEntry[];
    title: string;
    variant?: MatchupVariant;
    nameColumnLabel?: string;
    defaultSortKey?: SortKey;
    defaultSortDir?: SortDir;
    defaultOccurrenceFilter?: OccurrenceFilter;
    compactColumns?: boolean;
    showNormalizedScore?: boolean;
    scoreColumnLabel?: string;
    showOccurrenceFilter?: boolean;
}) {
    return (
        <MatchupRows
            entries={entries}
            title={title}
            variant={variant}
            nameColumnLabel={nameColumnLabel}
            defaultSortKey={defaultSortKey}
            defaultSortDir={defaultSortDir}
            defaultOccurrenceFilter={defaultOccurrenceFilter}
            compactColumns={compactColumns}
            showNormalizedScore={showNormalizedScore}
            scoreColumnLabel={scoreColumnLabel}
            showOccurrenceFilter={showOccurrenceFilter}
        />
    );
}
