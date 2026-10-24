import { useEffect, useMemo, useState } from 'react';

export const CHART_FONT_SANS = "Figtree, system-ui, -apple-system, 'Segoe UI', sans-serif";
export const CHART_FONT_MONO = "'Geist Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace";

export const CHART_COLORS = {
    text: '#e9edf3',
    label: '#7d8796',
    legend: '#9ba5b4',
    axisLine: 'rgba(255, 255, 255, 0.12)',
    splitLine: 'rgba(255, 255, 255, 0.05)',
    pointer: 'rgba(255, 255, 255, 0.3)',
    rosterMark: 'rgba(242, 85, 90, 0.38)',
    rosterMarkHover: 'rgba(242, 85, 90, 0.7)',
    primary: '#4d9fff',
    ema: '#fbbf24',
    average: '#e9edf3',
    positive: '#34d399',
    negative: '#f2555a',
    rosterAdded: '#6ee7b7',
    rosterRemoved: '#fda4af',
} as const;

/** Root font size the chart pixel constants were tuned against (≈1440p). */
const DESIGN_ROOT_PX = 15.5;

/** Canvas text multiplier, kept in step with the 1.25× type scale of the stylesheet. */
const TYPE_SCALE = 1.25;

function readRootPx(): number {
    if (typeof window === 'undefined') return DESIGN_ROOT_PX;
    const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return Number.isFinite(px) && px > 0 ? px : DESIGN_ROOT_PX;
}

export type ChartScale = {
    /** Current root font size in px. */
    rem: number;
    /** Scale a design-time pixel value to the current root size. */
    px: (value: number) => number;
    /** Font size: a design-time text size scaled by root size and the type scale. */
    fs: (value: number) => number;
    /** Bumps when web fonts finish loading; include in memo deps to redraw canvas text. */
    fontsTick: number;
};

/**
 * Canvas charts can't use rem, so sizes are scaled from the live root font
 * size. Re-renders on resize and once web fonts finish loading so canvas text
 * picks up Geist instead of the fallback.
 */
export function useChartScale(): ChartScale {
    const [rem, setRem] = useState(readRootPx);
    const [fontsTick, setFontsTick] = useState(0);

    useEffect(() => {
        let frame = 0;
        const onResize = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => setRem(readRootPx()));
        };
        window.addEventListener('resize', onResize);
        let cancelled = false;
        document.fonts?.ready.then(() => {
            if (!cancelled) setFontsTick((tick) => tick + 1);
        });
        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return useMemo(() => {
        const ratio = rem / DESIGN_ROOT_PX;
        return {
            rem,
            px: (value: number) => Math.round(value * ratio * 10) / 10,
            fs: (value: number) => Math.round(value * ratio * TYPE_SCALE * 10) / 10,
            fontsTick,
        };
    }, [rem, fontsTick]);
}

export function chartAxisLabel(scale: ChartScale, extra: Record<string, unknown> = {}) {
    return {
        color: CHART_COLORS.label,
        fontFamily: CHART_FONT_MONO,
        fontSize: scale.fs(10.5),
        ...extra,
    };
}

export function chartAxisName(scale: ChartScale) {
    return {
        color: CHART_COLORS.label,
        fontFamily: CHART_FONT_MONO,
        fontSize: scale.fs(10),
    };
}

export function chartLegend(scale: ChartScale, extra: Record<string, unknown> = {}) {
    return {
        bottom: 0,
        icon: 'rect',
        itemWidth: scale.px(14),
        itemHeight: scale.px(3),
        itemGap: scale.px(20),
        // Series itemStyle borders (dark point outlines) would otherwise eat into the swatch.
        itemStyle: { borderWidth: 0 },
        textStyle: {
            color: CHART_COLORS.legend,
            fontFamily: CHART_FONT_SANS,
            fontSize: scale.fs(11),
        },
        inactiveColor: '#3a404b',
        ...extra,
    };
}

const AXIS_STEP_MULTIPLIERS = [0.5, 1, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20, 25, 50];

/**
 * Tick step that splits [min, max] into whole intervals (so the max label never
 * crowds the one below it), using as many intervals as fit in `maxSegments`.
 */
export function evenAxisInterval(min: number, max: number, base: number, maxSegments = 5): number | undefined {
    const range = max - min;
    let best: { step: number; segments: number } | undefined;
    for (const multiplier of AXIS_STEP_MULTIPLIERS) {
        const step = base * multiplier;
        const segments = range / step;
        if (!Number.isInteger(segments) || segments > maxSegments) continue;
        if (!best || segments > best.segments) best = { step, segments };
    }
    return best?.step;
}

export const CHART_TEXT_STYLE = { fontFamily: CHART_FONT_SANS } as const;

export const CHART_AXIS_LINE = { show: true, lineStyle: { color: CHART_COLORS.axisLine } } as const;
export const CHART_SPLIT_LINE = { lineStyle: { color: CHART_COLORS.splitLine } } as const;
