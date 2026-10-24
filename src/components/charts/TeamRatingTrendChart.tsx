import { memo, useEffect, useMemo, useState } from 'react';
import EChart from './EChart';
import type { AggregatedStats } from '../../analytics/types';
import { collectAllAxisValues, collectVisibleAxisValues, isLegendSeriesVisible, type LegendSelectChangedEvent } from './chartLegendScale';
import { formatScore } from '../../utils/formatScore';
import { ema, emaForVisibleWindow, emaLineFadeColor } from '../../utils/ema';
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
    compactAxisNumber,
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
import { useLoadingRemainingFiles } from '../RemainingFilesLoadingAlert';

const RATING_Y_STEP = 10_000;
const GRID_SPLIT_NUMBER = 5;
const SOTR_LABEL = 'Score / Team Rating (SOTR)';
const OWN_TEAM_RATING_LABEL = 'Own Team Rating';
const OPPONENT_TEAM_RATING_LABEL = 'Opponent Team Rating';
const SEGMENT_AVG_LABEL = 'Roster Average';

function sotrEmaLabel(period: number): string {
    return `SOTR EMA ${Math.max(1, Math.floor(period))}`;
}

function snapRatingYRange(...series: number[][]): { min: number; max: number } {
    const values = series.flat().filter((v) => Number.isFinite(v));
    if (values.length === 0) return { min: 0, max: RATING_Y_STEP };
    const min = Math.min(...values);
    const max = Math.max(...values);
    let snappedMin = Math.floor(min / RATING_Y_STEP) * RATING_Y_STEP;
    let snappedMax = Math.ceil(max / RATING_Y_STEP) * RATING_Y_STEP;
    if (snappedMin === snappedMax) {
        snappedMin -= RATING_Y_STEP;
        snappedMax += RATING_Y_STEP;
    }
    return { min: snappedMin, max: snappedMax };
}

function snapRatioYRange(values: number[]): { min: number; max: number } {
    const finite = values.filter((v) => Number.isFinite(v));
    if (finite.length === 0) return { min: 0, max: 1 };
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    let snappedMin = Math.floor(min * 10) / 10;
    let snappedMax = Math.ceil(max * 10) / 10;
    if (snappedMax - snappedMin < 0.1) {
        snappedMin -= 0.05;
        snappedMax += 0.05;
    }
    return { min: snappedMin, max: snappedMax };
}

function sotrRatio(point: AggregatedStats['scoreTrend'][number]): number | null {
    if (point.selfTeamRating <= 0) return null;
    return point.teamScore / point.selfTeamRating;
}

