import { useId, useMemo } from 'react';
import type { AggregatedStats, RosterChangeUma, RosterUpdate } from '../../analytics/types';
import { formatUmaDisplayName } from '../../utils/umaDisplayName';
import { segmentAverage } from '../../utils/segmentAverage';
import { formatRatingHtml } from '../RatingDisplay';
import { tooltipHead, tooltipNote, tooltipRow, tooltipSection } from './chartTooltip';
import { CHART_AXIS_LINE, CHART_COLORS, chartAxisLabel, chartAxisName, type ChartScale } from './chartTheme';

type ScoreTrend = AggregatedStats['scoreTrend'];

/**
 * Plot insets shared by every trend chart. The trend cards stack in one column,
 * so identical left/right insets keep their x axes (and the support-bonus
 * sub-grid) aligned. The right inset is sized for the SOTR axis even on charts
 * that do not draw one.
 */
export function trendGridInsets(scale: ChartScale) {
    return {
        left: scale.px(84),
        right: scale.px(72),
        top: scale.px(14),
        bottom: scale.px(66),
    };
}

const AXIS_LABEL_MARGIN = 8;
/** Space between the widest tick label and the (centred) axis name, in design px. */
const AXIS_NAME_CLEARANCE = 12;
/** Geist Mono advance width as a fraction of font size. */
const MONO_ADVANCE = 0.6;

/**
 * Value-axis name + label styling. The name gap is sized to the widest tick
 * label the range can produce (its end labels), so the name sits a fixed
 * clearance outside the labels instead of clearing a worst case.
 */
export function trendValueAxis(
    scale: ChartScale,
    name: string,
    formatter: (value: number) => string,
    side: 'left' | 'right' = 'left',
    range?: { min: number; max: number },
) {
    const labelChars = range
        ? Math.max(formatter(range.min).length, formatter(range.max).length)
        : 5;
    const nameGap = scale.px(AXIS_LABEL_MARGIN + AXIS_NAME_CLEARANCE)
        + labelChars * MONO_ADVANCE * scale.fs(10.5);
    return {
        type: 'value' as const,
        name,
        nameLocation: 'middle' as const,
        nameRotate: 90,
        nameGap,
        nameTextStyle: chartAxisName(scale),
        axisLabel: chartAxisLabel(scale, {
            align: side === 'left' ? 'right' : 'left',
            margin: scale.px(AXIS_LABEL_MARGIN),
            formatter,
        }),
        axisLine: CHART_AXIS_LINE,
    };
}

/**
 * Trend x axis. Points sit at their index on a value axis rather than a category
 * axis, so the range can take fractional values while it zooms between Recent
 * and Overall; ticks are whole indices labelled with that point's date.
 */
export function trendIndexAxis(
    scale: ChartScale,
    dates: readonly string[],
    view: TrendWindow,
    { gridIndex = 0, showLabels = true }: { gridIndex?: number; showLabels?: boolean } = {},
) {
    const single = view.end <= view.start;
    // Several trials share a day, so neighbouring ticks can carry the same date;
    // ECharts formats ticks in order, so each label is compared with the one before.
    let previousLabel = '';
    const formatter = (value: number, index: number) => {
        const label = dates[Math.round(value)] ?? '';
        if (index === 0) previousLabel = '';
        const shown = label === previousLabel ? '' : label;
        previousLabel = label;
        return shown;
    };
    return {
        type: 'value' as const,
        gridIndex,
        min: single ? view.start - 0.5 : view.start,
        max: single ? view.start + 0.5 : view.end,
        minInterval: 1,
        splitNumber: 7,
        splitLine: { show: false },
        axisLabel: showLabels
            ? chartAxisLabel(scale, {
                showMinLabel: true,
                showMaxLabel: true,
                alignMinLabel: 'left',
                alignMaxLabel: 'right',
                hideOverlap: true,
                margin: scale.px(10),
                formatter,
            })
            : { show: false },
        axisTick: { show: false },
        axisLine: CHART_AXIS_LINE,
        axisPointer: { show: true, snap: true },
    };
}

/** `[index, value]` pairs for series on a `trendIndexAxis`. */
export function indexedPoints<T>(values: readonly T[]): [number, T][] {
    return values.map((value, index) => [index, value]);
}

