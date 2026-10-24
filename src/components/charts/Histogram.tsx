import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatedText } from '../AnimatedNumber';
import { useHoverTip, type TipContent } from '../HoverTip';
import { MOTION_MS } from '../motion';

export type HistogramBin = {
    lo: number;
    hi: number;
    count: number;
    /** Tick label drawn under the bar (discrete histograms). */
    tick?: string;
    color?: string;
};

const MAX_BINS = 28;
const MIN_BINS = 8;
const NICE_UNITS = [1, 2, 2.5, 5, 10];

/** The 1 / 2 / 2.5 / 5 × 10ⁿ width closest to `raw`. */
function niceWidth(raw: number): number {
    const power = 10 ** Math.floor(Math.log10(raw));
    const unit = NICE_UNITS.reduce((best, candidate) => (
        Math.abs(Math.log(candidate * power / raw)) < Math.abs(Math.log(best * power / raw)) ? candidate : best
    ));
    return unit * power;
}

function binWidthFor(values: number[]): number | undefined {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (!(max > min)) return undefined;
    const target = Math.max(MIN_BINS, Math.min(MAX_BINS, Math.round(Math.sqrt(values.length) * 2)));
    return niceWidth((max - min) / target);
}

/**
 * Bins of a round width laid on multiples of that width, so the same score
 * always falls in the same bin. The width comes from `scaleValues` (the full
 * history), so Recent and Overall share their bins: switching zooms the axis,
 * the shared bars stay in place and only the bins past either range come or go.
 */
export function buildContinuousBins(values: number[], scaleValues: number[] = values): HistogramBin[] {
    const finite = values.filter((value) => Number.isFinite(value));
    if (finite.length === 0) return [];
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    if (max <= min) return [{ lo: min - 0.5, hi: min + 0.5, count: finite.length }];
    const sharedWidth = binWidthFor(scaleValues.filter((value) => Number.isFinite(value)));
    const width = sharedWidth !== undefined && (max - min) / sharedWidth <= MAX_BINS
        ? sharedWidth
        : binWidthFor(finite)!;
    const first = Math.floor(min / width);
    const bins: HistogramBin[] = Array.from({ length: Math.floor(max / width) - first + 1 }, (_, index) => ({
        lo: (first + index) * width,
        hi: (first + index + 1) * width,
        count: 0,
    }));
    finite.forEach((value) => {
        bins[Math.min(bins.length - 1, Math.floor(value / width) - first)].count += 1;
    });
    return bins;
}

type Domain = { lo: number; hi: number };
type Slot = { key: string; bin: HistogramBin; leaving: boolean };

function binKey(bin: HistogramBin): string {
    return bin.tick !== undefined ? `t:${bin.tick}` : `${bin.hi - bin.lo}:${Math.round(bin.lo / (bin.hi - bin.lo))}`;
}

function domainOf(bins: HistogramBin[]): Domain {
    return bins.length > 0 ? { lo: bins[0].lo, hi: bins[bins.length - 1].hi } : { lo: 0, hi: 1 };
}

function percent(value: number, domain: Domain): number {
    const span = domain.hi - domain.lo;
    return span > 0 ? ((value - domain.lo) / span) * 100 : 50;
}

/**
 * Bars sit at their value range on the axis, so a change of data zooms the
 * axis: bars present before and after glide to their new place, new bins grow
 * in from where they would have been on the old axis (their `@starting-style`),
 * and bins that no longer exist shrink away on the new one before unmounting.
 */
