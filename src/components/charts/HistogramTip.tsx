import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { summarize } from '../../analytics/aggregateTeamTrials';
import type { TipContent } from '../HoverTip';
import Histogram, { buildContinuousBins, type HistogramBin } from './Histogram';

export type HistogramSeries = {
    label: string;
    values: number[];
    format: (value: number) => string;
    /** Plural noun for what each value is, e.g. "races" or "wins". */
    unit: string;
    /** One bar per integer from `min` to `max` (widened to fit the data) instead of value-range bins. */
    discrete?: {
        min?: number;
        max?: number;
        color?: (value: number) => string | undefined;
        /** Tooltip head for a single bar; defaults to `format`. */
        label?: (value: number) => string;
    };
    color?: string;
    minLabel?: string;
    maxLabel?: string;
};

const CLOSE_DELAY_MS = 120;
const ANCHOR_GAP_PX = 6;
const VIEWPORT_MARGIN_PX = 8;

function buildIntegerBins(values: number[], discrete: NonNullable<HistogramSeries['discrete']>): HistogramBin[] {
    const counts = new Map<number, number>();
    values.forEach((value) => {
        const key = Math.round(value);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const keys = [...counts.keys()];
    const lo = Math.min(discrete.min ?? Infinity, ...keys);
    const hi = Math.max(discrete.max ?? -Infinity, ...keys);
    return Array.from({ length: hi - lo + 1 }, (_, index) => {
        const value = lo + index;
        return {
            lo: value - 0.5,
            hi: value + 0.5,
            count: counts.get(value) ?? 0,
            tick: String(value),
            color: discrete.color?.(value),
        };
    });
}

function SeriesHistogram({ series }: { series: HistogramSeries }) {
    const { values, discrete, color, format, unit } = series;
    const summary = useMemo(() => summarize(values), [values]);
    const bins = useMemo(() => {
        if (values.length === 0) return [];
        const built = discrete ? buildIntegerBins(values, discrete) : buildContinuousBins(values);
        return color ? built.map((bin) => (bin.color ? bin : { ...bin, color })) : built;
    }, [values, discrete, color]);

    const binTip = (bin: HistogramBin): TipContent => {
        const center = (bin.lo + bin.hi) / 2;
        return {
            head: discrete
                ? (discrete.label ?? format)(center)
                : `${format(bin.lo)} – ${format(bin.hi)}`,
            color: bin.color,
            rows: [
                { label: unit.charAt(0).toUpperCase() + unit.slice(1), value: bin.count },
                { label: 'Share', value: `${((bin.count / values.length) * 100).toFixed(1)}%` },
            ],
        };
    };

    return (
        <div className="histo-tip-series">
            <div className="histo-tip-series-head">
                <span>{series.label}</span>
                <span>{values.length} {unit}</span>
            </div>
            {values.length === 0 ? (
                <div className="empty-note">No data</div>
            ) : (
                <Histogram
                    bins={bins}
                    avg={summary.avg}
                    median={summary.median}
                    min={summary.min}
                    max={summary.max}
                    format={format}
                    binTip={binTip}
                    minLabel={series.minLabel}
                    maxLabel={series.maxLabel}
                />
            )}
        </div>
    );
}

/**
 * Chart icon that opens a panel of histograms on hover or focus. The panel
 * stays open while the pointer is over it so its bars can be inspected.
 */
export default function HistogramTip({ title, series }: { title: string; series: HistogramSeries[] }) {
    const id = useId();
    const triggerRef = useRef<HTMLSpanElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const closeTimer = useRef<number | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

    const cancelClose = () => window.clearTimeout(closeTimer.current);
    const show = () => {
        cancelClose();
        setOpen(true);
    };
    const scheduleClose = () => {
        cancelClose();
        closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
    };

    useEffect(() => () => window.clearTimeout(closeTimer.current), []);

    useLayoutEffect(() => {
        if (!open) {
            setPosition(null);
            return;
        }
        const anchor = triggerRef.current?.getBoundingClientRect();
        const panel = panelRef.current?.getBoundingClientRect();
        if (!anchor || !panel) return;
        const maxLeft = window.innerWidth - panel.width - VIEWPORT_MARGIN_PX;
        const left = Math.max(VIEWPORT_MARGIN_PX, Math.min(anchor.left, maxLeft));
        const below = anchor.bottom + ANCHOR_GAP_PX;
        const fitsBelow = below + panel.height <= window.innerHeight - VIEWPORT_MARGIN_PX;
        const top = fitsBelow ? below : Math.max(VIEWPORT_MARGIN_PX, anchor.top - ANCHOR_GAP_PX - panel.height);
        setPosition({ left, top });
    }, [open]);

    // The panel is fixed to where the icon was, so it would drift once the page moves.
    useEffect(() => {
        if (!open) return undefined;
        const close = () => setOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    const panelStyle = {
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? 'visible' : 'hidden',
    } as CSSProperties;

    return (
        <>
            <span
                ref={triggerRef}
                className={`histo-tip-trigger${open ? ' is-open' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${title} distribution`}
                aria-expanded={open}
                aria-describedby={open ? id : undefined}
                onMouseEnter={show}
                onMouseLeave={scheduleClose}
                onFocus={show}
                onBlur={scheduleClose}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') setOpen(false);
                }}
            >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                    <rect x="1" y="6" width="2.4" height="5" rx="0.4" />
                    <rect x="4.8" y="2" width="2.4" height="9" rx="0.4" />
                    <rect x="8.6" y="4.5" width="2.4" height="6.5" rx="0.4" />
                </svg>
            </span>
            {open && typeof document !== 'undefined' && createPortal(
                <div
                    ref={panelRef}
                    id={id}
                    className="histo-tip"
                    role="tooltip"
                    style={panelStyle}
                    onMouseEnter={show}
                    onMouseLeave={scheduleClose}
                >
                    <div className="histo-tip-title">{title}</div>
                    {series.map((item) => <SeriesHistogram key={item.label} series={item} />)}
                </div>,
                document.body,
            )}
        </>
    );
}