/** Short axis tick text ("310k", "12.5k") so tick labels never crowd the axis name. */
export function compactAxisNumber(value: number): string {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${parseFloat((value / 1_000_000).toFixed(2))}M`;
    if (abs >= 1_000) return `${parseFloat((value / 1_000).toFixed(1))}k`;
    return String(parseFloat(value.toFixed(2)));
}

export function formatChartDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return isoDate;
    return `${month}/${day}/${year}`;
}

function formatRosterUmaLine(uma: RosterChangeUma, sign: '-' | '+'): string {
    const name = formatUmaDisplayName(uma.charaName, uma.cardId);
    const text = `${sign} ${name} · ${formatRatingHtml(uma.rankScore)}`;
    const color = sign === '-' ? CHART_COLORS.rosterRemoved : CHART_COLORS.rosterAdded;
    return `<span style="color:${color}">${text}</span>`;
}

export function formatRosterUpdateHtml(update: RosterUpdate): string {
    const lines = [`<span style="color:${CHART_COLORS.text};font-weight:600">Roster Updated</span>`];
    update.removed.forEach((uma) => lines.push(formatRosterUmaLine(uma, '-')));
    update.added.forEach((uma) => lines.push(formatRosterUmaLine(uma, '+')));
    return lines.join('<br/>');
}

export function rosterUpdateIndices(scoreTrend: ScoreTrend): number[] {
    return scoreTrend
        .map((point, index) => (point.rosterUpdate ? index : -1))
        .filter((index) => index >= 0);
}

/**
 * The slice of a trend a chart shows. When the visible trend is a contiguous run
 * of a longer source (Recent inside Overall), the chart plots the whole source
 * and frames the run with the x-axis range: switching scope then keeps every
 * point, so the lines slide in and out of view instead of being rebuilt.
 */
export type TrendWindow = {
    trend: ScoreTrend;
    start: number;
    end: number;
    /** True when `trend` is the longer source rather than the visible trend itself. */
    windowed: boolean;
};

export function useTrendWindow(visible: ScoreTrend, source?: ScoreTrend): TrendWindow {
    return useMemo(() => {
        const own = { trend: visible, start: 0, end: Math.max(0, visible.length - 1), windowed: false };
        if (!source || source === visible || visible.length === 0 || source.length < visible.length) return own;
        const start = source.findIndex((point) => point.fileName === visible[0].fileName);
        if (start < 0 || start + visible.length > source.length) return own;
        for (let i = 0; i < visible.length; i += 1) {
            if (source[start + i].fileName !== visible[i].fileName) return own;
        }
        return { trend: source, start, end: start + visible.length - 1, windowed: true };
    }, [visible, source]);
}

export function sliceTrendWindow<T>(values: readonly T[], view: TrendWindow): T[] {
    return values.slice(view.start, view.end + 1);
}

/**
 * Roster-segment averages for the window: segments are cut at the window edges,
 * so the first one only averages what is in view. Points outside the window keep
 * their full-history average, which they slide toward as they leave the view.
 */
export function windowedSegmentAverage(
    values: Array<number | null | undefined>,
    view: TrendWindow,
): (number | null)[] {
    const boundaries = rosterUpdateIndices(view.trend);
    const full = segmentAverage(values, boundaries);
    if (view.start === 0 && view.end === values.length - 1) return full;
    const inner = segmentAverage(
        values.slice(view.start, view.end + 1),
        boundaries.map((index) => index - view.start),
    );
    return full.map((value, index) => (
        index >= view.start && index <= view.end ? inner[index - view.start] : value
    ));
}

/**
 * Dashed vertical line at each roster update. Drawn by a clipped custom series
 * rather than a markLine, which ECharts never clips, so markers outside the
 * window stay hidden and slide with the data. The axis tooltip lists the change.
 */
const ROSTER_SERIES_NAME = '__roster_updates__';

export function buildRosterMarkerSeries(scoreTrend: ScoreTrend, xAxisIndex = 0, yAxisIndex = 0) {
    const indices = rosterUpdateIndices(scoreTrend);
    if (indices.length === 0) return null;
    return {
        name: ROSTER_SERIES_NAME,
        type: 'custom' as const,
        xAxisIndex,
        yAxisIndex,
        data: indices.map((index) => [index, 0]),
        encode: { x: 0, y: 1 },
        clip: true,
        silent: true,
        tooltip: { show: false },
        z: 10,
        renderItem: (
            params: { coordSys: unknown },
            api: { value: (dim: number) => number; coord: (point: number[]) => number[] },
        ) => {
            const area = params.coordSys as { y: number; height: number };
            const x = api.coord([api.value(0), 0])[0];
            return {
                type: 'line',
                shape: { x1: x, y1: area.y, x2: x, y2: area.y + area.height },
                style: { stroke: CHART_COLORS.rosterMark, lineWidth: 1, lineDash: [4, 4] },
            };
        },
    };
}

type TooltipItem = {
    seriesName?: string;
    marker?: string;
    value?: number | null | (number | null)[];
    dataIndex?: number;
    seriesIndex?: number;
};

/**
 * Axis tooltip: date header, aligned series rows, optional footer + roster changes.
 * Rows follow series order; ECharts otherwise lists the hovered grid's series first.
 */
export function buildTrendTooltipFormatter(
    scoreTrend: ScoreTrend,
    formatValue: (seriesName: string | undefined, value: number) => string,
    footer?: (point: ScoreTrend[number]) => string | undefined,
) {
    return (params: unknown) => {
        const items = ((Array.isArray(params) ? params : [params]) as TooltipItem[])
            .filter((item) => item.seriesName !== ROSTER_SERIES_NAME);
        if (items.length === 0) return '';
        const dataIndex = items[0].dataIndex;
        const point = dataIndex != null ? scoreTrend[dataIndex] : undefined;
        const header = point ? formatChartDate(point.date) : '';
        const rows = items
            .map((item) => ({ ...item, value: Array.isArray(item.value) ? item.value[1] : item.value }))
            .filter((item) => item.value != null && Number.isFinite(item.value))
            .sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0))
            .map((item) => tooltipRow(
                `${item.marker ?? ''}${item.seriesName ?? ''}`,
                formatValue(item.seriesName, item.value as number),
            ));
        const parts = [tooltipHead(header), ...rows];
        const footerText = point && footer ? footer(point) : undefined;
        if (footerText) parts.push(tooltipNote(footerText));
        if (point?.rosterUpdate) parts.push(tooltipSection(formatRosterUpdateHtml(point.rosterUpdate)));
        return parts.join('');
    };
}

export function TrendNumberInput({
    label,
    value,
    max,
    onChange,
}: {
    label: string;
    value: number;
    max: number;
    onChange: (value: number) => void;
}) {
    const id = useId();
    return (
        <label className="chart-field" htmlFor={id}>
            <span className="chart-field-label">{label}</span>
            <input
                id={id}
                type="number"
                min={1}
                max={max}
                value={value}
                onChange={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next) && next >= 1) onChange(next);
                }}
                className="chart-field-input"
            />
        </label>
    );
}
