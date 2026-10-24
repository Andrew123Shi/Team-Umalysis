import type { CSSProperties } from 'react';
import type { TipContent } from '../HoverTip';

/** Team Trials races always field 12 runners. */
export const FIELD_SIZE = 12;

type RangeSummary = { min: number; max: number; avg: number; median: number };

/** Hover tooltip listing a whisker's figures, in the same order the plot reads. */
export function rangeTip(
    head: string,
    summary: RangeSummary,
    format: (value: number) => string,
    { color, minLabel = 'Min', maxLabel = 'Max', avgFormat = format }: {
        color?: string;
        minLabel?: string;
        maxLabel?: string;
        avgFormat?: (value: number) => string;
    } = {},
): TipContent {
    return {
        head,
        color,
        rows: [
            { label: 'Average', value: avgFormat(summary.avg) },
            { label: 'Median', value: format(summary.median) },
            { label: minLabel, value: format(summary.min) },
            { label: maxLabel, value: format(summary.max) },
        ],
    };
}

/**
 * Horizontal min–max band on a fixed domain with average and median markers.
 * `ticks` draws evenly spaced notches (e.g. finishing positions).
 */
export default function RangeTrack({
    min,
    max,
    avg,
    median,
    domainMin,
    domainMax,
    ticks,
    color,
    className = '',
}: {
    min: number;
    max: number;
    avg: number;
    median?: number;
    domainMin: number;
    domainMax: number;
    ticks?: number;
    color?: string;
    className?: string;
}) {
    const span = domainMax - domainMin;
    const pct = (value: number) => {
        if (span <= 0) return 50;
        return Math.max(0, Math.min(100, ((value - domainMin) / span) * 100));
    };
    const style = {
        '--lo': `${pct(min)}%`,
        '--hi': `${pct(max)}%`,
        '--avg': `${pct(avg)}%`,
        '--med': `${pct(median ?? avg)}%`,
        ...(color ? { '--range-color': color } : {}),
    } as CSSProperties;

    return (
        <div className={['range-track', className].filter(Boolean).join(' ')} style={style} aria-hidden="true">
            {ticks && ticks > 1 && (
                <span className="range-track-ticks">
                    {Array.from({ length: ticks }, (_, index) => <i key={index} />)}
                </span>
            )}
            <span className="range-track-band" />
            {median !== undefined && <span className="range-track-med" />}
            <span className="range-track-avg" />
        </div>
    );
}
