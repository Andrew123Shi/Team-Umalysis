import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Form } from 'react-bootstrap';
import type { AggregatedStats, RosterUpdate } from '../../analytics/types';
import { collectAllAxisValues, collectVisibleAxisValues, isLegendSeriesVisible, type LegendSelectChangedEvent } from './chartLegendScale';
import { rollingAverageForVisibleWindow } from '../../utils/rollingAverage';
import { segmentAverage } from '../../utils/segmentAverage';
import { formatUmaDisplayName } from '../../utils/umaDisplayName';
import { formatRatingHtml } from '../RatingDisplay';
import { chartTooltipStyle } from './chartTooltip';
import { CHART_UPDATE_ANIMATION } from './chartLayout';
import SectionHeading from '../SectionHeading';

const GRID_LEFT = 82;
const GRID_RIGHT = 72;
const TRIAL_WIN_RATE_LABEL = 'Overall Win Rate';
const RACE_WIN_RATE_LABEL = 'Race Win Rate';
const WIN_RATE_LABEL = 'Win Rate';
const ROSTER_AVG_LABEL = 'Roster Average';
const DEFAULT_WINDOW = 100;
/** Skip early rolling-window warmup when auto-scaling the Y axis. */
const Y_SCALE_WARMUP_POINTS = 10;

function formatWinRatePercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

function snapWinRateYRange(values: number[]): { min: number; max: number } {
    const finite = values.filter((v) => Number.isFinite(v));
    if (finite.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    let snappedMin = Math.floor(min * 20) / 20;
    let snappedMax = Math.ceil(max * 20) / 20;
    if (snappedMax - snappedMin < 0.1) {
        snappedMin -= 0.05;
        snappedMax += 0.05;
    }
    snappedMin = Math.max(0, snappedMin);
    snappedMax = Math.min(1, Math.max(snappedMax, snappedMin + 0.05));
    return { min: snappedMin, max: snappedMax };
}

function collectWinRateScaleValues(
    series: { name: string; yAxisIndex: number; data: readonly (number | null | undefined)[] }[],
    selected: Record<string, boolean>,
    options: { filterLegend: boolean; skipFirst: number },
): number[] {
    const values: number[] = [];
    series.forEach((s) => {
        if (s.yAxisIndex !== 0) return;
        if (options.filterLegend && !isLegendSeriesVisible(selected, s.name)) return;
        s.data.forEach((v, i) => {
            if (i < options.skipFirst) return;
            if (v != null && Number.isFinite(v)) values.push(v);
        });
    });
    return values;
}

function formatChartDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return isoDate;
    return `${month}/${day}/${year}`;
}

function formatRosterUmaLine(uma: { charaName: string; cardId: number; rankScore: number }, sign: '-' | '+'): string {
    const name = formatUmaDisplayName(uma.charaName, uma.cardId);
    const text = `${sign} ${name} · ${formatRatingHtml(uma.rankScore)}`;
    const color = sign === '-' ? '#ea868f' : '#75b798';
    return `<span style="color:${color}">${text}</span>`;
}

function formatRosterUpdateHtml(update: RosterUpdate): string {
    const lines = ['<b>Roster Updated:</b>'];
    update.removed.forEach((uma) => lines.push(formatRosterUmaLine(uma, '-')));
    update.added.forEach((uma) => lines.push(formatRosterUmaLine(uma, '+')));
    return lines.join('<br/>');
}

function lookbackSeriesLabel(base: string, windowSize: number): string {
    return `${base} (Last ${Math.max(1, Math.floor(windowSize))})`;
}

function buildTooltipFormatter(scoreTrend: AggregatedStats['scoreTrend']) {
    return (params: unknown) => {
        const items = (Array.isArray(params) ? params : [params]) as {
            axisValue?: string;
            seriesName?: string;
            marker?: string;
            value?: number | null;
            dataIndex?: number;
        }[];
        if (items.length === 0) return '';
        const header = items[0].axisValue ?? '';
        const dataIndex = items[0].dataIndex;
        const lines = items.map((item) => {
            const val = item.value;
            if (val == null || !Number.isFinite(val)) return '';
            return `${item.marker ?? ''}${item.seriesName ?? ''}: ${formatWinRatePercent(val)}`;
        }).filter(Boolean);
        const trendPoint = dataIndex != null ? scoreTrend[dataIndex] : undefined;
        const rosterUpdate = trendPoint?.rosterUpdate;
        const parts = [`<b>${header}</b>`, ...lines.map((line) => `<b>${line}</b>`)];
        if (rosterUpdate) {
            parts.push('');
            parts.push(formatRosterUpdateHtml(rosterUpdate));
        }
        return parts.join('<br/>');
    };
}

