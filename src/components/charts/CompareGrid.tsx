import type { CSSProperties, ReactNode } from 'react';
import { AnimatedText } from '../AnimatedNumber';
import { useHoverTip, type TipContent } from '../HoverTip';
import RangeTrack from './RangeTrack';

export type CompareStripSegment = { label: string; value: number; color: string };

export type CompareColumn = {
    key: string;
    title: string;
    /** Optional 100%-stacked mix shown under the column title. */
    strip?: CompareStripSegment[];
    /** Optional figures sharing the title row: one centred in the column, one flush right. */
    metaCenter?: ReactNode;
    metaEnd?: ReactNode;
};

export type CompareRange = {
    min: number;
    max: number;
    avg: number;
    median: number;
    domainMin: number;
    domainMax: number;
    ticks?: number;
};

export type CompareCell = {
    /** Bar length as a fraction of the grid's shared scale (0–1). Ignored when `range` is set. */
    fraction: number;
    /** Draws a min–max whisker instead of a bar. */
    range?: CompareRange;
    value: string;
    sub?: string;
    tip?: TipContent;
};

export type CompareRow = {
    key: string;
    label: string;
    icon?: string;
    color: string;
    cells: CompareCell[];
    aside?: ReactNode;
};

function clampFraction(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

/**
 * Row-per-metric comparison: an icon label column, one square bar (or whisker)
 * per group on a shared scale, and an optional trailing column (e.g. a delta).
 */
export default function CompareGrid({
    columns,
    rows,
    asideTitle,
}: {
    columns: CompareColumn[];
    rows: CompareRow[];
    asideTitle?: string;
}) {
    const { bind, tip } = useHoverTip();
    const hasAside = asideTitle !== undefined;
    const gridStyle = { '--cmp-cols': columns.length } as CSSProperties;
    const className = `cmp-grid${hasAside ? ' has-aside' : ''}`;

    return (
        <div className={className} style={gridStyle}>
            <div className="cmp-row cmp-head">
                <span className="cmp-label" aria-hidden="true" />
                {columns.map((column) => {
                    const hasMeta = column.metaCenter !== undefined || column.metaEnd !== undefined;
                    return (
                        <div key={column.key} className={`cmp-col-head${hasMeta ? ' has-meta' : ''}`}>
                            <span className="cmp-col-title">{column.title}</span>
                            {hasMeta && <span className="cmp-col-meta is-center">{column.metaCenter}</span>}
                            {hasMeta && <span className="cmp-col-meta is-end">{column.metaEnd}</span>}
                            {column.strip && (
                                <span className="cmp-strip">
                                    {column.strip.map((segment) => (
                                        <i
                                            key={segment.label}
                                            style={{
                                                '--seg-w': `${clampFraction(segment.value) * 100}%`,
                                                '--seg-color': segment.color,
                                            } as CSSProperties}
                                            {...bind({
                                                head: `${column.title} · ${segment.label}`,
                                                color: segment.color,
                                                rows: [{ label: 'Share', value: `${(segment.value * 100).toFixed(1)}%` }],
                                            })}
                                        />
                                    ))}
                                </span>
                            )}
                        </div>
                    );
                })}
                {hasAside && <span className="cmp-aside cmp-col-title">{asideTitle}</span>}
            </div>
            {rows.map((row) => (
                <div key={row.key} className="cmp-row" style={{ '--bar-color': row.color } as CSSProperties}>
                    <span className="cmp-label">
                        {row.icon && <img src={row.icon} alt="" className="cmp-label-icon" />}
                        <span className="cmp-label-text">{row.label}</span>
                    </span>
                    {row.cells.map((cell, index) => (
                        <span key={columns[index]?.key ?? index} className="cmp-cell" {...bind(cell.tip)}>
                            {cell.range ? (
                                <RangeTrack {...cell.range} color={row.color} className="cmp-range" />
                            ) : (
                                <span className="cmp-bar" aria-hidden="true">
                                    <i style={{ '--pct': `${clampFraction(cell.fraction) * 100}%` } as CSSProperties} />
                                </span>
                            )}
                            <span className="cmp-value">
                                <b><AnimatedText text={cell.value} /></b>
                                {cell.sub && <small><AnimatedText text={cell.sub} /></small>}
                            </span>
                        </span>
                    ))}
                    {hasAside && <span className="cmp-aside">{row.aside}</span>}
                </div>
            ))}
            {tip}
        </div>
    );
}
