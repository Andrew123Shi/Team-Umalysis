import { useMemo, useState } from 'react';
import { COL_THIRD } from '../layout';
import ReactECharts from 'echarts-for-react';
import { Button, ButtonGroup } from 'react-bootstrap';
import type { StyleComposition } from '../../analytics/types';
import { STYLE_SATURATION_COLORS } from '../../analytics/styleSaturation';
import { chartTooltipStyle } from './chartTooltip';

type Mode = 'percent' | 'avgCount';

const STYLE_AXIS_LABELS = ['Front /\nRunaway', 'Pace', 'Late', 'End'] as const;
const STYLE_LABELS = ['Front/Runaway', 'Pace', 'Late', 'End'] as const;
const CHART_GRID_TOP = 48;
const CHART_HEIGHT = 240;
const STYLE_IDS = [1, 2, 3, 4] as const;

function fmtCount(value: number): string {
    return (Math.round(value * 100) / 100).toFixed(2);
}

function fmtPctFraction(fraction: number): string {
    return `${(Math.round(fraction * 1000) / 10).toFixed(1)}%`;
}

function dualLabel(countVal: number, pctFraction: number, mode: Mode): string {
    const count = fmtCount(countVal);
    const pct = fmtPctFraction(pctFraction);
    return mode === 'avgCount' ? `${count} (${pct})` : `${pct} (${count})`;
}

function compValues(comp: StyleComposition) {
    return [comp.front, comp.pace, comp.late, comp.end];
}

function formatBarLabel(value: number, mode: Mode): string {
    return mode === 'percent'
        ? `${(Math.round(value * 10) / 10).toFixed(1)}%`
        : (Math.round(value * 100) / 100).toFixed(2);
}

function buildOption({
    title,
    comp,
    altComp,
    mode,
    showDual = false,
}: {
    title: string;
    comp: StyleComposition;
    altComp?: StyleComposition;
    mode: Mode;
    showDual?: boolean;
}) {
    const primary = compValues(comp);
    const alternate = altComp ? compValues(altComp) : primary;

    const values = mode === 'percent'
        ? primary.map((v) => v * 100)
        : primary;
    const dataMax = Math.max(...values, 0);
    const seriesData = values.map((value, index) => {
        const color = STYLE_SATURATION_COLORS[STYLE_IDS[index]] ?? '#6ea8fe';
        return {
            value,
            itemStyle: {
                color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                        { offset: 0, color },
                        { offset: 1, color: `${color}99` },
                    ],
                },
                borderRadius: [10, 10, 4, 4],
                shadowBlur: 10,
                shadowColor: `${color}2e`,
                shadowOffsetY: 4,
            },
        };
    });

    const yMin = 0;
    const yMax = mode === 'percent'
        ? Math.max(10, Math.ceil(dataMax / 10) * 10)
        : Math.max(1, Math.ceil(dataMax));

    return {
        backgroundColor: 'transparent',
        title: {
            text: title,
            left: 'center',
            top: 0,
            textStyle: { color: '#e6edf7', fontSize: 13, fontWeight: 700 },
        },
        tooltip: {
            ...chartTooltipStyle,
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: unknown) => {
                const items = (Array.isArray(params) ? params : [params]) as {
                    dataIndex?: number;
                    marker?: string;
                    seriesName?: string;
                }[];
                const item = items[0];
                if (!item || item.dataIndex == null) return '';

                const idx = item.dataIndex;
                const label = STYLE_LABELS[idx] ?? '';
                const countVal = mode === 'avgCount' ? primary[idx] : alternate[idx];
                const pctFraction = mode === 'percent' ? primary[idx] : alternate[idx];

                const valueText = showDual
                    ? dualLabel(countVal, pctFraction, mode)
                    : (mode === 'percent' ? fmtPctFraction(primary[idx]) : fmtCount(primary[idx]));

                return [
                    `<b>${label}</b>`,
                    `<b><span style="display:inline-flex;align-items:baseline;gap:6px">`
                    + `<span>${item.marker ?? ''}</span>`
                    + `<span style="text-align:left">${valueText}</span>`
                    + `</span></b>`,
                ].join('<br/>');
            },
        },
        grid: { left: 8, right: 8, top: CHART_GRID_TOP, bottom: 36, containLabel: true },
        xAxis: {
            type: 'category',
            data: [...STYLE_AXIS_LABELS],
            axisTick: { show: false },
            axisLabel: {
                color: '#ced4da',
                fontSize: 10,
                interval: 0,
                lineHeight: 13,
            },
            axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.16)' } },
        },
        yAxis: {
            type: 'value',
            name: mode === 'percent' ? '%' : 'Avg count',
            min: yMin,
            max: yMax,
            axisLabel: { color: '#9aa7b5', fontSize: 10 },
            splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.08)' } },
        },
        series: [{
            type: 'bar',
            barWidth: '52%',
            showBackground: true,
            backgroundStyle: {
                color: 'rgba(9, 13, 20, 0.34)',
                borderRadius: [10, 10, 4, 4],
            },
            label: {
                show: true,
                position: 'top',
                color: '#e6edf7',
                fontSize: 10,
                fontWeight: 700,
                formatter: ({ value }: { value: number }) => formatBarLabel(value, mode),
            },
            data: seriesData,
            emphasis: {
                itemStyle: {
                    shadowBlur: 16,
                    shadowOffsetY: 5,
                    shadowColor: 'rgba(255, 255, 255, 0.16)',
                },
            },
        }],
    };
}

