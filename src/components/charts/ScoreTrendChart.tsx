import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Button, ButtonGroup, Form } from 'react-bootstrap';
import type { AggregatedStats, RosterChangeUma, RosterUpdate } from '../../analytics/types';
import type { StatCardViewMode } from './StatCards';
import { type LegendSelectChangedEvent } from './chartLegendScale';
import { formatScore } from '../../utils/formatScore';
import { formatUmaDisplayName } from '../../utils/umaDisplayName';
import { formatRatingHtml } from '../RatingDisplay';
import { chartTooltipStyle } from './chartTooltip';
import SectionHeading from '../SectionHeading';
import { useRaceStore } from '../../store/RaceStore';

type ScoreMode = 'normalized' | 'raw';

type ScoreLegendKey = 'score' | 'ema' | 'bonus';
type ScoreLegendSelection = Partial<Record<ScoreLegendKey, boolean>>;

function isScoreLegendVisible(selected: ScoreLegendSelection, key: ScoreLegendKey): boolean {
    return selected[key] !== false;
}

function toEchartsLegendSelected(
    selected: ScoreLegendSelection,
    scoreName: string,
    emaLabel: string,
    showBonusChart: boolean,
): Record<string, boolean> {
    return {
        [scoreName]: isScoreLegendVisible(selected, 'score'),
        [emaLabel]: isScoreLegendVisible(selected, 'ema'),
        ...(showBonusChart ? { 'Support Bonus': isScoreLegendVisible(selected, 'bonus') } : {}),
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
        ...(showBonusChart ? { bonus: selected['Support Bonus'] } : {}),
    };
}

function bonusPercent(rawBonus: number): number {
    return rawBonus / 100;
}

function bonusMultiplier(rawBonus: number): number {
    const pct = bonusPercent(rawBonus);
    return pct > 0 ? 1 + pct / 100 : 1;
}

function ema(values: number[], period: number): (number | null)[] {
    const n = Math.max(1, Math.floor(period));
    const result: (number | null)[] = values.map(() => null);
    if (values.length < n) return result;

    let emaVal = values.slice(0, n).reduce((sum, v) => sum + v, 0) / n;
    result[n - 1] = emaVal;
    const k = 2 / (n + 1);

    for (let i = n; i < values.length; i++) {
        emaVal = values[i] * k + emaVal * (1 - k);
        result[i] = emaVal;
    }
    return result;
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
    return { min: snappedMin, max: snappedMax };
}

function snapBonusPercentYRange(values: number[]): { min: number; max: number } {
    const finite = values.filter((v) => Number.isFinite(v));
    if (finite.length === 0) return { min: 0, max: 10 };
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    let snappedMin = Math.floor(min * 2) / 2;
    let snappedMax = Math.ceil(max * 2) / 2;
    if (snappedMax - snappedMin < 1) {
        snappedMin = Math.max(0, snappedMin - 0.5);
        snappedMax += 0.5;
    }
    return { min: snappedMin, max: snappedMax };
}

function formatChartDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return isoDate;
    return `${month}/${day}/${year}`;
}

function formatRosterUmaLine(uma: RosterChangeUma, sign: '-' | '+'): string {
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

function buildTooltipFormatter(
    scoreTrend: AggregatedStats['scoreTrend'],
    formatValue: (seriesName: string | undefined, value: number) => string,
    showFileName = false,
) {
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
            return `${item.marker ?? ''}${item.seriesName ?? ''}: ${formatValue(item.seriesName, val)}`;
        }).filter(Boolean);
        const trendPoint = dataIndex != null ? scoreTrend[dataIndex] : undefined;
        const rosterUpdate = trendPoint?.rosterUpdate;
        const parts = [`<b>${header}</b>`, ...lines.map((line) => `<b>${line}</b>`)];
        if (showFileName && trendPoint?.fileName) {
            parts.push('');
            parts.push(`<span style="color:#adb5bd;font-size:11px">${trendPoint.fileName}</span>`);
        }
        if (rosterUpdate) {
            parts.push('');
            parts.push(formatRosterUpdateHtml(rosterUpdate));
        }
        return parts.join('<br/>');
    };
}

