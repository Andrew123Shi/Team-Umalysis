import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Form } from 'react-bootstrap';
import type { AggregatedStats, RosterUpdate } from '../../analytics/types';
import { collectAllAxisValues, collectVisibleAxisValues, isLegendSeriesVisible, type LegendSelectChangedEvent } from './chartLegendScale';
import { formatScore } from '../../utils/formatScore';
import { ema, emaForVisibleWindow, emaLineFadeColor } from '../../utils/ema';
import { segmentAverage } from '../../utils/segmentAverage';
import { formatUmaDisplayName } from '../../utils/umaDisplayName';
import { formatRatingHtml } from '../RatingDisplay';
import { chartTooltipStyle } from './chartTooltip';
import { CHART_UPDATE_ANIMATION } from './chartLayout';
import SectionHeading from '../SectionHeading';
import { useLoadingRemainingFiles } from '../RemainingFilesLoadingAlert';

const RATING_Y_STEP = 10_000;
const RATING_GRID_LEFT = 82;
const RATING_GRID_RIGHT = 72;
const RIGHT_Y_AXIS_NAME_GAP = 36;
const GRID_SPLIT_NUMBER = 5;
const SOTR_LABEL = 'Score / Team Rating (SOTR)';
const OWN_TEAM_RATING_LABEL = 'Own Team Rating';
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

function buildTooltipFormatter(scoreTrend: AggregatedStats['scoreTrend'], emaLabel: string) {
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
            const isRatioSeries = item.seriesName === SOTR_LABEL
                || item.seriesName === emaLabel
                || item.seriesName === SEGMENT_AVG_LABEL;
            const formatted = isRatioSeries ? val.toFixed(3) : formatScore(val);
            return `${item.marker ?? ''}${item.seriesName ?? ''}: ${formatted}`;
        }).filter(Boolean);
        const rosterUpdate = dataIndex != null ? scoreTrend[dataIndex]?.rosterUpdate : undefined;
        const parts = [`<b>${header}</b>`, ...lines.map((line) => `<b>${line}</b>`)];
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

function sotrRatio(point: AggregatedStats['scoreTrend'][number]): number | null {
    if (point.selfTeamRating <= 0) return null;
    return point.teamScore / point.selfTeamRating;
}