export default function StyleCompositionChart({
    opponent,
    npcPercent,
    npcAvgCount,
    roomPercent,
    roomAvgCount,
}: {
    opponent: StyleComposition;
    npcPercent: StyleComposition;
    npcAvgCount: StyleComposition;
    roomPercent: StyleComposition;
    roomAvgCount: StyleComposition;
}) {
    const [npcMode, setNpcMode] = useState<Mode>('avgCount');
    const [roomMode, setRoomMode] = useState<Mode>('avgCount');

    const npcComp = npcMode === 'percent' ? npcPercent : npcAvgCount;
    const npcAlt = npcMode === 'percent' ? npcAvgCount : npcPercent;
    const roomComp = roomMode === 'percent' ? roomPercent : roomAvgCount;
    const roomAlt = roomMode === 'percent' ? roomAvgCount : roomPercent;

    const oppOption = useMemo(
        () => buildOption({ title: 'Opponent Team', comp: opponent, mode: 'percent' }),
        [opponent],
    );
    const npcOption = useMemo(
        () => buildOption({
            title: 'NPCs',
            comp: npcComp,
            altComp: npcAlt,
            mode: npcMode,
            showDual: true,
        }),
        [npcComp, npcAlt, npcMode],
    );
    const roomOption = useMemo(
        () => buildOption({
            title: 'Full Room',
            comp: roomComp,
            altComp: roomAlt,
            mode: roomMode,
            showDual: true,
        }),
        [roomComp, roomAlt, roomMode],
    );

    return (
        <div className="row g-3 average-stats-chart-row">
            <div className={COL_THIRD}>
                <div className="composition-chart-toolbar" />
                <ReactECharts option={oppOption} style={{ height: CHART_HEIGHT }} />
            </div>
            <div className={COL_THIRD}>
                <div className="composition-chart-toolbar">
                    <ButtonGroup size="sm">
                        <Button
                            variant={npcMode === 'avgCount' ? 'secondary' : 'outline-secondary'}
                            onClick={() => setNpcMode('avgCount')}
                        >
                            Avg Count
                        </Button>
                        <Button
                            variant={npcMode === 'percent' ? 'secondary' : 'outline-secondary'}
                            onClick={() => setNpcMode('percent')}
                        >
                            Percent
                        </Button>
                    </ButtonGroup>
                </div>
                <ReactECharts option={npcOption} style={{ height: CHART_HEIGHT }} />
            </div>
            <div className={COL_THIRD}>
                <div className="composition-chart-toolbar">
                    <ButtonGroup size="sm">
                        <Button
                            variant={roomMode === 'avgCount' ? 'secondary' : 'outline-secondary'}
                            onClick={() => setRoomMode('avgCount')}
                        >
                            Avg Count
                        </Button>
                        <Button
                            variant={roomMode === 'percent' ? 'secondary' : 'outline-secondary'}
                            onClick={() => setRoomMode('percent')}
                        >
                            Percent
                        </Button>
                    </ButtonGroup>
                </div>
                <ReactECharts option={roomOption} style={{ height: CHART_HEIGHT }} />
            </div>
        </div>
    );
}