function buildRosterMarkLine(
    markLines: { xAxis: number }[],
    scoreTrend: AggregatedStats['scoreTrend'],
) {
    if (markLines.length === 0) return undefined;
    return {
        symbol: 'none',
        silent: false,
        label: { show: false },
        lineStyle: { color: 'rgba(234, 134, 143, 0.45)', width: 1, type: 'dashed' as const },
        emphasis: { lineStyle: { width: 1.5, color: 'rgba(234, 134, 143, 0.7)' } },
        tooltip: {
            ...chartTooltipStyle,
            show: true,
            formatter: (params: { data?: { xAxis?: number } }) => {
                const dataIndex = params.data?.xAxis;
                const update = dataIndex != null ? scoreTrend[dataIndex]?.rosterUpdate : undefined;
                if (!update) return '';
                return formatRosterUpdateHtml(update);
            },
        },
        data: markLines,
    };
}

function buildRosterMarkerSeries(
    rosterMarkLine: ReturnType<typeof buildRosterMarkLine>,
    pointCount: number,
) {
    if (!rosterMarkLine) return null;
    return {
        name: '__roster_updates__',
        type: 'line' as const,
        data: Array.from({ length: pointCount }, () => null),
        showSymbol: false,
        lineStyle: { opacity: 0, width: 0 },
        itemStyle: { opacity: 0 },
        silent: false,
        tooltip: { show: false },
        emphasis: { disabled: true },
        markLine: rosterMarkLine,
        z: 10,
    };
}