export default function TeamRatingTrendChart({
    stats,
    emaSourceTrend,
}: {
    stats: AggregatedStats;
    /** Full-history trend used to warm-start EMA when `stats` is a Recent window. */
    emaSourceTrend?: AggregatedStats['scoreTrend'];
}) {
    const loadingRemaining = useLoadingRemainingFiles();
    const [emaPeriod, setEmaPeriod] = useState(50);
    const [legendSelected, setLegendSelected] = useState<Record<string, boolean>>({});
    const scoreTrend = stats.scoreTrend;
    const hasData = scoreTrend.length > 0;

    const dates = scoreTrend.map((d) => d.date);
    const formattedDates = useMemo(() => dates.map(formatChartDate), [dates]);
    const trendKeys = useMemo(() => scoreTrend.map((d) => d.fileName), [scoreTrend]);
    const selfRatings = scoreTrend.map((d) => d.selfTeamRating);
    const opponentRatings = scoreTrend.map((d) => d.opponentTeamRating);
    const scoreToRatingRatios = scoreTrend.map(sotrRatio);
    const sourceKeys = useMemo(
        () => (loadingRemaining ? undefined : emaSourceTrend?.map((d) => d.fileName)),
        [emaSourceTrend, loadingRemaining],
    );
    const sourceRatios = useMemo(
        () => (loadingRemaining ? undefined : emaSourceTrend?.map((d) => sotrRatio(d) ?? 0)),
        [emaSourceTrend, loadingRemaining],
    );
    const rosterBoundaryIndices = useMemo(
        () => scoreTrend
            .map((point, index) => (point.rosterUpdate ? index : -1))
            .filter((index) => index >= 0),
        [scoreTrend],
    );
    const scoreRatioSegmentAvg = useMemo(
        () => segmentAverage(scoreToRatingRatios, rosterBoundaryIndices),
        [scoreToRatingRatios, rosterBoundaryIndices],
    );
    const rosterAverageSeed = useMemo(() => {
        if (!loadingRemaining) return undefined;
        const seed = scoreRatioSegmentAvg[0];
        return seed != null && Number.isFinite(seed) ? seed : undefined;
    }, [loadingRemaining, scoreRatioSegmentAvg]);
    const scoreRatioEma = useMemo(
        () => {
            const visibleRatios = scoreToRatingRatios.map((r) => r ?? 0);
            return loadingRemaining
                ? ema(visibleRatios, emaPeriod, rosterAverageSeed)
                : emaForVisibleWindow(
                    visibleRatios,
                    trendKeys,
                    sourceRatios,
                    sourceKeys,
                    emaPeriod,
                );
        },
        [loadingRemaining, scoreToRatingRatios, trendKeys, sourceRatios, sourceKeys, emaPeriod, rosterAverageSeed],
    );
    const emaLabel = sotrEmaLabel(emaPeriod);

    const legendSeries = useMemo(() => [
        { name: OWN_TEAM_RATING_LABEL, yAxisIndex: 0, data: selfRatings },
        { name: 'Opponent Team Rating', yAxisIndex: 0, data: opponentRatings },
        { name: SOTR_LABEL, yAxisIndex: 1, data: scoreToRatingRatios },
        { name: emaLabel, yAxisIndex: 1, data: scoreRatioEma },
        { name: SEGMENT_AVG_LABEL, yAxisIndex: 1, data: scoreRatioSegmentAvg },
    ], [selfRatings, opponentRatings, scoreToRatingRatios, scoreRatioEma, scoreRatioSegmentAvg, emaLabel]);

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

    const ratingAxisVisible = useMemo(
        () => isLegendSeriesVisible(legendSelected, OWN_TEAM_RATING_LABEL)
            || isLegendSeriesVisible(legendSelected, 'Opponent Team Rating'),
        [legendSelected],
    );

    const sotrAxisVisible = useMemo(
        () => isLegendSeriesVisible(legendSelected, SOTR_LABEL)
            || isLegendSeriesVisible(legendSelected, emaLabel)
            || isLegendSeriesVisible(legendSelected, SEGMENT_AVG_LABEL),
        [legendSelected, emaLabel],
    );

    const showLeftGrid = ratingAxisVisible && !sotrAxisVisible;
    const showRightGrid = sotrAxisVisible;
    const alignDualAxes = ratingAxisVisible && sotrAxisVisible;

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
        const rosterMarkerSeries = buildRosterMarkerSeries(
            rosterMarkLine,
            formattedDates.length,
            0,
            0,
        );
        const legendData = [OWN_TEAM_RATING_LABEL, 'Opponent Team Rating', SOTR_LABEL, emaLabel, SEGMENT_AVG_LABEL];
        const emaStroke = loadingRemaining
            ? emaLineFadeColor('#ffc107', scoreRatioEma.length)
            : '#ffc107';

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
                formatter: buildTooltipFormatter(scoreTrend, emaLabel),
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
                left: RATING_GRID_LEFT,
                right: RATING_GRID_RIGHT,
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
            yAxis: [
                {
                    type: 'value',
                    name: 'Team Rating',
                    nameLocation: 'middle',
                    nameRotate: 90,
                    nameGap: 50,
                    alignTicks: true,
                    splitNumber: alignDualAxes ? GRID_SPLIT_NUMBER : undefined,
                    min: ratingYRange.min,
                    max: ratingYRange.max,
                    axisLabel: {
                        color: '#ced4da',
                        fontSize: 11,
                        width: 72,
                        align: 'right',
                        margin: 4,
                        formatter: (value: number) => formatScore(value),
                    },
                    splitLine: {
                        show: showLeftGrid,
                        lineStyle: { color: '#343a40' },
                    },
                    axisLine: { show: true, lineStyle: { color: '#6c757d' } },
                },
                {
                    type: 'value',
                    name: 'SOTR',
                    nameLocation: 'middle',
                    nameRotate: 90,
                    nameGap: RIGHT_Y_AXIS_NAME_GAP,
                    alignTicks: true,
                    splitNumber: alignDualAxes ? GRID_SPLIT_NUMBER : undefined,
                    min: ratioYRange.min,
                    max: ratioYRange.max,
                    axisLabel: {
                        color: '#ced4da',
                        fontSize: 11,
                        width: 48,
                        align: 'left',
                        margin: 2,
                        formatter: (value: number) => value.toFixed(2),
                    },
                    splitLine: {
                        show: showRightGrid,
                        lineStyle: { color: '#343a40' },
                    },
                    axisLine: { show: true, lineStyle: { color: '#6c757d' } },
                },
            ],
            series: [
                {
                    name: OWN_TEAM_RATING_LABEL,
                    type: 'line',
                    yAxisIndex: 0,
                    data: selfRatings,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: '#6ea8fe' },
                    lineStyle: { width: 2 },
                    z: 3,
                },
                {
                    name: 'Opponent Team Rating',
                    type: 'line',
                    yAxisIndex: 0,
                    data: opponentRatings,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: '#ea868f' },
                    lineStyle: { width: 2 },
                    z: 2,
                },
                {
                    name: SOTR_LABEL,
                    type: 'line',
                    yAxisIndex: 1,
                    data: scoreToRatingRatios,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: '#75b798' },
                    lineStyle: { width: 1, type: 'solid' },
                    z: 1,
                },
                {
                    name: emaLabel,
                    type: 'line',
                    yAxisIndex: 1,
                    data: scoreRatioEma,
                    smooth: true,
                    showSymbol: false,
                    itemStyle: { color: '#ffc107' },
                    lineStyle: { width: 2, type: 'dashed', color: emaStroke },
                    z: 4,
                },
                {
                    name: SEGMENT_AVG_LABEL,
                    type: 'line',
                    yAxisIndex: 1,
                    data: scoreRatioSegmentAvg,
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
        emaLabel,
        ratingYRange,
        ratioYRange,
        rosterUpdateMarkLines,
        scoreTrend,
        scoreToRatingRatios,
        scoreRatioEma,
        scoreRatioSegmentAvg,
        selfRatings,
        opponentRatings,
        legendSelected,
        ratingAxisVisible,
        sotrAxisVisible,
        showLeftGrid,
        showRightGrid,
        alignDualAxes,
        loadingRemaining,
    ]);

    if (!hasData) return null;

    return (
        <div>
            <div className="position-relative trend-heading-with-controls">
                <SectionHeading title="Team Rating Progression" compact className="mt-0 pb-0" />
                <div className="position-absolute top-0 end-0 d-flex align-items-center gap-2">
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
            <ReactECharts option={option} onEvents={onEvents} style={{ height: 280 }} />
        </div>
    );
}
