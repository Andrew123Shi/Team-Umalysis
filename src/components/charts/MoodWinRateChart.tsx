import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card } from 'react-bootstrap';

import { buildMoodWinRate, MOOD_COLORS, MOOD_ICON_KEYS } from '../../analytics/moodWinRate';
import type { TTRound } from '../../analytics/types';
import AssetLoader from '../../data/AssetLoader';
import SectionHeading from '../SectionHeading';
import { chartTooltipStyle } from './chartTooltip';

const MOOD_ICON_HEIGHT = 22;
const MOOD_ICON_WIDTH = Math.round(MOOD_ICON_HEIGHT * (184 / 68));

const MOOD_GRADIENT_STOPS = [1, 2, 3, 4, 5].map((mood, index) => ({
    offset: index / 4,
    color: MOOD_COLORS[mood],
}));

function moodAxisKey(mood: number) {
    return `m${mood}`;
}

function computeYAxisMax(values: number[]): number {
    const dataMax = Math.max(...values, 0);
    if (dataMax <= 0) return 10;
    return Math.max(10, Math.ceil(dataMax / 10) * 10);
}

export default function MoodWinRateChart({
    rounds,
    buildKey,
}: {
    rounds: TTRound[];
    buildKey: string;
}) {
    const data = useMemo(() => buildMoodWinRate(rounds, buildKey), [rounds, buildKey]);
    const chartValues = useMemo(
        () => data
            .filter((point) => point.races > 0)
            .map((point) => point.winRate * 100),
        [data],
    );
    const yMax = useMemo(() => computeYAxisMax(chartValues), [chartValues]);

    const option = useMemo(() => ({
        backgroundColor: 'transparent',
        tooltip: {
            ...chartTooltipStyle,
            trigger: 'axis',
            formatter: (params: unknown) => {
                const items = (Array.isArray(params) ? params : [params]) as {
                    data?: { label?: string; races?: number };
                    marker?: string;
                    value?: number | null;
                }[];
                const item = items[0];
                if (!item || item.value == null || !Number.isFinite(item.value)) return '';
                const races = item.data?.races ?? 0;
                return [
                    `<b>${item.data?.label ?? ''}</b>`,
                    `<b>${item.marker ?? ''}Win Rate: ${item.value.toFixed(1)}% · n=${races}</b>`,
                ].join('<br/>');
            },
        },
        grid: {
            left: 32,
            right: 16,
            top: 24,
            bottom: 56,
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            boundaryGap: true,
            data: data.map((point) => moodAxisKey(point.mood)),
            axisTick: { show: false },
            axisLabel: {
                interval: 0,
                formatter: (value: string) => `{${value}|}`,
                rich: Object.fromEntries(data.map((point) => [
                    moodAxisKey(point.mood),
                    {
                        width: MOOD_ICON_WIDTH,
                        height: MOOD_ICON_HEIGHT,
                        align: 'center',
                        backgroundColor: {
                            image: AssetLoader.getMotivationIcon(MOOD_ICON_KEYS[point.mood] ?? 'utx_ico_motivation_m_02'),
                        },
                    },
                ])),
            },
            axisLine: { lineStyle: { color: '#6c757d' } },
        },
        yAxis: [
            {
                type: 'value',
                name: 'Win Rate',
                nameLocation: 'middle',
                nameGap: 46,
                min: 0,
                max: yMax,
                axisLabel: {
                    color: '#ced4da',
                    formatter: (value: number) => `${value}%`,
                },
                splitLine: { lineStyle: { color: '#343a40' } },
                axisLine: { show: true, lineStyle: { color: '#6c757d' } },
            },
            {
                type: 'value',
                position: 'right',
                min: 0,
                max: yMax,
                axisLabel: { show: false },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLine: { show: true, lineStyle: { color: '#6c757d' } },
            },
        ],
        series: [{
            name: 'Win Rate',
            type: 'line',
            smooth: true,
            showSymbol: true,
            symbolSize: 8,
            connectNulls: false,
            yAxisIndex: 0,
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
                itemStyle: { color: MOOD_COLORS[point.mood] ?? '#adb5bd' },
            })),
        }],
    }), [data, yMax]);

    const hasData = data.some((point) => point.races > 0);

    return (
        <Card className="app-card h-100">
            <Card.Body>
                <SectionHeading title="Mood Sensitivity" compact className="mt-0 mb-1" />
                <div className="small text-muted mb-2">
                    Win rate at each mood level
                </div>
                {hasData ? (
                    <ReactECharts option={option} style={{ height: 320 }} />
                ) : (
                    <div className="text-muted small py-4 text-center">Not enough data</div>
                )}
            </Card.Body>
        </Card>
    );
}
