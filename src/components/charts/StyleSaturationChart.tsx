import { useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Button, ButtonGroup, Card, Form } from 'react-bootstrap';

import {
    buildStyleSaturation,
    DEFAULT_STYLE_SATURATION_OPTIONS,
    STYLE_SATURATION_COLORS,
    type StyleSaturationOptions,
} from '../../analytics/styleSaturation';
import type { TTRound } from '../../analytics/types';
import SectionHeading from '../SectionHeading';
import { chartTooltipStyle } from './chartTooltip';

export default function StyleSaturationChart({
    rounds,
    buildKey,
}: {
    rounds: TTRound[];
    buildKey: string;
}) {
    const [roomScope, setRoomScope] = useState<StyleSaturationOptions['roomScope']>(
        DEFAULT_STYLE_SATURATION_OPTIONS.roomScope,
    );
    const [includeTeam, setIncludeTeam] = useState(DEFAULT_STYLE_SATURATION_OPTIONS.includeTeam);
    const savedIncludeTeamRef = useRef(DEFAULT_STYLE_SATURATION_OPTIONS.includeTeam);

    const handleRoomScopeChange = (scope: StyleSaturationOptions['roomScope']) => {
        if (scope === roomScope) return;
        if (scope === 'opponent') {
            savedIncludeTeamRef.current = includeTeam;
            setIncludeTeam(false);
        } else {
            setIncludeTeam(savedIncludeTeamRef.current);
        }
        setRoomScope(scope);
    };

    const handleIncludeTeamChange = (checked: boolean) => {
        setIncludeTeam(checked);
        savedIncludeTeamRef.current = checked;
    };

    const data = useMemo(
        () => buildStyleSaturation(rounds, buildKey, { roomScope, includeTeam }),
        [rounds, buildKey, roomScope, includeTeam],
    );

    const maxCount = useMemo(
        () => Math.max(0, ...data.flatMap((series) => series.points.map((point) => point.count))),
        [data],
    );

    const xLabels = useMemo(
        () => Array.from({ length: maxCount + 1 }, (_, index) => String(index)),
        [maxCount],
    );

    const option = useMemo(() => ({
        backgroundColor: 'transparent',
        tooltip: {
            ...chartTooltipStyle,
            trigger: 'axis',
            formatter: (params: unknown) => {
                const items = (Array.isArray(params) ? params : [params]) as {
                    axisValue?: string;
                    seriesName?: string;
                    marker?: string;
                    value?: number | null;
                    data?: { races?: number };
                }[];
                if (items.length === 0) return '';
                const header = `${items[0].axisValue ?? ''} in room`;
                const lines = items
                    .filter((item) => item.value != null && Number.isFinite(item.value))
                    .map((item) => {
                        const races = item.data?.races ?? 0;
                        return `${item.marker ?? ''}${item.seriesName ?? ''}: ${item.value!.toFixed(1)}% · n=${races}`;
                    });
                return [`<b>${header}</b>`, ...lines.map((line) => `<b>${line}</b>`)].join('<br/>');
            },
        },
        legend: {
            data: data.map((series) => series.label),
            textStyle: { color: '#ced4da' },
            bottom: 0,
            type: 'scroll',
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
            name: 'Number of Umas',
            nameLocation: 'middle',
            nameGap: 28,
            boundaryGap: false,
            data: xLabels,
            axisLabel: { color: '#ced4da' },
            axisLine: { lineStyle: { color: '#6c757d' } },
        },
        yAxis: {
            type: 'value',
            name: 'Win Rate',
            nameLocation: 'middle',
            nameGap: 46,
            min: 0,
            max: 100,
            axisLabel: {
                color: '#ced4da',
                formatter: (value: number) => `${value}%`,
            },
            splitLine: { lineStyle: { color: '#343a40' } },
            axisLine: { show: true, lineStyle: { color: '#6c757d' } },
        },
        series: data.map((series) => ({
            name: series.label,
            type: 'line',
            smooth: true,
            showSymbol: true,
            symbolSize: 6,
            connectNulls: false,
            itemStyle: { color: STYLE_SATURATION_COLORS[series.styleId] ?? '#adb5bd' },
            lineStyle: { width: 2, color: STYLE_SATURATION_COLORS[series.styleId] ?? '#adb5bd' },
            data: xLabels.map((label) => {
                const point = series.points.find((entry) => entry.count === Number(label));
                if (!point || point.races === 0) return null;
                return {
                    value: point.winRate * 100,
                    races: point.races,
                };
            }),
        })),
    }), [data, xLabels]);

    const hasData = data.some((series) => series.points.some((point) => point.races > 0));

    return (
        <Card className="app-card h-100">
            <Card.Body>
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-1">
                    <SectionHeading title="Style Sensitivity" compact className="mt-0" />
                    <div className="d-flex flex-wrap align-items-center gap-2">
                        <ButtonGroup size="sm">
                            <Button
                                variant={roomScope === 'total' ? 'secondary' : 'outline-secondary'}
                                onClick={() => handleRoomScopeChange('total')}
                            >
                                Total Room
                            </Button>
                            <Button
                                variant={roomScope === 'opponent' ? 'secondary' : 'outline-secondary'}
                                onClick={() => handleRoomScopeChange('opponent')}
                            >
                                Opponent Only
                            </Button>
                        </ButtonGroup>
                        <Form.Check
                            type="switch"
                            id="style-saturation-include-team"
                            label="Include Own Team"
                            checked={includeTeam}
                            onChange={(event) => handleIncludeTeamChange(event.target.checked)}
                            className="mb-0 small text-secondary"
                        />
                    </div>
                </div>
                <div className="small text-muted mb-2">
                    Win rate vs. how many umas of each style are in the race                </div>
                {hasData ? (
                    <ReactECharts option={option} style={{ height: 320 }} />
                ) : (
                    <div className="text-muted small py-4 text-center">Not enough data</div>
                )}
            </Card.Body>
        </Card>
    );
}
