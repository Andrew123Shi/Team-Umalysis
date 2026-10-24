import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedText, useTweenedValues } from '../AnimatedNumber';

export const OUTCOME_COLORS = {
    win: '#66bb6a',
    top2: '#ffca28',
    top3: '#fd7e14',
    loss: '#ef5350',
    podium: '#64b5f6',
    placed: '#66bb6a',
} as const;

const RING_RADIUS = 43;

function clampPct(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value * 100));
}

export function pctLabel(value: number): string {
    return `${clampPct(value).toFixed(1)}%`;
}

type RingSegment = {
    label: string;
    /** Percentage 0–100 of the ring this segment occupies. */
    value: number;
    /** Value shown in the hover tooltip when it differs from the arc length (cumulative rates). */
    tooltipValue?: number;
    color: string;
};

type RingTooltip = {
    label: string;
    value: number;
    color: string;
    x: number;
    y: number;
};

/**
 * Segment lengths are tweened together in JS: each segment's start depends on
 * the ones before it, so animating dash lengths and offsets separately (CSS)
 * lets the arcs drift apart mid-transition. Empty segments stay mounted at zero
 * length so they can grow back.
 */
function RingSvg({ segments }: { segments: RingSegment[] }) {
    const [tooltip, setTooltip] = useState<RingTooltip | null>(null);
    const lengths = useTweenedValues(segments.map((segment) => Math.max(0, Math.min(100, segment.value))));
    let offset = 0;

    const showTooltip = (event: MouseEvent<SVGCircleElement>, segment: RingSegment) => {
        setTooltip({
            label: segment.label,
            value: segment.tooltipValue ?? segment.value,
            color: segment.color,
            x: event.clientX + 14,
            y: event.clientY + 14,
        });
    };

    return (
        <>
            <svg className="ring-svg" viewBox="0 0 100 100" role="img" aria-label="Rate breakdown">
                <circle className="ring-track" cx="50" cy="50" r={RING_RADIUS} />
                {segments.map((segment, index) => {
                    const value = Math.max(0, Math.min(100 - offset, lengths[index] ?? 0));
                    const start = offset;
                    offset += value;
                    return (
                        <circle
                            key={segment.label}
                            className="ring-segment"
                            cx="50"
                            cy="50"
                            r={RING_RADIUS}
                            pathLength="100"
                            stroke={segment.color}
                            strokeDasharray={`${value} ${100 - value}`}
                            strokeDashoffset={-start}
                            transform="rotate(-90 50 50)"
                            onMouseEnter={(event) => showTooltip(event, segment)}
                            onMouseMove={(event) => showTooltip(event, segment)}
                            onMouseLeave={() => setTooltip(null)}
                        />
                    );
                })}
            </svg>
            {tooltip && typeof document !== 'undefined' && createPortal(
                <div
                    className="ring-tooltip"
                    style={{ left: tooltip.x, top: tooltip.y, '--tooltip-color': tooltip.color } as CSSProperties}
                >
                    <span className="ring-tooltip-dot" />
                    <span>{tooltip.label}</span>
                    <strong>{tooltip.value.toFixed(1)}%</strong>
                </div>,
                document.body,
            )}
        </>
    );
}

/**
 * Square ring whose center text is sized in container units, so the number
 * stays centered and inside the hole at any rendered size.
 */
function Ring({
    segments,
    value,
    size = 'md',
}: {
    segments: RingSegment[];
    value: string;
    size?: 'sm' | 'md';
}) {
    return (
        <div className={`ring is-${size}`}>
            <RingSvg segments={segments} />
            <div className="ring-core">
                <span className="ring-value"><AnimatedText text={value} /></span>
            </div>
        </div>
    );
}

export function WinRateDonut({
    value,
    color = OUTCOME_COLORS.win,
    size = 'md',
}: {
    value: number;
    color?: string;
    size?: 'sm' | 'md';
}) {
    const winPct = clampPct(value);
    return (
        <Ring
            size={size}
            value={pctLabel(value)}
            segments={[
                { label: 'Wins', value: winPct, color },
                { label: 'Losses', value: 100 - winPct, color: OUTCOME_COLORS.loss },
            ]}
        />
    );
}

export function TeamPlacementRings({
    allPodiumRate,
    allPlacedRate,
}: {
    allPodiumRate: number;
    allPlacedRate: number;
}) {
    const allPodiumPct = clampPct(allPodiumRate);
    const allPlacedPct = Math.max(allPodiumPct, clampPct(allPlacedRate));

    return (
        <Ring
            value={pctLabel(allPlacedRate)}
            segments={[
                { label: 'All Podiumed (1st/2nd/3rd)', value: allPodiumPct, color: OUTCOME_COLORS.podium },
                { label: 'All Placed (≤5th)', value: allPlacedPct - allPodiumPct, tooltipValue: allPlacedPct, color: OUTCOME_COLORS.placed },
                { label: 'Not All Placed', value: 100 - allPlacedPct, color: OUTCOME_COLORS.loss },
            ]}
        />
    );
}

export function WinRateRings({
    winRate,
    top2Rate,
    top3Rate,
}: {
    winRate: number;
    top2Rate: number;
    top3Rate: number;
}) {
    const winPct = clampPct(winRate);
    const top2Pct = Math.max(winPct, clampPct(top2Rate));
    const top3Pct = Math.max(top2Pct, clampPct(top3Rate));

    return (
        <Ring
            value={pctLabel(winRate)}
            segments={[
                { label: 'Wins', value: winPct, color: OUTCOME_COLORS.win },
                { label: 'Top 2', value: top2Pct - winPct, tooltipValue: top2Pct, color: OUTCOME_COLORS.top2 },
                { label: 'Top 3', value: top3Pct - top2Pct, tooltipValue: top3Pct, color: OUTCOME_COLORS.top3 },
                { label: 'Did Not Place', value: 100 - top3Pct, color: OUTCOME_COLORS.loss },
            ]}
        />
    );
}

/** Rate rows with a proportional bar under each label. */
export function WinRateLegend({
    items,
}: {
    items: { label: string; value: number; color: string }[];
}) {
    return (
        <div className="rate-legend">
            {items.map((item) => (
                <div
                    key={item.label}
                    className="rate-legend-row"
                    style={{ '--rate-color': item.color, '--rate-pct': `${clampPct(item.value)}%` } as CSSProperties}
                >
                    <span className="rate-legend-label">{item.label}</span>
                    <strong className="rate-legend-value"><AnimatedText text={pctLabel(item.value)} /></strong>
                    <span className="rate-legend-bar" aria-hidden="true" />
                </div>
            ))}
        </div>
    );
}

export function WinRatePieCard({
    title,
    value,
    detail,
    footer,
}: {
    title: string;
    value: number;
    detail?: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <div className="ring-tile">
            <div className="ring-tile-title">{title}</div>
            <WinRateDonut value={value} size="sm" />
            {detail && <div className="ring-tile-detail">{detail}</div>}
            {footer && <div className="ring-tile-footer">{footer}</div>}
        </div>
    );
}
