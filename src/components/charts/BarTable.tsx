import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatedText } from '../AnimatedNumber';
import { useHoverTip } from '../HoverTip';
import SectionHeading from '../SectionHeading';

export type SortDir = 'asc' | 'desc';

export type BarColumn<K extends string> = {
    key: K;
    label: string;
    /** Full label shown on hover when `label` is abbreviated. */
    title?: string;
};

export type BarRow<K extends string> = {
    key: string;
    label: ReactNode;
    iconSrc?: string;
    iconClassName?: string;
    values: Record<K, string>;
    /** 0–100 width of the background bar. */
    barPct: number;
    barColor?: string;
    barClassName?: string;
    onClick?: () => void;
};

function SortHeader({
    label,
    title,
    active,
    sortDir,
    align,
    onClick,
}: {
    label: string;
    title?: string;
    active: boolean;
    sortDir: SortDir;
    align: 'start' | 'end';
    onClick: () => void;
}) {
    const { bind, tip } = useHoverTip();
    const arrow = <span className="bar-sort-arrow" aria-hidden="true">{active ? (sortDir === 'asc' ? '↑' : '↓') : ''}</span>;
    return (
        <button
            type="button"
            role="columnheader"
            aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
            aria-label={title}
            className={`bar-sort${active ? ' is-active' : ''}${align === 'end' ? ' is-end' : ''}`}
            onClick={onClick}
            {...bind(title && title.toLowerCase() !== label.toLowerCase() ? { head: title } : undefined)}
        >
            {tip}
            {align === 'end' ? (
                <span className="bar-sort-label">{arrow}{label}</span>
            ) : (
                <>
                    <span className="bar-sort-label">{label}</span>
                    {arrow}
                </>
            )}
        </button>
    );
}

/** Rows the viewport shows (the grid's max-height in CSS) and extra rows rendered on each side. */
const VISIBLE_ROWS = 10;
const OVERSCAN_ROWS = 6;

/**
 * Only the rows near the scroll position are rendered; spacers stand in for the
 * rest. Rows have a fixed height, so the first visible row follows from scrollTop.
 */
function useRowWindow(rowCount: number) {
    const gridRef = useRef<HTMLDivElement>(null);
    const rowHeightRef = useRef(0);
    const [firstRow, setFirstRow] = useState(0);

    useLayoutEffect(() => {
        const grid = gridRef.current;
        if (!grid) return undefined;
        let frame = 0;
        const update = () => {
            frame = 0;
            const row = grid.querySelector<HTMLElement>('.bar-row');
            if (row) rowHeightRef.current = row.offsetHeight;
            if (rowHeightRef.current > 0) setFirstRow(Math.floor(grid.scrollTop / rowHeightRef.current));
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        grid.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            grid.removeEventListener('scroll', onScroll);
            cancelAnimationFrame(frame);
        };
    }, []);

    const start = Math.max(0, Math.min(firstRow, rowCount - VISIBLE_ROWS) - OVERSCAN_ROWS);
    const end = Math.min(rowCount, firstRow + VISIBLE_ROWS + OVERSCAN_ROWS);
    return { gridRef, start, end };
}

/**
 * Sortable list of rows with a proportional background bar. Head and rows are
 * subgrids of one table grid, so columns stay aligned at any container width.
 * Value columns are as wide as their longest value in any row (monospace, so in
 * `ch`), which keeps them steady while rows outside the viewport aren't rendered.
 */
export default function BarTable<N extends string, K extends string>({
    title,
    info,
    actions,
    nameColumn,
    columns,
    rows,
    sortKey,
    sortDir,
    onSort,
    emptyText = 'No data',
    className = '',
}: {
    title: string;
    info?: string;
    actions?: ReactNode;
    nameColumn: { key: N; label: string };
    columns: BarColumn<K>[];
    rows: BarRow<K>[];
    sortKey: N | K;
    sortDir: SortDir;
    onSort: (key: N | K) => void;
    emptyText?: string;
    className?: string;
}) {
    const { gridRef, start, end } = useRowWindow(rows.length);
    const gridStyle = useMemo(() => {
        const widths = columns.map((column) => Math.max(0, ...rows.map((row) => (row.values[column.key] ?? '').length)));
        return {
            gridTemplateColumns: ['minmax(0, 1fr)', ...widths.map((chars) => `minmax(${chars}ch, auto)`)].join(' '),
        } as CSSProperties;
    }, [columns, rows]);
    const spacer = (count: number) => (count > 0
        ? <div className="bar-spacer" aria-hidden="true" style={{ height: `calc(${count} * var(--bar-row-h))` }} />
        : null);

    return (
        <section className={['app-card', 'bar-table', className].filter(Boolean).join(' ')}>
            <SectionHeading title={title} info={info} actions={actions} />
            <div className="bar-grid" role="table" aria-rowcount={rows.length + 1} style={gridStyle} ref={gridRef}>
                <div className="bar-grid-head" role="row" aria-rowindex={1}>
                    <SortHeader
                        label={nameColumn.label}
                        active={sortKey === nameColumn.key}
                        sortDir={sortDir}
                        align="start"
                        onClick={() => onSort(nameColumn.key)}
                    />
                    {columns.map((column) => (
                        <SortHeader
                            key={column.key}
                            label={column.label}
                            title={column.title}
                            active={sortKey === column.key}
                            sortDir={sortDir}
                            align="end"
                            onClick={() => onSort(column.key)}
                        />
                    ))}
                </div>
                <div className="bar-grid-body" role="rowgroup">
                    {rows.length === 0 && <div className="bar-empty">{emptyText}</div>}
                    {spacer(start)}
                    {rows.slice(start, end).map((row, offset) => {
                        const rowIndex = start + offset + 2;
                        const content = (
                            <>
                                <span
                                    className={['bar-row-fill', row.barClassName].filter(Boolean).join(' ')}
                                    style={{
                                        '--bar-width': `${Math.max(1, Math.min(100, row.barPct))}%`,
                                        ...(row.barColor ? { '--bar-color': row.barColor } : {}),
                                    } as CSSProperties}
                                />
                                <span className="bar-cell-name" role="cell">
                                    {row.iconSrc && (
                                        <img src={row.iconSrc} alt="" className={['bar-row-icon', row.iconClassName].filter(Boolean).join(' ')} />
                                    )}
                                    <span className="bar-cell-name-text">{row.label}</span>
                                </span>
                                {columns.map((column) => (
                                    <span
                                        key={column.key}
                                        role="cell"
                                        className={`bar-cell-value${sortKey === column.key ? ' is-active' : ''}`}
                                    >
                                        <AnimatedText text={row.values[column.key] ?? ''} />
                                    </span>
                                ))}
                            </>
                        );
                        return row.onClick ? (
                            <button key={row.key} type="button" role="row" aria-rowindex={rowIndex} className="bar-row is-clickable" onClick={row.onClick}>
                                {content}
                            </button>
                        ) : (
                            <div key={row.key} role="row" aria-rowindex={rowIndex} className="bar-row">
                                {content}
                            </div>
                        );
                    })}
                    {spacer(rows.length - end)}
                </div>
            </div>
        </section>
    );
}
