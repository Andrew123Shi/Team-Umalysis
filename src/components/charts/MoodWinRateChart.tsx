import { useMemo } from 'react';
import EChart from './EChart';
import { Card } from 'react-bootstrap';

import { buildMoodWinRate, MOOD_COLORS, MOOD_ICON_KEYS } from '../../analytics/moodWinRate';
import type { TTRound } from '../../analytics/types';
import AssetLoader from '../../data/AssetLoader';
import SectionHeading from '../SectionHeading';
import { chartTooltipStyle, tooltipHead, tooltipRow } from './chartTooltip';
import {
    CHART_AXIS_LINE,
    CHART_COLORS,
    CHART_SPLIT_LINE,
    CHART_TEXT_STYLE,
    chartAxisLabel,
    evenAxisInterval,
    useChartScale,
} from './chartTheme';

const MOOD_ICON_ASPECT = 184 / 68;

const MOOD_GRADIENT_STOPS = [1, 2, 3, 4, 5].map((mood, index) => ({
    offset: index / 4,
    color: MOOD_COLORS[mood],
}));

function moodAxisKey(mood: number) {
    return `m${mood}`;
}

function computeYAxisMax(values: number[]): number {
    const dataMax = Math.max(...values, 0);
    if (dataMax <= 0) return 20;
    return Math.min(100, Math.max(20, Math.ceil(dataMax / 20) * 20));
}

export default function MoodWinRateChart({
    rounds,
    buildKey,
}: {
    rounds: TTRound[];
    buildKey: string;
}) {
    const scale = useChartScale();
    const data = useMemo(() => buildMoodWinRate(rounds, buildKey), [rounds, buildKey]);
    const chartValues = useMemo(
        () => data
            .filter((point) => point.races > 0)
            .map((point) => point.winRate * 100),
        [data],
    );
    const yMax = useMemo(() => computeYAxisMax(chartValues), [chartValues]);

    const option = useMemo(() => {
        const iconHeight = scale.px(26);
        const iconWidth = Math.round(iconHeight * MOOD_ICON_ASPECT);
        return {
            backgroundColor: 'transparent',
            textStyle: CHART_TEXT_STYLE,
            tooltip: {
                ...chartTooltipStyle,
                trigger: 'axis',
                axisPointer: { type: 'line', lineStyle: { color: CHART_COLORS.pointer, type: 'dashed' } },
                formatter: (params: unknown) => {
                    const items = (Array.isArray(params) ? params : [params]) as {
                        data?: { label?: string; races?: number };
                        marker?: string;
                        value?: number | null;
                    }[];
                    const item = items[0];
                    if (!item || item.value == null || !Number.isFinite(item.value)) return '';
                    const races = item.data?.races ?? 0;
                    return tooltipHead(item.data?.label ?? '')
                        + tooltipRow(`${item.marker ?? ''}Win Rate`, `${item.value.toFixed(1)}%`)
                        + tooltipRow('Races', String(races));
                },
            },
            grid: {
                left: scale.px(4),
                right: scale.px(12),
                top: scale.px(16),
                bottom: scale.px(4),
                containLabel: true,
            },
            xAxis: {
                type: 'category',
                boundaryGap: true,
                data: data.map((point) => moodAxisKey(point.mood)),
                axisTick: { show: false },
                axisLabel: {
                    interval: 0,
                    margin: scale.px(8),
                    formatter: (value: string) => `{${value}|}`,
                    rich: Object.fromEntries(data.map((point) => [
                        moodAxisKey(point.mood),
                        {
                            width: iconWidth,
                            height: iconHeight,
                            align: 'center',
                            backgroundColor: {
                                image: AssetLoader.getMotivationIcon(MOOD_ICON_KEYS[point.mood] ?? 'utx_ico_motivation_m_02'),
                            },
                        },
                    ])),
                },
                axisLine: CHART_AXIS_LINE,
            },
            yAxis: {
                type: 'value',
                min: 0,
                max: yMax,
                interval: evenAxisInterval(0, yMax, 10),
                axisLabel: chartAxisLabel(scale, { formatter: (value: number) => `${value}%` }),
                splitLine: CHART_SPLIT_LINE,
            },
            series: [{
                name: 'Win Rate',
                type: 'line',
                smooth: true,
                showSymbol: true,
                symbol: 'circle',
                symbolSize: scale.px(8),
                connectNulls: false,
                lineStyle: {
                    width: 2,
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 1,
                        y2: 0,
                        colorStops: MOOD_GRADIENT_STOPS,
                    },
                },
                data: data.map((point) => ({
                    value: point.races > 0 ? point.winRate * 100 : null,
                    races: point.races,
                    label: point.label,
                    itemStyle: {
                        color: MOOD_COLORS[point.mood] ?? CHART_COLORS.legend,
                        borderColor: '#0b0d11',
                        borderWidth: 2,
                    },
                })),
            }],
        };
    }, [data, yMax, scale]);

    const hasData = data.some((point) => point.races > 0);

    return (
        <Card className="app-card h-100">
            <Card.Body>
                <SectionHeading title="Mood Sensitivity" />
                {hasData ? (
                    <EChart option={option} style={{ height: scale.px(300) }} />
                ) : (
                    <div className="empty-note">Not enough data</div>
                )}
            </Card.Body>
        </Card>
    );
}
