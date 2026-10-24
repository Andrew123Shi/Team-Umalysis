import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import * as echarts from 'echarts';
import { prefersReducedMotion, startTween } from '../motion';

type EventHandler = (params: never) => void;
type Option = echarts.EChartsCoreOption;
type Dict = Record<string, unknown>;

const COMPONENT_KEYS = ['series', 'xAxis', 'yAxis', 'grid'] as const;
/** Values that pick ticks or wiring rather than geometry, so they switch instead of blending. */
const SNAP_KEYS = new Set(['interval', 'splitNumber', 'minInterval', 'xAxisIndex', 'yAxisIndex', 'gridIndex', 'z']);

function isDict(value: unknown): value is Dict {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * `to` with every number that also sits at the same place in `from` moved
 * `t` of the way from its old value. Parts that are identical are returned by
 * reference, so unchanged data arrays are never copied.
 */
function blend(from: unknown, to: unknown, t: number): unknown {
    if (from === to) return to;
    if (typeof to === 'number') {
        return typeof from === 'number' && Number.isFinite(from) && Number.isFinite(to) ? from + (to - from) * t : to;
    }
    if (Array.isArray(to)) {
        if (!Array.isArray(from) || from.length !== to.length) return to;
        const out = to.map((value, index) => blend(from[index], value, t));
        return out.every((value, index) => value === to[index]) ? to : out;
    }
    if (isDict(to)) {
        if (!isDict(from)) return to;
        const out: Dict = {};
        let changed = false;
        Object.keys(to).forEach((key) => {
            out[key] = SNAP_KEYS.has(key) ? to[key] : blend(from[key], to[key], t);
            changed ||= out[key] !== to[key];
        });
        return changed ? out : to;
    }
    return to;
}

/**
 * Moves a numeric x range like a camera zoom: the span changes geometrically
 * about the one point both ranges keep in place (the latest trial when Recent
 * widens to Overall), so a 6× zoom doesn't look finished in its first frames.
 */
function zoomRange(from: Dict, to: Dict, t: number): { min: number; max: number } | null {
    const { min: min0, max: max0 } = from;
    const { min: min1, max: max1 } = to;
    if (![min0, max0, min1, max1].every((value) => typeof value === 'number' && Number.isFinite(value))) return null;
    const [a0, b0, a1, b1] = [min0, max0, min1, max1] as number[];
    const span0 = b0 - a0;
    const span1 = b1 - a1;
    if (span0 <= 0 || span1 <= 0) return null;
    const span = span0 * ((span1 / span0) ** t);
    if (Math.abs(span1 - span0) < 1e-9) {
        const min = a0 + (a1 - a0) * t;
        return { min, max: min + span };
    }
    const fixed = (a1 * span0 - a0 * span1) / (span0 - span1);
    const min = fixed - (fixed - a0) * (span / span0);
    return { min, max: min + span };
}

function withZoomedXAxes(next: Dict, from: Dict, to: Dict, t: number): Dict {
    if (!Array.isArray(next.xAxis) && !isDict(next.xAxis)) return next;
    const fromAxes = asList(from.xAxis);
    const toAxes = asList(to.xAxis);
    const axes = asList(next.xAxis).map((axis, index) => {
        const before = fromAxes[index];
        const after = toAxes[index];
        if (!isDict(axis) || !isDict(before) || !isDict(after) || after.type !== 'value') return axis;
        const range = zoomRange(before, after, t);
        return range ? { ...axis, ...range } : axis;
    });
    return { ...next, xAxis: Array.isArray(next.xAxis) ? axes : axes[0] };
}

function asList(value: unknown): unknown[] {
    return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

/** Whether both options have the same components, so blending them is meaningful. */
function sameShape(from: Option, to: Option): boolean {
    return COMPONENT_KEYS.every((key) => {
        const a = asList((from as Dict)[key]);
        const b = asList((to as Dict)[key]);
        return a.length === b.length && a.every((item, index) => (item as Dict)?.type === (b[index] as Dict)?.type);
    });
}

/** Only what changed between two frames: ECharts merges the rest from the previous frame. */
function frameDelta(prev: Dict, next: Dict): Dict {
    const delta: Dict = { animation: false };
    Object.keys(next).forEach((key) => {
        if (prev[key] === next[key]) return;
        if (!(COMPONENT_KEYS as readonly string[]).includes(key)) {
            delta[key] = next[key];
            return;
        }
        const prevList = asList(prev[key]);
        delta[key] = asList(next[key]).map((item, index) => {
            const before = prevList[index] as Dict;
            if (item === before || !isDict(item)) return {};
            const changed: Dict = {};
            Object.keys(item).forEach((field) => {
                if (item[field] !== before?.[field]) changed[field] = item[field];
            });
            return changed;
        });
    });
    return delta;
}

/**
 * Mid-morph value axes span fractional ranges, which would put odd numbers on
 * their end labels; those labels are hidden until the range settles.
 */
function withValueAxisEndLabels(option: Dict, target: Dict, settled: boolean): Dict {
    if (option.yAxis === undefined) return option;
    const targetAxes = asList(target.yAxis) as Dict[];
    const axes = asList(option.yAxis).map((axis, index) => {
        const goal = targetAxes[index];
        if (!isDict(axis) || !isDict(goal) || goal.type !== 'value') return axis;
        if (!settled && axis.min === goal.min && axis.max === goal.max) return axis;
        const goalLabel = isDict(goal.axisLabel) ? goal.axisLabel : {};
        return {
            ...axis,
            axisLabel: {
                ...(isDict(axis.axisLabel) ? axis.axisLabel : goalLabel),
                showMinLabel: settled ? (goalLabel.showMinLabel ?? null) : false,
                showMaxLabel: settled ? (goalLabel.showMaxLabel ?? null) : false,
            },
        };
    });
    return { ...option, yAxis: Array.isArray(option.yAxis) ? axes : axes[0] };
}

/**
 * Minimal ECharts binding: one instance per mount, and every later option
 * change is merged into it. (echarts-for-react 3 first renders into a
 * throwaway instance and swaps it out when that one finishes, which replays
 * the entrance animation whenever the option changes during it.)
 *
 * With `morph`, option changes are tweened here frame by frame (axis ranges,
 * series values, everything numeric) instead of by ECharts, whose line
 * animation gives up and snaps once the line moves more than 3000px — as it
 * does whenever an axis range zooms across a long history.
 */
export default function EChart({
    option,
    onEvents,
    morph = false,
    style,
    className,
}: {
    option: Option;
    onEvents?: Record<string, EventHandler>;
    morph?: boolean;
    style?: CSSProperties;
    className?: string;
}) {
    const hostRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<echarts.ECharts | null>(null);
    const targetRef = useRef<Option | null>(null);
    /** What is on screen: the target, or the current blend while morphing. */
    const shownRef = useRef<Option | null>(null);
    const onScreenRef = useRef(true);
    const eventsRef = useRef(onEvents);
    useLayoutEffect(() => {
        eventsRef.current = onEvents;
    });
    const eventNames = Object.keys(onEvents ?? {}).sort().join(',');

    useLayoutEffect(() => {
        const host = hostRef.current;
        if (!host) return undefined;
        const chart = echarts.init(host);
        chartRef.current = chart;
        chart.setOption(option);
        targetRef.current = option;
        shownRef.current = option;

        // Resizing cuts running animations, so only resize when the size really changed.
        let width = chart.getWidth();
        let height = chart.getHeight();
        let frame = 0;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (host.clientWidth === width && host.clientHeight === height) return;
                width = host.clientWidth;
                height = host.clientHeight;
                chart.resize();
            });
        });
        observer.observe(host);
        const visibility = new IntersectionObserver(([entry]) => {
            onScreenRef.current = entry.isIntersecting;
        });
        visibility.observe(host);

        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            visibility.disconnect();
            chart.dispose();
            chartRef.current = null;
            targetRef.current = null;
            shownRef.current = null;
        };
        // The instance lives for the whole mount; option changes are applied below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useLayoutEffect(() => {
        const chart = chartRef.current;
        const from = shownRef.current;
        if (!chart || !from || targetRef.current === option) return undefined;
        targetRef.current = option;

        const final = morph ? withValueAxisEndLabels(option as Dict, option as Dict, true) : option;
        const settle = () => {
            chart.setOption(final);
            shownRef.current = option;
        };
        if (!onScreenRef.current) {
            // Nobody sees an off-screen chart animate; draw the end state once.
            chart.setOption({ ...final, animation: false });
            chart.setOption({ animation: (option as Dict).animation !== false });
            shownRef.current = option;
            return undefined;
        }
        if (!morph || prefersReducedMotion() || !sameShape(from, option)) {
            settle();
            return undefined;
        }
        return startTween((progress) => {
            const blended = withZoomedXAxes(blend(from, option, progress) as Dict, from as Dict, option as Dict, progress);
            const next = withValueAxisEndLabels(blended, option as Dict, false);
            chart.setOption(frameDelta(shownRef.current as Dict, next), { silent: true });
            shownRef.current = next;
        }, settle);
    }, [option, morph]);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart || !eventNames) return undefined;
        const handlers = eventNames.split(',').map((name) => {
            const handler = (params: unknown) => (eventsRef.current?.[name] as ((p: unknown) => void) | undefined)?.(params);
            chart.on(name, handler);
            return [name, handler] as const;
        });
        return () => handlers.forEach(([name, handler]) => chart.off(name, handler));
    }, [eventNames]);

    return <div ref={hostRef} className={className} style={{ height: 300, ...style }} />;
}
