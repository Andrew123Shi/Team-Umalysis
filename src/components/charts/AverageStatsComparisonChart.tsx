import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

import AssetLoader from '../../data/AssetLoader';
import RatingDisplay from '../RatingDisplay';
import TeamRatingDisplay from '../TeamRatingDisplay';
import { chartTooltipStyle } from './chartTooltip';
import { BAR_CHART_GRID, BAR_CHART_HEIGHT, CHART_UPDATE_ANIMATION } from './chartLayout';

type StatValues = {
    speed: number;
    stamina: number;
    pow: number;
    guts: number;
    wiz: number;
};

type AverageStatsSummary = {
    stats: StatValues;
    rankScore: number;
    teamRating?: number;
};

const STAT_META = [
    { key: 'speed', label: 'Speed', icon: 'speed', color: '#23abff' },
    { key: 'stamina', label: 'Stamina', icon: 'stamina', color: '#ff6c58' },
    { key: 'pow', label: 'Power', icon: 'power', color: '#ff9919' },
    { key: 'guts', label: 'Guts', icon: 'guts', color: '#ff67a2' },
    { key: 'wiz', label: 'Wit', icon: 'wit', color: '#07c282' },
] as const;

function statValues(stats: StatValues): number[] {
    return [stats.speed, stats.stamina, stats.pow, stats.guts, stats.wiz];
}

function buildOption(title: string, stats: StatValues) {
    const values = statValues(stats);
    const maxValue = Math.max(...values, 1200);
    const yMax = Math.ceil(maxValue / 200) * 200;

    return {
        backgroundColor: 'transparent',
        ...CHART_UPDATE_ANIMATION,
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
                    axisValue?: string;
                    marker?: string;
                    value?: number;
                }[];
                const item = items[0];
                if (!item) return '';
                const meta = STAT_META.find((stat) => stat.key === item.axisValue);
                return `<b>${meta?.label ?? item.axisValue ?? ''}</b><br/><b>${item.marker ?? ''}${Math.round(item.value ?? 0)}</b>`;
            },
        },
        grid: { ...BAR_CHART_GRID },
        xAxis: {
            type: 'category',
            data: STAT_META.map((stat) => stat.key),
            axisTick: { show: false },
            axisLabel: {
                interval: 0,
                formatter: (value: string) => `{${value}|}`,
                rich: Object.fromEntries(STAT_META.map((stat) => [
                    stat.key,
                    {
                        width: 22,
                        height: 22,
                        align: 'center',
                        backgroundColor: {
                            image: AssetLoader.getStatIcon(stat.icon),
                        },
                    },
                ])),
            },
            axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.16)' } },
        },
        yAxis: {
            type: 'value',
            min: 0,
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
                formatter: ({ value }: { value: number }) => Math.round(value).toString(),
            },
            data: values.map((value, index) => {
                const color = STAT_META[index].color;
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
            }),
        }],
    };
}

function AverageStatsChart({
    title,
    summary,
    showTeamRating = true,
}: {
    title: string;
    summary: AverageStatsSummary;
    showTeamRating?: boolean;
}) {
    const option = useMemo(() => buildOption(title, summary.stats), [summary.stats, title]);

    return (
        <div className="average-stats-chart-block h-100">
            <ReactECharts option={option} style={{ height: BAR_CHART_HEIGHT }} />
            <div className={`average-stats-chart-footer${showTeamRating ? ' average-stats-chart-footer--opponent' : ''}`}>
                <RatingDisplay rankScore={summary.rankScore} label="Avg. Uma Rating" />
                {showTeamRating && summary.teamRating !== undefined && (
                    <TeamRatingDisplay teamRating={summary.teamRating} label="Avg. Team Rating" />
                )}
            </div>
        </div>
    );
}

export default function AverageStatsComparisonChart({
    opponent,
    npc,
    showTeamRating = true,
}: {
    opponent: AverageStatsSummary;
    npc: AverageStatsSummary;
    showTeamRating?: boolean;
}) {
    return (
        <div className="opponent-bar-chart-panel">
            <div className="row g-3 average-stats-chart-row opponent-bar-chart-row">
                <div className="col-lg-6">
                    <AverageStatsChart title="Average Opponent Stats" summary={opponent} showTeamRating={showTeamRating} />
                </div>
                <div className="col-lg-6">
                    <AverageStatsChart title="Average NPC Stats" summary={npc} showTeamRating={false} />
                </div>
            </div>
        </div>
    );
}
