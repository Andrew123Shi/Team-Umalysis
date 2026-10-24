import { memo, useEffect, useMemo, useState } from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';
import AssetLoader from '../../data/AssetLoader';
import type { MatchupEntry, TrackMatchupEntry } from '../../analytics/types';
import { formatScore } from '../../utils/formatScore';
import { UmaDisplayName } from '../../utils/umaDisplayName';
import { fallbackAccentColor, useImageAccentColors } from '../../hooks/useImageAccentColors';
import { getUmaImageColorByCardId } from '../../utils/umaImageColors';
import BarTable, { type BarColumn, type BarRow, type SortDir } from './BarTable';

type OccurrenceFilter = 'all' | 'gt1' | 'gt5' | 'gt10';
type ValueKey = 'appearances' | 'avgPlacement' | 'winRate' | 'avgNormalizedScore';
type SortKey = 'displayName' | ValueKey;
type MatchupVariant = 'uma' | 'track';

const OCCURRENCE_FILTERS: { key: OccurrenceFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'gt1', label: '>1%' },
    { key: 'gt5', label: '>5%' },
    { key: 'gt10', label: '>10%' },
];

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

function sortEntries(entries: MatchupRow[], sortKey: SortKey, sortDir: SortDir, hideOutfitName = false): MatchupRow[] {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...entries].sort((a, b) => {
        if (sortKey === 'displayName') {
            const aName = hideOutfitName ? (a.charaName ?? a.displayName) : a.displayName;
            const bName = hideOutfitName ? (b.charaName ?? b.displayName) : b.displayName;
            return aName.localeCompare(bName) * dir;
        }
        const aVal = a[sortKey] ?? 0;
        const bVal = b[sortKey] ?? 0;
        return (aVal - bVal) * dir;
    });
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
    hideOutfitName = false,
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
    hideOutfitName?: boolean;
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
    const instancesLabel = compactColumns ? 'N' : 'Instances';
    const avgPlacementLabel = compactColumns ? 'Pos' : 'Avg Pos';
    const winRateLabel = compactColumns ? 'WR' : 'Win %';
    const avgNormScoreLabel = scoreColumnLabel ?? (compactColumns ? 'Score' : 'Avg Score');

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
        () => sortEntries(filtered, sortKey, sortDir, hideOutfitName),
        [filtered, sortKey, sortDir, hideOutfitName],
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
        if (sortKey === 'avgNormalizedScore') return Math.max(0, row.avgNormalizedScore ?? 0);
        return Math.max(0, row.winRate);
    };
    const metricIsRate = sortKey === 'winRate' || sortKey === 'displayName';
    const maxBarValue = Math.max(metricIsRate ? 1 : 0.0001, ...visible.map(metricValue));

    const columns = useMemo(() => {
        const list: BarColumn<ValueKey>[] = [
            { key: 'appearances', label: instancesLabel, title: 'Instances' },
            { key: 'avgPlacement', label: avgPlacementLabel, title: 'Average Finishing Position' },
            { key: 'winRate', label: winRateLabel, title: 'Win Rate' },
        ];
        if (showScoreColumn) {
            list.push({ key: 'avgNormalizedScore', label: avgNormScoreLabel, title: scoreColumnLabel ?? 'Average Score' });
        }
        return list;
    }, [instancesLabel, avgPlacementLabel, winRateLabel, showScoreColumn, avgNormScoreLabel, scoreColumnLabel]);

    const barRows: BarRow<ValueKey>[] = visible.map((e) => {
        const hasCard = e.cardId != null && e.cardId > 0;
        return {
            key: e.key,
            label: hasCard && e.charaName
                ? <UmaDisplayName charaName={e.charaName} cardId={e.cardId!} hideCardName={hideOutfitName} />
                : e.displayName,
            iconSrc: hasCard ? AssetLoader.getCharaThumb(e.cardId!) : undefined,
            iconClassName: hasCard ? 'is-uma' : undefined,
            values: {
                appearances: `${e.appearances}x`,
                avgPlacement: e.avgPlacement.toFixed(2),
                winRate: `${(e.winRate * 100).toFixed(1)}%`,
                avgNormalizedScore: formatScore(e.avgNormalizedScore ?? 0),
            },
            barPct: (metricValue(e) / maxBarValue) * 100,
            barColor: variant === 'track'
                ? trackBarColor(e.displayName)
                : (e.cardId ? getUmaImageColorByCardId(e.cardId) : undefined)
                    ?? accentColors[e.key]
                    ?? fallbackAccentColor(e.cardId ?? e.displayName),
        };
    });

    return (
        <BarTable
            title={title}
            actions={showOccurrenceFilter ? (
                <ButtonGroup size="sm" aria-label="Minimum occurrence">
                    {OCCURRENCE_FILTERS.map((filter) => (
                        <Button
                            key={filter.key}
                            variant={occurrenceFilter === filter.key ? 'secondary' : 'outline-secondary'}
                            onClick={() => setOccurrenceFilter(filter.key)}
                        >
                            {filter.label}
                        </Button>
                    ))}
                </ButtonGroup>
            ) : undefined}
            nameColumn={{ key: 'displayName', label }}
            columns={columns}
            rows={barRows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            emptyText="Not enough data"
        />
    );
}

function MatchupTable({
    entries,
    title,
    variant = 'uma',
    nameColumnLabel,
    defaultSortKey = 'winRate',
    defaultSortDir = 'desc',
    defaultOccurrenceFilter = 'gt1',
    compactColumns = false,
    hideOutfitName = false,
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
    hideOutfitName?: boolean;
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
            hideOutfitName={hideOutfitName}
            showNormalizedScore={showNormalizedScore}
            scoreColumnLabel={scoreColumnLabel}
            showOccurrenceFilter={showOccurrenceFilter}
        />
    );
}

export default memo(MatchupTable);
