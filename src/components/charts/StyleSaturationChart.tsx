import { useId, useMemo, useRef, useState } from 'react';
import EChart from './EChart';
import { Button, ButtonGroup, Card, Form } from 'react-bootstrap';

import {
    buildStyleSaturation,
    DEFAULT_STYLE_SATURATION_OPTIONS,
    STYLE_SATURATION_COLORS,
    type StyleSaturationOptions,
} from '../../analytics/styleSaturation';
import type { TTRound } from '../../analytics/types';
import SectionHeading from '../SectionHeading';
import { chartTooltipStyle, tooltipHead, tooltipRow } from './chartTooltip';
import {
    CHART_AXIS_LINE,
    CHART_COLORS,
    CHART_SPLIT_LINE,
    CHART_TEXT_STYLE,
    chartAxisLabel,
    chartAxisName,
    chartLegend,
    useChartScale,
} from './chartTheme';

export default function StyleSaturationChart({
    rounds,
    buildKey,
}: {
    rounds: TTRound[];
    buildKey: string;
}) {
    const scale = useChartScale();
    const includeTeamId = useId();
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
        textStyle: CHART_TEXT_STYLE,
        tooltip: {
            ...chartTooltipStyle,
            trigger: 'axis',
            axisPointer: { type: 'line', lineStyle: { color: CHART_COLORS.pointer, type: 'dashed' } },
            formatter: (params: unknown) => {
                const items = (Array.isArray(params) ? params : [params]) as {
                    axisValue?: string;
                    seriesName?: string;
                    marker?: string;
                    value?: number | null;
                    data?: { races?: number };
                }[];
                if (items.length === 0) return '';
                const rows = items
                    .filter((item) => item.value != null && Number.isFinite(item.value))
                    .map((item) => tooltipRow(
                        `${item.marker ?? ''}${item.seriesName ?? ''}`,
                        `${item.value!.toFixed(1)}% · n=${item.data?.races ?? 0}`,
                    ));
                return tooltipHead(`${items[0].axisValue ?? ''} In Room`) + rows.join('');
            },
        },
        legend: chartLegend(scale, { data: data.map((series) => series.label), type: 'scroll' }),
        grid: {
            left: scale.px(4),
            right: scale.px(12),
            top: scale.px(14),
            bottom: scale.px(60),
            containLabel: true,
        },
        xAxis: {
            type: 'category',
            name: 'Umas of style in room',
            nameLocation: 'middle',
            nameGap: scale.px(32),
            nameTextStyle: chartAxisName(scale),
            boundaryGap: false,
            data: xLabels,
            axisTick: { show: false },
            axisLabel: chartAxisLabel(scale),
            axisLine: CHART_AXIS_LINE,
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: 100,
            interval: 25,
            axisLabel: chartAxisLabel(scale, { formatter: (value: number) => `${value}%` }),
            splitLine: CHART_SPLIT_LINE,
        },
        series: data.map((series) => {
            const color = STYLE_SATURATION_COLORS[series.styleId] ?? CHART_COLORS.legend;
            return {
                name: series.label,
                type: 'line',
                smooth: true,
                showSymbol: true,
                symbol: 'circle',
                symbolSize: scale.px(6),
                connectNulls: false,
                itemStyle: { color, borderColor: '#0b0d11', borderWidth: 1.5 },
                lineStyle: { width: 2, color },
                data: xLabels.map((label) => {
                    const point = series.points.find((entry) => entry.count === Number(label));
                    if (!point || point.races === 0) return null;
                    return {
                        value: point.winRate * 100,
                        races: point.races,
                    };
                }),
            };
        }),
    }), [data, xLabels, scale]);

    const hasData = data.some((series) => series.points.some((point) => point.races > 0));

    return (
        <Card className="app-card h-100">
            <Card.Body>
                <SectionHeading
                    title="Style Sensitivity"
                    info="Win rate vs. how many umas of each style are in the race"
                    actions={(
                        <div className="chart-tools is-stacked">
                            <ButtonGroup size="sm">
                                <Button
                                    variant={roomScope === 'total' ? 'secondary' : 'outline-secondary'}
                                    onClick={() => handleRoomScopeChange('total')}
                                >
                                    Full Room
                                </Button>
                                <Button
                                    variant={roomScope === 'opponent' ? 'secondary' : 'outline-secondary'}
                                    onClick={() => handleRoomScopeChange('opponent')}
                                >
                                    Opponents
                                </Button>
                            </ButtonGroup>
                            <Form.Check
                                type="switch"
                                id={includeTeamId}
                                label="Own team"
                                checked={includeTeam}
                                onChange={(event) => handleIncludeTeamChange(event.target.checked)}
                                className="chart-switch"
                            />
                        </div>
                    )}
                />
                {hasData ? (
                    <EChart option={option} style={{ height: scale.px(300) }} />
                ) : (
                    <div className="empty-note">Not enough data</div>
                )}
            </Card.Body>
        </Card>
    );
}
