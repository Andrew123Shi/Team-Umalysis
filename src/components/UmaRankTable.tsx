import { useEffect, useMemo, useState } from 'react';
import AssetLoader from '../data/AssetLoader';
import type { UmaComparisonEntry } from '../analytics/types';
import { formatScore } from '../utils/formatScore';
import { fallbackAccentColor, useImageAccentColors } from '../hooks/useImageAccentColors';
import { getUmaImageColorByCardId } from '../utils/umaImageColors';
import BarTable, { type BarColumn, type BarRow, type SortDir } from './charts/BarTable';

export type UmaRankRow = {
    entry: UmaComparisonEntry;
    countLabel: string;
    valueLabel: string;
    countSort: number;
    valueSort: number;
};

type ValueKey = 'count' | 'value';
type SortKey = 'charaName' | ValueKey;

type UmaRankTableProps = {
    title: string;
    info?: string;
    rows: UmaRankRow[];
    valueColumnLabel: string;
    defaultSortKey?: SortKey;
    defaultSortDir?: SortDir;
    collapsible?: boolean;
    onSelectUma?: (buildKey: string) => void;
};

function sortRows(rows: UmaRankRow[], sortKey: SortKey, sortDir: SortDir): UmaRankRow[] {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        if (sortKey === 'charaName') {
            return a.entry.charaName.localeCompare(b.entry.charaName) * dir;
        }
        const aVal = sortKey === 'count' ? a.countSort : a.valueSort;
        const bVal = sortKey === 'count' ? b.countSort : b.valueSort;
        if (aVal !== bVal) return (aVal - bVal) * dir;
        return a.entry.charaName.localeCompare(b.entry.charaName);
    });
}

export default function UmaRankTable({
    title,
    info,
    rows,
    valueColumnLabel,
    defaultSortKey = 'value',
    defaultSortDir = 'desc',
    onSelectUma,
}: UmaRankTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey);
    const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);

    useEffect(() => {
        setSortKey(defaultSortKey);
        setSortDir(defaultSortDir);
    }, [defaultSortKey, defaultSortDir, title]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir(key === defaultSortKey ? defaultSortDir : 'desc');
        }
    };

    const sorted = useMemo(
        () => sortRows(rows, sortKey, sortDir),
        [rows, sortKey, sortDir],
    );
    const visible = sorted;
    const colorSources = useMemo(
        () => visible.map((row) => ({
            key: row.entry.buildKey,
            url: AssetLoader.getRacewearIcon(row.entry.cardId),
        })),
        [visible],
    );
    const accentColors = useImageAccentColors(colorSources);
    const barValue = (row: UmaRankRow) => Math.max(0, sortKey === 'count' ? row.countSort : row.valueSort);
    const maxBarValue = Math.max(1, ...visible.map(barValue));

    const columns = useMemo<BarColumn<ValueKey>[]>(() => [
        { key: 'count', label: 'Count' },
        { key: 'value', label: valueColumnLabel },
    ], [valueColumnLabel]);

    const barRows: BarRow<ValueKey>[] = visible.map((row) => {
        const { entry } = row;
        return {
            key: entry.buildKey,
            label: entry.charaName,
            iconSrc: AssetLoader.getRacewearIcon(entry.cardId),
            iconClassName: 'is-uma',
            values: { count: row.countLabel, value: row.valueLabel },
            barPct: (barValue(row) / maxBarValue) * 100,
            barColor: getUmaImageColorByCardId(entry.cardId)
                ?? accentColors[entry.buildKey]
                ?? fallbackAccentColor(entry.cardId),
            onClick: onSelectUma ? () => onSelectUma(entry.buildKey) : undefined,
        };
    });

    return (
        <BarTable
            title={title}
            info={info}
            className="uma-rank-table"
            nameColumn={{ key: 'charaName', label: 'Uma' }}
            columns={columns}
            rows={barRows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
        />
    );
}

export function fmtPct(value: number) {
    return `${(value * 100).toFixed(1)}%`;
}

export function fmtWinRateRow(entry: UmaComparisonEntry): UmaRankRow {
    return {
        entry,
        countLabel: `${entry.wins}/${entry.appearances}`,
        valueLabel: fmtPct(entry.winRate),
        countSort: entry.wins,
        valueSort: entry.winRate,
    };
}

export function fmtNormScoreRow(entry: UmaComparisonEntry): UmaRankRow {
    return {
        entry,
        countLabel: `${entry.appearances}/${entry.appearances}`,
        valueLabel: formatScore(entry.avgNormalizedScore),
        countSort: entry.appearances,
        valueSort: entry.avgNormalizedScore,
    };
}

export function fmtWinMarginRow(entry: UmaComparisonEntry): UmaRankRow {
    const { scoreBreakdown: b } = entry;
    return {
        entry,
        countLabel: `${b.winMarginWinCount}/${b.raceCount}`,
        valueLabel: b.winMarginLengthCount > 0 ? `${b.avgWinMarginLengths.toFixed(2)} L` : '—',
        countSort: b.winMarginWinCount,
        valueSort: b.avgWinMarginLengths,
    };
}

export function fmtRateRow(
    entry: UmaComparisonEntry,
    rate: number,
): UmaRankRow {
    const count = Math.round(rate * entry.scoreBreakdown.raceCount);
    return {
        entry,
        countLabel: `${count}/${entry.scoreBreakdown.raceCount}`,
        valueLabel: fmtPct(rate),
        countSort: count,
        valueSort: rate,
    };
}

export function fmtAvgActivationRow(
    entry: UmaComparisonEntry,
    totalActivations: number,
    totalChances: number,
    avgPerRace: number,
): UmaRankRow {
    return {
        entry,
        countLabel: `${totalActivations}/${totalChances}`,
        valueLabel: avgPerRace.toFixed(2),
        countSort: totalActivations,
        valueSort: avgPerRace,
    };
}

export function sortEntries(
    entries: UmaComparisonEntry[],
    getValue: (entry: UmaComparisonEntry) => number,
    direction: 'asc' | 'desc',
): UmaComparisonEntry[] {
    const dir = direction === 'asc' ? 1 : -1;
    return [...entries].sort((a, b) => {
        const diff = getValue(a) - getValue(b);
        if (diff !== 0) return diff * dir;
        return a.charaName.localeCompare(b.charaName);
    });
}