export default function WinRateTrendChart({
    stats,
    sourceTrend,
    showRaceWinRate = false,
    averageSeriesLabel = ROSTER_AVG_LABEL,
}: {
    stats: AggregatedStats;
    /** Full-history trend used to warm-start the rolling window when `stats` is Recent. */
    sourceTrend?: AggregatedStats['scoreTrend'];
    /** Team overview only: also plot per-session race win rate progression. */
    showRaceWinRate?: boolean;
    /** Legend label for the segment/roster average series. */
    averageSeriesLabel?: string;
}) {
    const [windowSize, setWindowSize] = useState(DEFAULT_WINDOW);
    const [forceFullScale, setForceFullScale] = useState(false);
    const [legendSelected, setLegendSelected] = useState<Record<string, boolean>>({});
    const scoreTrend = stats.scoreTrend;
    const hasData = scoreTrend.length > 0;

    const dates = scoreTrend.map((d) => d.date);
    const formattedDates = useMemo(() => dates.map(formatChartDate), [dates]);
    const trendKeys = useMemo(() => scoreTrend.map((d) => d.fileName), [scoreTrend]);
    const trialOutcomes = useMemo(() => scoreTrend.map((d) => (d.won ? 1 : 0)), [scoreTrend]);
    const raceOutcomes = useMemo(
        () => scoreTrend.map((d) => d.raceWinRate ?? 0),
        [scoreTrend],
    );
    const sourceKeys = useMemo(
        () => sourceTrend?.map((d) => d.fileName),
        [sourceTrend],
    );
    const sourceTrialOutcomes = useMemo(
        () => sourceTrend?.map((d) => (d.won ? 1 : 0)),
        [sourceTrend],
    );
    const sourceRaceOutcomes = useMemo(
        () => sourceTrend?.map((d) => d.raceWinRate ?? 0),
        [sourceTrend],
    );

    const rollingTrialWinRate = useMemo(
        () => rollingAverageForVisibleWindow(
            trialOutcomes,
            trendKeys,
            sourceTrialOutcomes,
            sourceKeys,
            windowSize,
        ),
        [trialOutcomes, trendKeys, sourceTrialOutcomes, sourceKeys, windowSize],
    );

    const rollingRaceWinRate = useMemo(
        () => (showRaceWinRate
            ? rollingAverageForVisibleWindow(
                raceOutcomes,
                trendKeys,
                sourceRaceOutcomes,
                sourceKeys,
                windowSize,
            )
            : []),
        [showRaceWinRate, raceOutcomes, trendKeys, sourceRaceOutcomes, sourceKeys, windowSize],
    );

    const rosterBoundaryIndices = useMemo(
        () => scoreTrend
            .map((point, index) => (point.rosterUpdate ? index : -1))
            .filter((index) => index >= 0),
        [scoreTrend],
    );
    const rosterAverage = useMemo(
        () => segmentAverage(trialOutcomes, rosterBoundaryIndices),
        [trialOutcomes, rosterBoundaryIndices],
    );

    const primaryLabelBase = showRaceWinRate ? TRIAL_WIN_RATE_LABEL : WIN_RATE_LABEL;
    const trialWinRateLabel = useMemo(
        () => lookbackSeriesLabel(primaryLabelBase, windowSize),
        [primaryLabelBase, windowSize],
    );
    const raceWinRateLabel = useMemo(
        () => lookbackSeriesLabel(RACE_WIN_RATE_LABEL, windowSize),
        [windowSize],
    );

    const legendSeries = useMemo(() => {
        const series = [
            { name: trialWinRateLabel, yAxisIndex: 0, data: rollingTrialWinRate },
        ];
        if (showRaceWinRate) {
            series.push({ name: raceWinRateLabel, yAxisIndex: 0, data: rollingRaceWinRate });
        }
        series.push({ name: averageSeriesLabel, yAxisIndex: 0, data: rosterAverage });
        return series;
    }, [
        trialWinRateLabel,
        raceWinRateLabel,
        showRaceWinRate,
        rollingTrialWinRate,
        rollingRaceWinRate,
        rosterAverage,
        averageSeriesLabel,
    ]);

    useEffect(() => {
        setLegendSelected({});
    }, [trialWinRateLabel, raceWinRateLabel, showRaceWinRate, averageSeriesLabel]);

    const yRange = useMemo(() => {
        if (forceFullScale) return { min: 0, max: 1 };

        const afterWarmupVisible = collectWinRateScaleValues(legendSeries, legendSelected, {
            filterLegend: true,
            skipFirst: Y_SCALE_WARMUP_POINTS,
        });
        if (afterWarmupVisible.length > 0) return snapWinRateYRange(afterWarmupVisible);

        const afterWarmupAll = collectWinRateScaleValues(legendSeries, legendSelected, {
            filterLegend: false,
            skipFirst: Y_SCALE_WARMUP_POINTS,
        });
        if (afterWarmupAll.length > 0) return snapWinRateYRange(afterWarmupAll);

        const visible = collectVisibleAxisValues(legendSeries, legendSelected, 0);
        const fallback = collectAllAxisValues(legendSeries, 0);
        return snapWinRateYRange(visible.length > 0 ? visible : fallback);
    }, [forceFullScale, legendSeries, legendSelected]);

    const onEvents = useMemo(() => ({
        legendselectchanged: (params: LegendSelectChangedEvent) => {
            setLegendSelected(params.selected);
        },
    }), []);

    const rosterUpdateMarkLines = useMemo(
        () => scoreTrend
            .map((point, index) => (point.rosterUpdate ? { xAxis: index } : null))
            .filter((line): line is { xAxis: number } => line !== null),
        [scoreTrend],
    );

    const dateInterval = dates.length > 12 ? Math.ceil(dates.length / 8) - 1 : 0;

    const option = useMemo(() => {
        const rosterMarkLine = buildRosterMarkLine(rosterUpdateMarkLines, scoreTrend);
        const rosterMarkerSeries = buildRosterMarkerSeries(rosterMarkLine, formattedDates.length);
        const legendData = showRaceWinRate
            ? [trialWinRateLabel, raceWinRateLabel, averageSeriesLabel]
            : [trialWinRateLabel, averageSeriesLabel];
        const trialVisible = isLegendSeriesVisible(legendSelected, trialWinRateLabel);
        const raceVisible = showRaceWinRate && isLegendSeriesVisible(legendSelected, raceWinRateLabel);
        const rosterAvgVisible = isLegendSeriesVisible(legendSelected, averageSeriesLabel);

        return {
            backgroundColor: 'transparent',
            ...CHART_UPDATE_ANIMATION,
            axisPointer: {
                link: [{ xAxisIndex: [0] }],
                animation: false,
                lineStyle: { color: '#6c757d', type: 'dashed' },
            },
            tooltip: {
                ...chartTooltipStyle,
                trigger: 'axis',
                axisPointer: {
                    type: 'line',
                    animation: false,
                    snap: true,
                    lineStyle: { color: '#adb5bd', type: 'dashed' },
                },
                formatter: buildTooltipFormatter(scoreTrend),
            },
            legend: {
                data: legendData,
                selected: legendSelected,
                textStyle: { color: '#ced4da' },
                bottom: 0,
                itemWidth: 24,
                itemHeight: 2,
                icon: 'rect',
            },
            grid: {
                left: GRID_LEFT,
                right: GRID_RIGHT,
                top: 16,
                bottom: 48,
                containLabel: false,
            },
            xAxis: {
                type: 'category',
                data: formattedDates,
                boundaryGap: false,
                axisLabel: {
                    color: '#ced4da',
                    interval: dateInterval,
                    showMinLabel: true,
                    showMaxLabel: true,
                    alignMinLabel: 'left',
                    alignMaxLabel: 'right',
                },
                axisTick: { alignWithLabel: true },
                axisPointer: { show: true },
            },
            yAxis: {
                type: 'value',
                name: 'Win Rate',
                nameLocation: 'middle',
                nameRotate: 90,
                nameGap: 50,
                min: yRange.min,
                max: yRange.max,
                axisLabel: {
                    color: '#ced4da',
                    fontSize: 11,
                    width: 72,
                    align: 'right',
                    margin: 4,
                    formatter: (value: number) => formatWinRatePercent(value),
                },
                splitLine: {
                    show: trialVisible || raceVisible || rosterAvgVisible,
                    lineStyle: { color: '#343a40' },
                },
                axisLine: { show: true, lineStyle: { color: '#6c757d' } },
            },
            series: [
                {
                    name: trialWinRateLabel,
                    type: 'line',
                    data: rollingTrialWinRate,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: '#6ea8fe' },
                    lineStyle: { width: 2, type: 'solid' },
                    z: 3,
                },
                ...(showRaceWinRate ? [{
                    name: raceWinRateLabel,
                    type: 'line' as const,
                    data: rollingRaceWinRate,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: '#75b798' },
                    lineStyle: { width: 2, type: 'solid' as const },
                    z: 4,
                }] : []),
                {
                    name: averageSeriesLabel,
                    type: 'line',
                    data: rosterAverage,
                    step: 'end',
                    showSymbol: false,
                    itemStyle: { color: '#ffffff' },
                    lineStyle: { width: 2, type: 'dashed' },
                    z: 5,
                },
                ...(rosterMarkerSeries ? [rosterMarkerSeries] : []),
            ],
        };
    }, [
        formattedDates,
        dateInterval,
        trialWinRateLabel,
        raceWinRateLabel,
        showRaceWinRate,
        averageSeriesLabel,
        yRange,
        rosterUpdateMarkLines,
        scoreTrend,
        rollingTrialWinRate,
        rollingRaceWinRate,
        rosterAverage,
        legendSelected,
    ]);

    if (!hasData) return null;

    return (
        <div className="win-rate-trend-chart">
            <SectionHeading title="Win Rate Progression" compact className="mt-0 is-tight-below" />
            <div className="win-rate-trend-chart-controls">
                <div className="win-rate-trend-full-scale-row">
                    <label
                        htmlFor="win-rate-force-full-scale"
                        className="win-rate-trend-full-scale-check"
                    >
                        <span>Force 100%</span>
                        <input
                            type="checkbox"
                            id="win-rate-force-full-scale"
                            className="form-check-input"
                            checked={forceFullScale}
                            onChange={(event) => setForceFullScale(event.target.checked)}
                        />
                    </label>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <Form.Label className="text-secondary small mb-0">Lookback Period</Form.Label>
                    <Form.Control
                        type="number"
                        min={1}
                        max={500}
                        value={windowSize}
                        onChange={(e) => {
                            const next = Number(e.target.value);
                            if (Number.isFinite(next) && next >= 1) setWindowSize(next);
                        }}
                        style={{ width: '5rem' }}
                        size="sm"
                    />
                </div>
            </div>
            <ReactECharts option={option} onEvents={onEvents} style={{ height: 280 }} />
        </div>
    );
}