function TeamRatingTrendChart({
    stats,
    emaSourceTrend,
}: {
    stats: AggregatedStats;
    /** Full-history trend used to warm-start EMA when `stats` is a Recent window. */
    emaSourceTrend?: AggregatedStats['scoreTrend'];
}) {
    const loadingRemaining = useLoadingRemainingFiles();
    const scale = useChartScale();
    const [emaPeriod, setEmaPeriod] = useState(50);
    const [legendSelected, setLegendSelected] = useState<Record<string, boolean>>({});
    const source = loadingRemaining ? undefined : emaSourceTrend;
    const view = useTrendWindow(stats.scoreTrend, source);
    const scoreTrend = view.trend;
    const hasData = scoreTrend.length > 0;

    const formattedDates = useMemo(() => scoreTrend.map((d) => formatChartDate(d.date)), [scoreTrend]);
    const selfRatings = useMemo(() => scoreTrend.map((d) => d.selfTeamRating), [scoreTrend]);
    const opponentRatings = useMemo(() => scoreTrend.map((d) => d.opponentTeamRating), [scoreTrend]);
    const scoreToRatingRatios = useMemo(() => scoreTrend.map(sotrRatio), [scoreTrend]);
    const scoreRatioSegmentAvg = useMemo(
        () => windowedSegmentAverage(scoreToRatingRatios, view),
        [scoreToRatingRatios, view],
    );
    const rosterAverageSeed = useMemo(() => {
        if (!loadingRemaining) return undefined;
        const seed = scoreRatioSegmentAvg[0];
        return seed != null && Number.isFinite(seed) ? seed : undefined;
    }, [loadingRemaining, scoreRatioSegmentAvg]);
    const scoreRatioEma = useMemo(
        () => {
            const ratios = scoreToRatingRatios.map((r) => r ?? 0);
            if (loadingRemaining) return ema(ratios, emaPeriod, rosterAverageSeed);
            if (view.windowed || !source) return ema(ratios, emaPeriod);
            return emaForVisibleWindow(
                ratios,
                scoreTrend.map((d) => d.fileName),
                source.map((d) => sotrRatio(d) ?? 0),
                source.map((d) => d.fileName),
                emaPeriod,
            );
        },
        [loadingRemaining, scoreToRatingRatios, emaPeriod, rosterAverageSeed, view, source, scoreTrend],
    );
    const emaLabel = sotrEmaLabel(emaPeriod);

    // Axis ranges only consider the points in view.
    const legendSeries = useMemo(() => [
        { name: OWN_TEAM_RATING_LABEL, yAxisIndex: 0, data: sliceTrendWindow(selfRatings, view) },
        { name: OPPONENT_TEAM_RATING_LABEL, yAxisIndex: 0, data: sliceTrendWindow(opponentRatings, view) },
        { name: SOTR_LABEL, yAxisIndex: 1, data: sliceTrendWindow(scoreToRatingRatios, view) },
        { name: emaLabel, yAxisIndex: 1, data: sliceTrendWindow(scoreRatioEma, view) },
        { name: SEGMENT_AVG_LABEL, yAxisIndex: 1, data: sliceTrendWindow(scoreRatioSegmentAvg, view) },
    ], [selfRatings, opponentRatings, scoreToRatingRatios, scoreRatioEma, scoreRatioSegmentAvg, emaLabel, view]);

    useEffect(() => {
        setLegendSelected({});
    }, [emaLabel]);

    const ratingYRange = useMemo(() => {
        const visible = collectVisibleAxisValues(legendSeries, legendSelected, 0);
        const fallback = collectAllAxisValues(legendSeries, 0);
        return snapRatingYRange(...(visible.length > 0 ? [visible] : [fallback]));
    }, [legendSeries, legendSelected]);

    const ratioYRange = useMemo(() => {
        const visible = collectVisibleAxisValues(legendSeries, legendSelected, 1);
        const fallback = collectAllAxisValues(legendSeries, 1);
        return snapRatioYRange(visible.length > 0 ? visible : fallback);
    }, [legendSeries, legendSelected]);

    const ratingAxisVisible = isLegendSeriesVisible(legendSelected, OWN_TEAM_RATING_LABEL)
        || isLegendSeriesVisible(legendSelected, OPPONENT_TEAM_RATING_LABEL);
    const sotrAxisVisible = isLegendSeriesVisible(legendSelected, SOTR_LABEL)
        || isLegendSeriesVisible(legendSelected, emaLabel)
        || isLegendSeriesVisible(legendSelected, SEGMENT_AVG_LABEL);

    const showLeftGrid = ratingAxisVisible && !sotrAxisVisible;
    const showRightGrid = sotrAxisVisible;
    const alignDualAxes = ratingAxisVisible && sotrAxisVisible;

    const onEvents = useMemo(() => ({
        legendselectchanged: (params: LegendSelectChangedEvent) => {
            setLegendSelected(params.selected);
        },
    }), []);

    const selfPoints = useMemo(() => indexedPoints(selfRatings), [selfRatings]);
    const opponentPoints = useMemo(() => indexedPoints(opponentRatings), [opponentRatings]);
    const ratioPoints = useMemo(() => indexedPoints(scoreToRatingRatios), [scoreToRatingRatios]);
    const ratioEmaPoints = useMemo(() => indexedPoints(scoreRatioEma), [scoreRatioEma]);
    const ratioSegmentPoints = useMemo(() => indexedPoints(scoreRatioSegmentAvg), [scoreRatioSegmentAvg]);
    const chartHeight = scale.px(330);

    const option = useMemo(() => {
        const rosterMarkerSeries = buildRosterMarkerSeries(scoreTrend, 0, 0);
        const legendData = [OWN_TEAM_RATING_LABEL, OPPONENT_TEAM_RATING_LABEL, SOTR_LABEL, emaLabel, SEGMENT_AVG_LABEL];
        const emaStroke = loadingRemaining
            ? emaLineFadeColor(CHART_COLORS.ema, scoreRatioEma.length)
            : CHART_COLORS.ema;
        const isRatioSeries = (name: string | undefined) => name === SOTR_LABEL
            || name === emaLabel
            || name === SEGMENT_AVG_LABEL;

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
                formatter: buildTrendTooltipFormatter(
                    scoreTrend,
                    (seriesName, value) => (isRatioSeries(seriesName) ? value.toFixed(3) : formatScore(value)),
                ),
            },
            legend: chartLegend(scale, { data: legendData, selected: legendSelected, type: 'scroll' }),
            grid: { ...trendGridInsets(scale), containLabel: false },
            xAxis: trendIndexAxis(scale, formattedDates, view),

            yAxis: [
                {
                    ...trendValueAxis(scale, 'Team Rating', compactAxisNumber, 'left', ratingYRange),
                    alignTicks: true,
                    splitNumber: alignDualAxes ? GRID_SPLIT_NUMBER : undefined,
                    min: ratingYRange.min,
                    max: ratingYRange.max,
                    splitLine: { ...CHART_SPLIT_LINE, show: showLeftGrid },
                },
                {
                    ...trendValueAxis(scale, 'SOTR', (value: number) => value.toFixed(2), 'right', ratioYRange),
                    alignTicks: true,
                    splitNumber: alignDualAxes ? GRID_SPLIT_NUMBER : undefined,
                    min: ratioYRange.min,
                    max: ratioYRange.max,
                    splitLine: { ...CHART_SPLIT_LINE, show: showRightGrid },
                },
            ],
            series: [
                {
                    name: OWN_TEAM_RATING_LABEL,
                    type: 'line',
                    yAxisIndex: 0,
                    data: selfPoints,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: CHART_COLORS.primary },
                    lineStyle: { width: 1.8 },
                    z: 3,
                },
                {
                    name: OPPONENT_TEAM_RATING_LABEL,
                    type: 'line',
                    yAxisIndex: 0,
                    data: opponentPoints,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: CHART_COLORS.negative },
                    lineStyle: { width: 1.8 },
                    z: 2,
                },
                {
                    name: SOTR_LABEL,
                    type: 'line',
                    yAxisIndex: 1,
                    data: ratioPoints,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: CHART_COLORS.positive },
                    lineStyle: { width: 1, opacity: 0.7 },
                    z: 1,
                },
                {
                    name: emaLabel,
                    type: 'line',
                    yAxisIndex: 1,
                    data: ratioEmaPoints,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: CHART_COLORS.ema },
                    lineStyle: { width: 2, type: 'dashed', color: emaStroke },
                    z: 4,
                },
                {
                    name: SEGMENT_AVG_LABEL,
                    type: 'line',
                    yAxisIndex: 1,
                    data: ratioSegmentPoints,
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
        emaLabel,
        ratingYRange,
        ratioYRange,
        view,
        scoreTrend,
        ratioPoints,
        ratioEmaPoints,
        ratioSegmentPoints,
        selfPoints,
        opponentPoints,
        scoreRatioEma.length,
        legendSelected,
        showLeftGrid,
        showRightGrid,
        alignDualAxes,
        loadingRemaining,
        scale,
    ]);

    if (!hasData) return null;

    return (
        <div className="chart-block">
            <SectionHeading
                title="Team Rating Progression"
                compact
                actions={<TrendNumberInput label="EMA" value={emaPeriod} max={200} onChange={setEmaPeriod} />}
            />
            <EChart morph option={option} onEvents={onEvents} style={{ height: chartHeight }} />
        </div>
    );
}

export default memo(TeamRatingTrendChart);
