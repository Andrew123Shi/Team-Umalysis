import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import AssetLoader from '../data/AssetLoader';
import type { UmaComparisonEntry } from '../analytics/types';
import { formatScore } from '../utils/formatScore';
import { fallbackAccentColor, useImageAccentColors } from '../hooks/useImageAccentColors';
import { getUmaImageColorByCardId } from '../utils/umaImageColors';
import SectionHeading from './SectionHeading';

export type UmaRankRow = {
    entry: UmaComparisonEntry;
    countLabel: string;
    valueLabel: string;
    countSort: number;
    valueSort: number;
};

type SortKey = 'charaName' | 'count' | 'value';
type SortDir = 'asc' | 'desc';

type UmaRankTableProps = {
    title: string;
    rows: UmaRankRow[];
    valueColumnLabel: string;
    defaultSortKey?: SortKey;
    defaultSortDir?: SortDir;
    collapsible?: boolean;
    onSelectUma?: (buildKey: string) => void;
};

function SortButton({
    label,
    sortKey,
    activeKey,
    sortDir,
    onSort,
}: {
    label: string;
    sortKey: SortKey;
    activeKey: SortKey;
    sortDir: SortDir;
    onSort: (key: SortKey) => void;
}) {
    const active = activeKey === sortKey;
    const arrow = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className={`bar-sort-button${active ? ' is-active' : ''}`}
        >
            {label}{arrow}
        </button>
    );
}

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
    const maxBarValue = Math.max(
        1,
        ...visible.map((row) => {
            if (sortKey === 'count') return Math.max(0, row.countSort);
            if (sortKey === 'value') return Math.max(0, row.valueSort);
            return Math.max(0, row.valueSort);
        }),
    );
    const barValue = (row: UmaRankRow) => {
        if (sortKey === 'count') return Math.max(0, row.countSort);
        if (sortKey === 'value') return Math.max(0, row.valueSort);
        return Math.max(0, row.valueSort);
    };

    return (
        <div className="uma-rank-table app-card p-3 mb-4">
            <div className="bar-table-toolbar">
                <SectionHeading title={title} compact />
                <div className="bar-sort-controls">
                    <SortButton label="Uma" sortKey="charaName" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortButton label="Count" sortKey="count" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortButton label={valueColumnLabel} sortKey="value" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                </div>
            </div>
            <div className="bar-list bar-list-scroll">
                {visible.length === 0 && <div className="bar-empty">No data</div>}
                {visible.map((row) => {
                    const { entry, countLabel, valueLabel } = row;
                    const width = Math.max(4, Math.min(100, (barValue(row) / maxBarValue) * 100));
                    const barColor = getUmaImageColorByCardId(entry.cardId)
                        ?? accentColors[entry.buildKey]
                        ?? fallbackAccentColor(entry.cardId);
                    const rowContent = (
                        <>
                            <span
                                className="bar-row-fill"
                                style={{ '--bar-width': `${width}%`, '--bar-color': barColor } as CSSProperties}
                            />
                            <span className="bar-row-content">
                                <span className="bar-row-label">
                                    <img
                                        src={AssetLoader.getRacewearIcon(entry.cardId)}
                                        alt=""
                                        className="bar-row-icon uma-rank-icon"
                                    />
                                    <span className="bar-row-label-text">{entry.charaName}</span>
                                </span>
                                <span className="bar-row-values">
                                    <span className={`bar-chip${sortKey === 'count' ? ' is-active' : ''}`}>{countLabel}</span>
                                    <span className={`bar-chip${sortKey === 'value' ? ' is-active' : ''}`}>{valueLabel}</span>
                                </span>
                            </span>
                        </>
                    );

                    return onSelectUma ? (
                        <button
                            key={entry.buildKey}
                            type="button"
                            className="bar-row is-clickable"
                            onClick={() => onSelectUma(entry.buildKey)}
                        >
                            {rowContent}
                        </button>
                    ) : (
                        <div key={entry.buildKey} className="bar-row">
                            {rowContent}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function fmtPct(value: number) {
    return `${(value * 100).toFixed(1)}%`;
}

export function fmtWinRateRow(entry: UmaComparisonEntry): UmaRankRow {
    return {
        entry,
        countLabel: `${entry.wins} / ${entry.appearances}`,
        valueLabel: fmtPct(entry.winRate),
        countSort: entry.wins,
        valueSort: entry.winRate,
    };
}

export function fmtNormScoreRow(entry: UmaComparisonEntry): UmaRankRow {
    return {
        entry,
        countLabel: `${entry.appearances} / ${entry.appearances}`,
        valueLabel: formatScore(entry.avgNormalizedScore),
        countSort: entry.appearances,
        valueSort: entry.avgNormalizedScore,
    };
}

export function fmtWinMarginRow(entry: UmaComparisonEntry): UmaRankRow {
    const { scoreBreakdown: b } = entry;
    return {
        entry,
        countLabel: `${b.winMarginWinCount} / ${b.raceCount}`,
        valueLabel: b.winMarginWinCount > 0 ? `${b.avgWinMarginLengths.toFixed(2)} L` : '—',
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
        countLabel: `${count} / ${entry.scoreBreakdown.raceCount}`,
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
        countLabel: `${totalActivations} / ${totalChances}`,
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