function useBinSlots(bins: HistogramBin[]) {
    const [state, setState] = useState(() => ({
        slots: bins.map((bin): Slot => ({ key: binKey(bin), bin, leaving: false })),
        domain: domainOf(bins),
        previousDomain: domainOf(bins),
        bins,
    }));

    if (state.bins !== bins) {
        const incoming = new Set(bins.map(binKey));
        setState({
            slots: [
                ...bins.map((bin): Slot => ({ key: binKey(bin), bin, leaving: false })),
                ...state.slots
                    .filter((slot) => !incoming.has(slot.key))
                    .map((slot): Slot => ({ ...slot, leaving: true })),
            ],
            domain: domainOf(bins),
            previousDomain: state.domain,
            bins,
        });
    }

    const leaving = state.slots.some((slot) => slot.leaving);
    useEffect(() => {
        if (!leaving) return undefined;
        const timer = window.setTimeout(() => {
            setState((prev) => ({ ...prev, slots: prev.slots.filter((slot) => !slot.leaving) }));
        }, MOTION_MS);
        return () => window.clearTimeout(timer);
    }, [leaving, state.bins]);

    return state;
}

/**
 * Distribution strip with average/median markers. The axis row mirrors around
 * the median ("min · median · max") so the plot keeps all the vertical space.
 */
export default function Histogram({
    bins,
    avg,
    median,
    min,
    max,
    format,
    unit = 'sessions',
    binTip,
    minLabel = 'min',
    maxLabel = 'max',
}: {
    bins: HistogramBin[];
    avg: number;
    median: number;
    min: number;
    max: number;
    format: (value: number) => string;
    /** Row label for the bin count in the default tooltip. */
    unit?: string;
    binTip?: (bin: HistogramBin) => TipContent;
    minLabel?: string;
    maxLabel?: string;
}) {
    const peak = useMemo(() => Math.max(1, ...bins.map((bin) => bin.count)), [bins]);
    const { slots, domain, previousDomain } = useBinSlots(bins);
    const { bind, tip } = useHoverTip();
    if (bins.length === 0) return null;
    const defaultTip = (bin: HistogramBin): TipContent => ({
        head: `${format(bin.lo)} – ${format(bin.hi)}`,
        color: bin.color,
        rows: [{ label: unit.charAt(0).toUpperCase() + unit.slice(1), value: bin.count }],
    });
    const hasTicks = bins.some((bin) => bin.tick !== undefined);
    const lastBin = bins[bins.length - 1];

    return (
        <div className="histo">
            <div className="histo-plot">
                <div className="histo-bars">
                    {slots.map(({ key, bin, leaving }) => {
                        const left = percent(bin.lo, domain);
                        const startLeft = percent(bin.lo, previousDomain);
                        const holdsAvg = !leaving && avg >= bin.lo && (avg < bin.hi || bin === lastBin);
                        const style = {
                            '--l': `${left}%`,
                            '--w': `${percent(bin.hi, domain) - left}%`,
                            '--l0': `${startLeft}%`,
                            '--w0': `${percent(bin.hi, previousDomain) - startLeft}%`,
                            '--h': leaving ? '0%' : `${(bin.count / peak) * 100}%`,
                            ...(bin.color ? { '--bar-color': bin.color } : {}),
                        } as CSSProperties;
                        return (
                            <span
                                key={key}
                                className={`histo-col${holdsAvg ? ' is-avg' : ''}${leaving ? ' is-ghost' : ''}`}
                                style={style}
                                {...(leaving ? {} : bind((binTip ?? defaultTip)(bin)))}
                            >
                                <span className="histo-bar" />
                            </span>
                        );
                    })}
                </div>
                <span className="histo-marker is-median" style={{ '--x': `${percent(median, domain)}%` } as CSSProperties} />
                <span className="histo-marker is-avg" style={{ '--x': `${percent(avg, domain)}%` } as CSSProperties} />
            </div>
            {hasTicks && (
                <div className="histo-ticks" aria-hidden="true">
                    {bins.map((bin, index) => <span key={index}>{bin.tick}</span>)}
                </div>
            )}
            <div className="histo-axis">
                <span><AnimatedText text={format(min)} /><em className="is-after">{minLabel}</em></span>
                <span className="is-median"><em className="is-before">med</em><AnimatedText text={format(median)} /></span>
                <span><em className="is-before">{maxLabel}</em><AnimatedText text={format(max)} /></span>
            </div>
            {tip}
        </div>
    );
}