function buildRosterMarkerSeries(
    rosterMarkLine: ReturnType<typeof buildRosterMarkLine>,
    pointCount: number,
    xAxisIndex = 0,
    yAxisIndex = 0,
) {
    if (!rosterMarkLine) return null;
    return {
        name: '__roster_updates__',
        type: 'line' as const,
        xAxisIndex,
        yAxisIndex,
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

export default function ScoreTrendChart({
    stats,
    viewMode = 'team',
}: {
    stats: AggregatedStats;
    viewMode?: StatCardViewMode;
}) {
    const { debugMode } = useRaceStore();
    const [mode, setMode] = useState<ScoreMode>('raw');
    const [emaPeriod, setEmaPeriod] = useState(50);
    const [legendSelected, setLegendSelected] = useState<ScoreLegendSelection>({});

    const dates = stats.scoreTrend.map((d) => d.date);
    const formattedDates = useMemo(() => dates.map(formatChartDate), [dates]);
    const rawScores = stats.scoreTrend.map((d) => d.teamScore);
    const normalizedScores = stats.scoreTrend.map((d) => d.teamScore / bonusMultiplier(d.supportCardBonus));
    const bonusValues = stats.scoreTrend.map((d) => bonusPercent(d.supportCardBonus));

    const rawEma = useMemo(() => ema(rawScores, emaPeriod), [rawScores, emaPeriod]);
    const normalizedEma = useMemo(() => ema(normalizedScores, emaPeriod), [normalizedScores, emaPeriod]);

    const isDistanceView = viewMode === 'distance';
    const isUmaView = viewMode === 'uma';
    const isScopedScoreView = isUmaView || isDistanceView;
    const rosterUpdateMarkLines = useMemo(
        () => stats.scoreTrend
            .map((point, index) => (point.rosterUpdate ? { xAxis: index } : null))
            .filter((line): line is { xAxis: number } => line !== null),
        [stats.scoreTrend],
    );

    const activeScores = isScopedScoreView
        ? rawScores
        : (mode === 'normalized' ? normalizedScores : rawScores);
    const activeEma = isScopedScoreView
        ? rawEma
        : (mode === 'normalized' ? normalizedEma : rawEma);

    const dateInterval = dates.length > 12 ? Math.ceil(dates.length / 8) - 1 : 0;
    const emaLabel = `EMA ${Math.max(1, Math.floor(emaPeriod))}`;
    const scoreName = isScopedScoreView
        ? (isDistanceView ? 'Race Score' : 'Score')
        : mode === 'normalized'
        ? (isDistanceView ? 'Normalized Race Score' : 'Normalized Score')
        : (isDistanceView ? 'Race Score' : 'Total Score');
    const showBonusChart = !isScopedScoreView;
    const gridLeft = 82;
    const gridRight = 72;

    const echartsLegendSelected = useMemo(
        () => toEchartsLegendSelected(legendSelected, scoreName, emaLabel, showBonusChart),
        [legendSelected, scoreName, emaLabel, showBonusChart],
    );

    useEffect(() => {
        setLegendSelected({});
    }, [showBonusChart]);

    const scoreYRange = useMemo(() => {
        const scoreLineVisible = isScoreLegendVisible(legendSelected, 'score');
        const emaLineVisible = isScoreLegendVisible(legendSelected, 'ema');
        const values: number[] = [];

        if (scoreLineVisible) {
            activeScores.forEach((v) => { if (Number.isFinite(v)) values.push(v); });
            if (emaLineVisible) {
                activeEma.forEach((v) => { if (v != null && Number.isFinite(v)) values.push(v); });
            }
        } else if (emaLineVisible) {
            activeEma.forEach((v) => { if (v != null && Number.isFinite(v)) values.push(v); });
        }

        if (values.length === 0) {
            activeScores.forEach((v) => { if (Number.isFinite(v)) values.push(v); });
            activeEma.forEach((v) => { if (v != null && Number.isFinite(v)) values.push(v); });
        }
        return snapScoreYRange(values);
    }, [
        legendSelected,
        activeScores,
        activeEma,
    ]);

    const bonusYRange = useMemo(() => {
        if (!isScoreLegendVisible(legendSelected, 'bonus')) {
            return snapBonusPercentYRange([]);
        }
        return snapBonusPercentYRange(bonusValues);
    }, [legendSelected, bonusValues]);

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

    const option = useMemo(() => {
        const legendData = showBonusChart
            ? [scoreName, emaLabel, 'Support Bonus']
            : [scoreName, emaLabel];
        const axisPointerLink = showBonusChart ? [{ xAxisIndex: [0, 1] }] : [{ xAxisIndex: [0] }];

        const rosterMarkLine = buildRosterMarkLine(rosterUpdateMarkLines, stats.scoreTrend);
        const rosterMarkerSeries = buildRosterMarkerSeries(
            rosterMarkLine,
            formattedDates.length,
            0,
            0,
        );

        const scoreSeries = [
            {
                name: scoreName,
                type: 'line' as const,
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: activeScores,
                smooth: true,
                showSymbol: false,
                itemStyle: { color: '#6ea8fe' },
                lineStyle: { width: 2 },
                z: 3,
            },
            {
                name: emaLabel,
                type: 'line' as const,
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: activeEma,
                smooth: true,
                showSymbol: false,
                itemStyle: { color: '#ffc107' },
                lineStyle: { width: 2, type: 'dashed' as const },
                z: 4,
            },
        ];

        if (!showBonusChart) {
            return {
                backgroundColor: 'transparent',
                axisPointer: {
                    link: axisPointerLink,
                    animation: false,
                    lineStyle: { color: '#6c757d', type: 'dashed' },
                },
                tooltip: {
                    ...chartTooltipStyle,
                    trigger: 'axis',
                    axisPointer: {
                        type: 'line',
                        link: axisPointerLink,
                        animation: false,
                        snap: true,
                        lineStyle: { color: '#adb5bd', type: 'dashed' },
                    },
                    formatter: buildTooltipFormatter(
                        stats.scoreTrend,
                        (_seriesName, value) => formatScore(value),
                        debugMode,
                    ),
                },
                legend: {
                    data: legendData,
                    selected: echartsLegendSelected,
                    textStyle: { color: '#ced4da' },
                    bottom: 0,
                    itemWidth: 24,
                    itemHeight: 2,
                    icon: 'rect',
                },
                grid: [{ left: gridLeft, right: gridRight, top: 16, bottom: 48, containLabel: false }],
                xAxis: [{
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
                    gridIndex: 0,
                }],
                yAxis: [{
                    type: 'value',
                    name: 'Score',
                    nameLocation: 'middle',
                    nameRotate: 90,
                    nameGap: 50,
                    min: scoreYRange.min,
                    max: scoreYRange.max,
                    axisLabel: {
                        color: '#ced4da',
                        fontSize: 11,
                        width: 72,
                        align: 'right',
                        margin: 4,
                        formatter: (value: number) => formatScore(value),
                    },
                    splitLine: { lineStyle: { color: '#343a40' } },
                    axisLine: { show: true, lineStyle: { color: '#6c757d' } },
                    gridIndex: 0,
                }],
                series: [
                    ...scoreSeries,
                    ...(rosterMarkerSeries ? [rosterMarkerSeries] : []),
                ],
            };
        }

        return {
        backgroundColor: 'transparent',
        axisPointer: {
            link: axisPointerLink,
            animation: false,
            lineStyle: { color: '#6c757d', type: 'dashed' },
        },
        tooltip: {
            ...chartTooltipStyle,
            trigger: 'axis',
            axisPointer: {
                type: 'line',
                link: axisPointerLink,
                animation: false,
                snap: true,
                lineStyle: { color: '#adb5bd', type: 'dashed' },
            },
            formatter: buildTooltipFormatter(
                stats.scoreTrend,
                (seriesName, value) => (seriesName === 'Support Bonus' ? `${value}%` : formatScore(value)),
                debugMode,
            ),
        },
        legend: {
            data: legendData,
            selected: echartsLegendSelected,
            textStyle: { color: '#ced4da' },
            bottom: 0,
            itemWidth: 24,
            itemHeight: 2,
            icon: 'rect',
        },
        grid: [
            { left: gridLeft, right: gridRight, top: 16, bottom: 114, containLabel: false },
            { left: gridLeft, right: gridRight, top: 266, bottom: 48, containLabel: false },
        ],
        xAxis: [
            {
                type: 'category',
                data: formattedDates,
                boundaryGap: false,
                axisLabel: { show: false },
                axisTick: { alignWithLabel: true, show: false },
                axisPointer: { show: true },
                gridIndex: 0,
            },
            {
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
                gridIndex: 1,
            },
        ],
        yAxis: [
            {
                type: 'value',
                name: 'Score',
                nameLocation: 'middle',
                nameRotate: 90,
                nameGap: 50,
                min: scoreYRange.min,
                max: scoreYRange.max,
                axisLabel: {
                    color: '#ced4da',
                    fontSize: 11,
                    width: 72,
                    align: 'right',
                    margin: 4,
                    formatter: (value: number) => formatScore(value),
                },
                splitLine: { lineStyle: { color: '#343a40' } },
                axisLine: { show: true, lineStyle: { color: '#6c757d' } },
                gridIndex: 0,
            },
            {
                type: 'value',
                name: 'Bonus %',
                nameLocation: 'middle',
                nameRotate: 90,
                nameGap: 50,
                min: bonusYRange.min,
                max: bonusYRange.max,
                interval: 0.5,
                axisLabel: {
                    color: '#ced4da',
                    fontSize: 11,
                    width: 72,
                    align: 'right',
                    margin: 4,
                    formatter: (value: number) => `${value}%`,
                },
                splitLine: { show: false },
                axisLine: { show: true, lineStyle: { color: '#6c757d' } },
                gridIndex: 1,
            },
        ],
        series: [
            ...scoreSeries,
            {
                name: 'Support Bonus',
                type: 'line',
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: bonusValues,
                smooth: true,
                showSymbol: false,
                areaStyle: { color: 'rgba(117, 183, 152, 0.45)' },
                itemStyle: { color: '#75b798' },
                lineStyle: { width: 1 },
                z: 1,
            },
            ...(rosterMarkerSeries ? [rosterMarkerSeries] : []),
        ],
    };
    }, [
        activeScores,
        activeEma,
        bonusValues,
        formattedDates,
        dateInterval,
        emaLabel,
        scoreName,
        scoreYRange,
        bonusYRange,
        gridLeft,
        gridRight,
        showBonusChart,
        rosterUpdateMarkLines,
        stats.scoreTrend,
        legendSelected,
        echartsLegendSelected,
        debugMode,
    ]);

    return (
        <div>
            <SectionHeading title="Score Progression" compact className="mt-0" />
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                {!isScopedScoreView && (
                <ButtonGroup size="sm">
                    <Button
                        variant={mode === 'raw' ? 'secondary' : 'outline-secondary'}
                        onClick={() => setMode('raw')}
                    >
                        Raw Score
                    </Button>
                    <Button
                        variant={mode === 'normalized' ? 'secondary' : 'outline-secondary'}
                        onClick={() => setMode('normalized')}
                    >
                        Bonus Normalized
                    </Button>
                </ButtonGroup>
                )}
                {isScopedScoreView && <div />}
                <div className="d-flex align-items-center gap-2">
                    <Form.Label className="text-secondary small mb-0">EMA Period</Form.Label>
                    <Form.Control
                        type="number"
                        min={1}
                        max={200}
                        value={emaPeriod}
                        onChange={(e) => {
                            const next = Number(e.target.value);
                            if (Number.isFinite(next) && next >= 1) setEmaPeriod(next);
                        }}
                        style={{ width: '5rem' }}
                        size="sm"
                    />
                </div>
            </div>
            <ReactECharts option={option} onEvents={onEvents} style={{ height: isUmaView ? 280 : 360 }} />
        </div>
    );
}
