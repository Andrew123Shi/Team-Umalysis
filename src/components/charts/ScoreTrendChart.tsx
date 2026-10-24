import { memo, useEffect, useMemo, useState } from 'react';
import EChart from './EChart';
import type { AggregatedStats } from '../../analytics/types';
import type { StatCardViewMode } from './StatCards';
import { type LegendSelectChangedEvent } from './chartLegendScale';
import { formatScore } from '../../utils/formatScore';
import { ema, emaForVisibleWindow, emaLineFadeColor } from '../../utils/ema';
import { chartTooltipStyle } from './chartTooltip';
import { CHART_UPDATE_ANIMATION } from './chartLayout';
import {
    CHART_COLORS,
    CHART_SPLIT_LINE,
    CHART_TEXT_STYLE,
    chartLegend,
    evenAxisInterval,
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
import { useRaceStore } from '../../store/RaceStore';

type ScoreLegendKey = 'score' | 'ema' | 'segmentAvg' | 'bonus';
type ScoreLegendSelection = Partial<Record<ScoreLegendKey, boolean>>;

function isScoreLegendVisible(selected: ScoreLegendSelection, key: ScoreLegendKey): boolean {
    return selected[key] !== false;
}

const SEGMENT_AVG_LABEL = 'Roster Average';
const BONUS_LABEL = 'Support Bonus';

function toEchartsLegendSelected(
    selected: ScoreLegendSelection,
    scoreName: string,
    emaLabel: string,
    showBonusChart: boolean,
): Record<string, boolean> {
    return {
        [scoreName]: isScoreLegendVisible(selected, 'score'),
        [emaLabel]: isScoreLegendVisible(selected, 'ema'),
        [SEGMENT_AVG_LABEL]: isScoreLegendVisible(selected, 'segmentAvg'),
        ...(showBonusChart ? { [BONUS_LABEL]: isScoreLegendVisible(selected, 'bonus') } : {}),
    };
}

function fromEchartsLegendSelected(
    selected: Record<string, boolean>,
    scoreName: string,
    emaLabel: string,
    showBonusChart: boolean,
): ScoreLegendSelection {
    return {
        score: selected[scoreName],
        ema: selected[emaLabel],
        segmentAvg: selected[SEGMENT_AVG_LABEL],
        ...(showBonusChart ? { bonus: selected[BONUS_LABEL] } : {}),
    };
}

function bonusPercent(rawBonus: number): number {
    return rawBonus / 100;
}

const SCORE_Y_STEP = 10_000;

function snapScoreYRange(...series: number[][]): { min: number; max: number } {
    const values = series.flat().filter((v) => Number.isFinite(v));
    if (values.length === 0) return { min: 0, max: SCORE_Y_STEP };
    const min = Math.min(...values);
    const max = Math.max(...values);
    let snappedMin = Math.floor(min / SCORE_Y_STEP) * SCORE_Y_STEP;
    let snappedMax = Math.ceil(max / SCORE_Y_STEP) * SCORE_Y_STEP;
    if (snappedMin === snappedMax) {
        snappedMin -= SCORE_Y_STEP;
        snappedMax += SCORE_Y_STEP;
    }
    // A range no step divides evenly leaves a crowded label at the top.
    for (let i = 0; i < 4 && evenAxisInterval(snappedMin, snappedMax, SCORE_Y_STEP) === undefined; i += 1) {
        snappedMax += SCORE_Y_STEP;
    }
    return { min: snappedMin, max: snappedMax };
}

function snapBonusPercentYRange(values: number[]): { min: number; max: number } {
    const finite = values.filter((v) => Number.isFinite(v));
    if (finite.length === 0) return { min: 0, max: 10 };
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    let snappedMin = Math.floor(min);
    let snappedMax = Math.ceil(max);
    if (snappedMax - snappedMin < 1) {
        snappedMin = Math.max(0, snappedMin - 1);
        snappedMax += 1;
    }
    return { min: snappedMin, max: snappedMax };
}

function ScoreTrendChart({
    stats,
    emaSourceTrend,
    viewMode = 'team',
}: {
    stats: AggregatedStats;
    /** Full-history trend used to warm-start EMA when `stats` is a Recent window. */
    emaSourceTrend?: AggregatedStats['scoreTrend'];
    viewMode?: StatCardViewMode;
}) {
    const { debugMode } = useRaceStore();
    const loadingRemaining = useLoadingRemainingFiles();
    const scale = useChartScale();
    const [emaPeriod, setEmaPeriod] = useState(50);
    const [legendSelected, setLegendSelected] = useState<ScoreLegendSelection>({});

    const source = loadingRemaining ? undefined : emaSourceTrend;
    const view = useTrendWindow(stats.scoreTrend, source);
    const trend = view.trend;
    const formattedDates = useMemo(() => trend.map((d) => formatChartDate(d.date)), [trend]);
    const rawScores = useMemo(() => trend.map((d) => d.teamScore), [trend]);
    const bonusValues = useMemo(() => trend.map((d) => bonusPercent(d.supportCardBonus)), [trend]);

    const isDistanceView = viewMode === 'distance';
    const isUmaView = viewMode === 'uma';
    const isScopedScoreView = isUmaView || isDistanceView;

    const activeScores = rawScores;
    const activeSegmentAvg = useMemo(
        () => windowedSegmentAverage(activeScores, view),
        [activeScores, view],
    );
    const rosterAverageSeed = useMemo(() => {
        if (!loadingRemaining) return undefined;
        const seed = activeSegmentAvg[0];
        return seed != null && Number.isFinite(seed) ? seed : undefined;
    }, [activeSegmentAvg, loadingRemaining]);

    const activeEma = useMemo(() => {
        if (loadingRemaining) return ema(rawScores, emaPeriod, rosterAverageSeed);
        if (view.windowed || !source) return ema(rawScores, emaPeriod);
        return emaForVisibleWindow(
            rawScores,
            trend.map((d) => d.fileName),
            source.map((d) => d.teamScore),
            source.map((d) => d.fileName),
            emaPeriod,
        );
    }, [loadingRemaining, rawScores, emaPeriod, rosterAverageSeed, view, source, trend]);

    const scorePoints = useMemo(() => indexedPoints(activeScores), [activeScores]);
    const emaPoints = useMemo(() => indexedPoints(activeEma), [activeEma]);
    const segmentPoints = useMemo(() => indexedPoints(activeSegmentAvg), [activeSegmentAvg]);
    const bonusPoints = useMemo(() => indexedPoints(bonusValues), [bonusValues]);
    const emaLabel = `EMA ${Math.max(1, Math.floor(emaPeriod))}`;
    const scoreName = isScopedScoreView
        ? (isDistanceView ? 'Race Score' : 'Score')
        : 'Total Score';
    const showBonusChart = !isScopedScoreView;

    const echartsLegendSelected = useMemo(
        () => toEchartsLegendSelected(legendSelected, scoreName, emaLabel, showBonusChart),
        [legendSelected, scoreName, emaLabel, showBonusChart],
    );

    useEffect(() => {
        setLegendSelected({});
    }, [showBonusChart]);

    const scoreYRange = useMemo(() => {
        const values: number[] = [];
        const pushFinite = (series: Array<number | null>) => {
            series.forEach((v) => { if (v != null && Number.isFinite(v)) values.push(v); });
        };

        const scores = sliceTrendWindow(activeScores, view);
        const emaValues = sliceTrendWindow(activeEma, view);
        const segmentValues = sliceTrendWindow(activeSegmentAvg, view);
        if (isScoreLegendVisible(legendSelected, 'score')) pushFinite(scores);
        if (isScoreLegendVisible(legendSelected, 'ema')) pushFinite(emaValues);
        if (isScoreLegendVisible(legendSelected, 'segmentAvg')) pushFinite(segmentValues);

        if (values.length === 0) {
            pushFinite(scores);
            pushFinite(emaValues);
            pushFinite(segmentValues);
        }
        return snapScoreYRange(values);
    }, [legendSelected, activeScores, activeEma, activeSegmentAvg, view]);

    const bonusYRange = useMemo(() => {
        if (!isScoreLegendVisible(legendSelected, 'bonus')) {
            return snapBonusPercentYRange([]);
        }
        return snapBonusPercentYRange(sliceTrendWindow(bonusValues, view));
    }, [legendSelected, bonusValues, view]);

    const onEvents = useMemo(() => ({
        legendselectchanged: (params: LegendSelectChangedEvent) => {
            setLegendSelected(fromEchartsLegendSelected(
                params.selected,
                scoreName,
                emaLabel,
                showBonusChart,
            ));
        },
    }), [scoreName, emaLabel, showBonusChart]);

    const chartHeight = scale.px(isUmaView ? 300 : 400);

    const option = useMemo(() => {
        const insets = trendGridInsets(scale);
        const legendData = showBonusChart
            ? [scoreName, emaLabel, SEGMENT_AVG_LABEL, BONUS_LABEL]
            : [scoreName, emaLabel, SEGMENT_AVG_LABEL];
        const axisPointerLink = showBonusChart ? [{ xAxisIndex: [0, 1] }] : [{ xAxisIndex: [0] }];

        const rosterMarkerSeries = buildRosterMarkerSeries(trend, 0, 0);
        const emaStroke = loadingRemaining
            ? emaLineFadeColor(CHART_COLORS.ema, activeEma.length)
            : CHART_COLORS.ema;

        const scoreYAxis = {
            ...trendValueAxis(scale, 'Score', compactAxisNumber, 'left', scoreYRange),
            min: scoreYRange.min,
            max: scoreYRange.max,
            interval: evenAxisInterval(scoreYRange.min, scoreYRange.max, SCORE_Y_STEP),
            splitLine: CHART_SPLIT_LINE,
            gridIndex: 0,
        };

        const scoreSeries = [
            {
                name: scoreName,
                type: 'line' as const,
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: scorePoints,
                smooth: true,
                showSymbol: false,
                itemStyle: { color: CHART_COLORS.primary },
                lineStyle: { width: 1.6 },
                areaStyle: {
                    color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(77, 159, 255, 0.16)' },
                            { offset: 1, color: 'rgba(77, 159, 255, 0)' },
                        ],
                    },
                },
                z: 3,
            },
            {
                name: emaLabel,
                type: 'line' as const,
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: emaPoints,
                smooth: true,
                showSymbol: false,
                itemStyle: { color: CHART_COLORS.ema },
                lineStyle: { width: 2, type: 'dashed' as const, color: emaStroke },
                z: 4,
            },
            {
                name: SEGMENT_AVG_LABEL,
                type: 'line' as const,
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: segmentPoints,
                step: 'end' as const,
                showSymbol: false,
                itemStyle: { color: CHART_COLORS.average },
                lineStyle: { width: 1.5, type: [4, 4], opacity: 0.85 },
                z: 5,
            },
        ];

        const tooltip = {
            ...chartTooltipStyle,
            trigger: 'axis',
            axisPointer: {
                type: 'line',
                link: axisPointerLink,
                animation: false,
                snap: true,
                lineStyle: { color: CHART_COLORS.pointer, type: 'dashed' },
            },
            formatter: buildTrendTooltipFormatter(
                trend,
                (seriesName, value) => (seriesName === BONUS_LABEL ? `${value}%` : formatScore(value)),
                debugMode ? (point) => point.fileName : undefined,
            ),
        };
        const base = {
            backgroundColor: 'transparent',
            textStyle: CHART_TEXT_STYLE,
            ...CHART_UPDATE_ANIMATION,
            axisPointer: {
                link: axisPointerLink,
                animation: false,
                lineStyle: { color: CHART_COLORS.pointer, type: 'dashed' },
            },
            tooltip,
            legend: chartLegend(scale, { data: legendData, selected: echartsLegendSelected }),
        };

        if (!showBonusChart) {
            return {
                ...base,
                grid: [{ ...insets, containLabel: false }],
                xAxis: [trendIndexAxis(scale, formattedDates, view)],

                yAxis: [scoreYAxis],
                series: [
                    ...scoreSeries,
                    ...(rosterMarkerSeries ? [rosterMarkerSeries] : []),
                ],
            };
        }

        const bonusHeight = scale.px(60);
        const bonusGap = scale.px(30);
        return {
            ...base,
            grid: [
                { ...insets, bottom: insets.bottom + bonusHeight + bonusGap, containLabel: false },
                { ...insets, top: chartHeight - insets.bottom - bonusHeight, containLabel: false },
            ],
            xAxis: [
                trendIndexAxis(scale, formattedDates, view, { showLabels: false }),
                trendIndexAxis(scale, formattedDates, view, { gridIndex: 1 }),
            ],

            yAxis: [
                scoreYAxis,
                {
                    ...trendValueAxis(scale, 'Bonus', (value: number) => `${value}%`, 'left', bonusYRange),
                    min: bonusYRange.min,
                    max: bonusYRange.max,
                    interval: bonusYRange.max - bonusYRange.min,
                    splitLine: { show: false },
                    gridIndex: 1,
                },
            ],
            series: [
                ...scoreSeries,
                {
                    name: BONUS_LABEL,
                    type: 'line',
                    xAxisIndex: 1,
                    yAxisIndex: 1,
                    data: bonusPoints,
                    step: 'end',
                    showSymbol: false,
                    areaStyle: { color: 'rgba(52, 211, 153, 0.18)' },
                    itemStyle: { color: CHART_COLORS.positive },
                    lineStyle: { width: 1 },
                    z: 1,
                },
                ...(rosterMarkerSeries ? [rosterMarkerSeries] : []),
            ],
        };
    }, [
        scorePoints,
        emaPoints,
        segmentPoints,
        bonusPoints,
        activeEma.length,
        formattedDates,
        emaLabel,
        scoreName,
        scoreYRange,
        bonusYRange,
        showBonusChart,
        trend,
        view,
        echartsLegendSelected,
        debugMode,
        loadingRemaining,
        scale,
        chartHeight,
    ]);

    return (
        <div className="chart-block">
            <SectionHeading
                title="Score Progression"
                compact
                actions={<TrendNumberInput label="EMA" value={emaPeriod} max={200} onChange={setEmaPeriod} />}
            />
            <EChart morph option={option} onEvents={onEvents} style={{ height: chartHeight }} />
        </div>
    );
}

export default memo(ScoreTrendChart);
