import { memo, useEffect, useId, useMemo, useState } from 'react';
import EChart from './EChart';
import type { AggregatedStats } from '../../analytics/types';
import { collectAllAxisValues, collectVisibleAxisValues, isLegendSeriesVisible, type LegendSelectChangedEvent } from './chartLegendScale';
import { rollingAverage, rollingAverageForVisibleWindow } from '../../utils/rollingAverage';
import { chartTooltipStyle } from './chartTooltip';
import { CHART_UPDATE_ANIMATION } from './chartLayout';
import {
    CHART_COLORS,
    CHART_SPLIT_LINE,
    CHART_TEXT_STYLE,
    chartLegend,
    useChartScale,
} from './chartTheme';
import {
    buildRosterMarkerSeries,
    buildTrendTooltipFormatter,
    formatChartDate,
    indexedPoints,
    sliceTrendWindow,
    trendGridInsets,
    trendIndexAxis,
    trendValueAxis,
    TrendNumberInput,
    useTrendWindow,
    windowedSegmentAverage,
} from './trendChartShared';
import SectionHeading from '../SectionHeading';

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

function formatWinRateTick(value: number): string {
    return `${parseFloat((value * 100).toFixed(1))}%`;
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

function lookbackSeriesLabel(base: string, windowSize: number): string {
    return `${base} (Last ${Math.max(1, Math.floor(windowSize))})`;
}

function WinRateTrendChart({
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
    const scale = useChartScale();
    const fullScaleId = useId();
    const [windowSize, setWindowSize] = useState(DEFAULT_WINDOW);
    const [forceFullScale, setForceFullScale] = useState(false);
    const [legendSelected, setLegendSelected] = useState<Record<string, boolean>>({});
    const view = useTrendWindow(stats.scoreTrend, sourceTrend);
    const scoreTrend = view.trend;
    const hasData = scoreTrend.length > 0;

    const formattedDates = useMemo(() => scoreTrend.map((d) => formatChartDate(d.date)), [scoreTrend]);
    const trialOutcomes = useMemo(() => scoreTrend.map((d) => (d.won ? 1 : 0)), [scoreTrend]);
    const raceOutcomes = useMemo(
        () => scoreTrend.map((d) => d.raceWinRate ?? 0),
        [scoreTrend],
    );

    const rollingTrialWinRate = useMemo(() => {
        if (view.windowed || !sourceTrend) return rollingAverage(trialOutcomes, windowSize);
        return rollingAverageForVisibleWindow(
            trialOutcomes,
            scoreTrend.map((d) => d.fileName),
            sourceTrend.map((d) => (d.won ? 1 : 0)),
            sourceTrend.map((d) => d.fileName),
            windowSize,
        );
    }, [view, sourceTrend, trialOutcomes, scoreTrend, windowSize]);

    const rollingRaceWinRate = useMemo(() => {
        if (!showRaceWinRate) return [];
        if (view.windowed || !sourceTrend) return rollingAverage(raceOutcomes, windowSize);
        return rollingAverageForVisibleWindow(
            raceOutcomes,
            scoreTrend.map((d) => d.fileName),
            sourceTrend.map((d) => d.raceWinRate ?? 0),
            sourceTrend.map((d) => d.fileName),
            windowSize,
        );
    }, [showRaceWinRate, view, sourceTrend, raceOutcomes, scoreTrend, windowSize]);

    const rosterAverage = useMemo(
        () => windowedSegmentAverage(trialOutcomes, view),
        [trialOutcomes, view],
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

    // Axis ranges only consider the points in view.
    const legendSeries = useMemo(() => {
        const series = [
            { name: trialWinRateLabel, yAxisIndex: 0, data: sliceTrendWindow(rollingTrialWinRate, view) },
        ];
        if (showRaceWinRate) {
            series.push({ name: raceWinRateLabel, yAxisIndex: 0, data: sliceTrendWindow(rollingRaceWinRate, view) });
        }
        series.push({ name: averageSeriesLabel, yAxisIndex: 0, data: sliceTrendWindow(rosterAverage, view) });
        return series;
    }, [
        trialWinRateLabel,
        raceWinRateLabel,
        showRaceWinRate,
        rollingTrialWinRate,
        rollingRaceWinRate,
        rosterAverage,
        averageSeriesLabel,
        view,
    ]);
    const warmupPoints = Math.max(0, Y_SCALE_WARMUP_POINTS - view.start);

    useEffect(() => {
        setLegendSelected({});
    }, [trialWinRateLabel, raceWinRateLabel, showRaceWinRate, averageSeriesLabel]);

    const yRange = useMemo(() => {
        if (forceFullScale) return { min: 0, max: 1 };

        const afterWarmupVisible = collectWinRateScaleValues(legendSeries, legendSelected, {
            filterLegend: true,
            skipFirst: warmupPoints,
        });
        if (afterWarmupVisible.length > 0) return snapWinRateYRange(afterWarmupVisible);

        const afterWarmupAll = collectWinRateScaleValues(legendSeries, legendSelected, {
            filterLegend: false,
            skipFirst: warmupPoints,
        });
        if (afterWarmupAll.length > 0) return snapWinRateYRange(afterWarmupAll);

        const visible = collectVisibleAxisValues(legendSeries, legendSelected, 0);
        const fallback = collectAllAxisValues(legendSeries, 0);
        return snapWinRateYRange(visible.length > 0 ? visible : fallback);
    }, [forceFullScale, legendSeries, legendSelected, warmupPoints]);

    const onEvents = useMemo(() => ({
        legendselectchanged: (params: LegendSelectChangedEvent) => {
            setLegendSelected(params.selected);
        },
    }), []);

    const trialPoints = useMemo(() => indexedPoints(rollingTrialWinRate), [rollingTrialWinRate]);
    const racePoints = useMemo(() => indexedPoints(rollingRaceWinRate), [rollingRaceWinRate]);
    const rosterPoints = useMemo(() => indexedPoints(rosterAverage), [rosterAverage]);
    const chartHeight = scale.px(320);

    const option = useMemo(() => {
        const rosterMarkerSeries = buildRosterMarkerSeries(scoreTrend);
        const legendData = showRaceWinRate
            ? [trialWinRateLabel, raceWinRateLabel, averageSeriesLabel]
            : [trialWinRateLabel, averageSeriesLabel];
        const trialVisible = isLegendSeriesVisible(legendSelected, trialWinRateLabel);
        const raceVisible = showRaceWinRate && isLegendSeriesVisible(legendSelected, raceWinRateLabel);
        const rosterAvgVisible = isLegendSeriesVisible(legendSelected, averageSeriesLabel);

        return {
            backgroundColor: 'transparent',
            textStyle: CHART_TEXT_STYLE,
            ...CHART_UPDATE_ANIMATION,
            axisPointer: {
                link: [{ xAxisIndex: [0] }],
                animation: false,
                lineStyle: { color: CHART_COLORS.pointer, type: 'dashed' },
            },
            tooltip: {
                ...chartTooltipStyle,
                trigger: 'axis',
                axisPointer: {
                    type: 'line',
                    animation: false,
                    snap: true,
                    lineStyle: { color: CHART_COLORS.pointer, type: 'dashed' },
                },
                formatter: buildTrendTooltipFormatter(scoreTrend, (_name, value) => formatWinRatePercent(value)),
            },
            legend: chartLegend(scale, { data: legendData, selected: legendSelected }),
            grid: { ...trendGridInsets(scale), containLabel: false },
            xAxis: trendIndexAxis(scale, formattedDates, view),

            yAxis: {
                ...trendValueAxis(scale, 'Win Rate', formatWinRateTick, 'left', yRange),
                min: yRange.min,
                max: yRange.max,
                splitLine: { ...CHART_SPLIT_LINE, show: trialVisible || raceVisible || rosterAvgVisible },
            },
            series: [
                {
                    name: trialWinRateLabel,
                    type: 'line',
                    data: trialPoints,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: CHART_COLORS.primary },
                    lineStyle: { width: 2, type: 'solid' },
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(77, 159, 255, 0.14)' },
                                { offset: 1, color: 'rgba(77, 159, 255, 0)' },
                            ],
                        },
                    },
                    z: 3,
                },
                ...(showRaceWinRate ? [{
                    name: raceWinRateLabel,
                    type: 'line' as const,
                    data: racePoints,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: CHART_COLORS.positive },
                    lineStyle: { width: 2, type: 'solid' as const },
                    z: 4,
                }] : []),
                {
                    name: averageSeriesLabel,
                    type: 'line',
                    data: rosterPoints,
                    step: 'end',
                    showSymbol: false,
                    itemStyle: { color: CHART_COLORS.average },
                    lineStyle: { width: 1.5, type: [4, 4], opacity: 0.85 },
                    z: 5,
                },
                ...(rosterMarkerSeries ? [rosterMarkerSeries] : []),
            ],
        };
    }, [
        formattedDates,
        trialWinRateLabel,
        raceWinRateLabel,
        showRaceWinRate,
        averageSeriesLabel,
        yRange,
        view,
        scoreTrend,
        trialPoints,
        racePoints,
        rosterPoints,
        legendSelected,
        scale,
    ]);

    if (!hasData) return null;

    return (
        <div className="chart-block win-rate-trend-chart">
            <SectionHeading
                title="Win Rate Progression"
                compact
                actions={(
                    <div className="chart-tools">
                        <label htmlFor={fullScaleId} className="chart-check">
                            <span>Force 0–100%</span>
                            <input
                                type="checkbox"
                                id={fullScaleId}
                                className="form-check-input"
                                checked={forceFullScale}
                                onChange={(event) => setForceFullScale(event.target.checked)}
                            />
                        </label>
                        <TrendNumberInput label="Lookback" value={windowSize} max={500} onChange={setWindowSize} />
                    </div>
                )}
            />
            <EChart morph option={option} onEvents={onEvents} style={{ height: chartHeight }} />
        </div>
    );
}

export default memo(WinRateTrendChart);
