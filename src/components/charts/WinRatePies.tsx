import { useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

function clampPct(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value * 100));
}

function pctLabel(value: number): string {
    return `${clampPct(value).toFixed(1)}%`;
}

type DonutSegment = {
    label: string;
    value: number;
    tooltipValue?: number;
    color: string;
};

type DonutTooltip = {
    label: string;
    value: number;
    color: string;
    x: number;
    y: number;
};

function DonutSegments({ segments }: { segments: DonutSegment[] }) {
    const [tooltip, setTooltip] = useState<DonutTooltip | null>(null);
    let offset = 0;
    const showTooltip = (
        event: MouseEvent<SVGCircleElement>,
        segment: DonutSegment,
        value: number,
    ) => {
        setTooltip({
            label: segment.label,
            value: segment.tooltipValue ?? value,
            color: segment.color,
            x: event.clientX + 14,
            y: event.clientY + 14,
        });
    };

    return (
        <>
            <svg className="win-rate-svg" viewBox="0 0 120 120" role="img" aria-label="Win rate breakdown">
                {segments.map((segment) => {
                    const value = Math.max(0, Math.min(100, segment.value));
                    const dashOffset = -offset;
                    offset += value;
                    if (value <= 0) return null;
                    return (
                        <circle
                            key={segment.label}
                            className="win-rate-svg-segment"
                            cx="60"
                            cy="60"
                            r="52"
                            pathLength="100"
                            stroke={segment.color}
                            strokeDasharray={`${value} ${100 - value}`}
                            strokeDashoffset={dashOffset}
                            transform="rotate(-90 60 60)"
                            onMouseEnter={(event) => showTooltip(event, segment, value)}
                            onMouseMove={(event) => showTooltip(event, segment, value)}
                            onMouseLeave={() => setTooltip(null)}
                        />
                    );
                })}
            </svg>
            {tooltip && typeof document !== 'undefined' && createPortal(
                <div
                    className="win-rate-tooltip"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y,
                        '--tooltip-color': tooltip.color,
                    } as CSSProperties}
                >
                    <span className="win-rate-tooltip-dot" />
                    <span>{tooltip.label}</span>
                    <strong>{tooltip.value.toFixed(1)}%</strong>
                </div>,
                document.body,
            )}
        </>
    );
}

export function WinRateDonut({
    value,
    label,
    color = '#66bb6a',
    size = 'md',
}: {
    value: number;
    label?: string;
    color?: string;
    size?: 'sm' | 'md';
}) {
    const winPct = clampPct(value);
    return (
        <div className={`win-rate-donut is-${size}`}>
            <DonutSegments
                segments={[
                    { label: 'Wins', value: winPct, color },
                    { label: 'Losses', value: 100 - winPct, color: '#ef5350' },
                ]}
            />
            <div className="win-rate-donut-core">
                <div className="win-rate-donut-value">{pctLabel(value)}</div>
                {label && <div className="win-rate-donut-label">{label}</div>}
            </div>
        </div>
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
    const top2OnlyPct = top2Pct - winPct;
    const top3OnlyPct = top3Pct - top2Pct;
    const outsideTop3Pct = 100 - top3Pct;

    return (
        <div className="win-rate-segments">
            <DonutSegments
                segments={[
                    { label: 'Wins', value: winPct, color: '#66bb6a' },
                    { label: 'Top 2', value: top2OnlyPct, tooltipValue: top2Pct, color: '#ffca28' },
                    { label: 'Top 3', value: top3OnlyPct, tooltipValue: top3Pct, color: '#fd7e14' },
                    { label: 'Did Not Place', value: outsideTop3Pct, color: '#ef5350' },
                ]}
            />
            <div className="win-rate-segments-core">
                <div className="win-rate-segments-value">{pctLabel(winRate)}</div>
            </div>
        </div>
    );
}

export function WinRateLegend({
    items,
}: {
    items: { label: string; value: number; color: string }[];
}) {
    return (
        <div className="win-rate-legend">
            {items.map((item) => (
                <span key={item.label} className="win-rate-legend-item">
                    <span className="win-rate-legend-dot" style={{ '--legend-color': item.color } as CSSProperties} />
                    <span>{item.label}</span>
                    <strong>{pctLabel(item.value)}</strong>
                </span>
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
        <div className="win-rate-pie-card h-100">
            <div className="win-rate-pie-title">{title}</div>
            <WinRateDonut value={value} size="sm" />
            {detail && <div className="win-rate-pie-detail">{detail}</div>}
            {footer && <div className="win-rate-pie-footer">{footer}</div>}
        </div>
    );
}
