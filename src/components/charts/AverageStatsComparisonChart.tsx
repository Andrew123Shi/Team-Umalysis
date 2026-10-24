import { memo, useMemo } from 'react';
import type { AggregatedStats, NumericSummary } from '../../analytics/types';
import AssetLoader from '../../data/AssetLoader';
import { AnimatedText } from '../AnimatedNumber';
import RatingDisplay from '../RatingDisplay';
import TeamRatingDisplay from '../TeamRatingDisplay';
import CompareGrid, { type CompareColumn, type CompareRow } from './CompareGrid';
import { rangeTip } from './RangeTrack';

type StatKey = 'speed' | 'stamina' | 'pow' | 'guts' | 'wiz';

type AverageStatsSummary = {
    stats: Record<StatKey, NumericSummary>;
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

/** Whisker domains snap to this step, and the track draws a tick at each step. */
const STAT_TICK_STEP = 200;

function signed(value: number): string {
    const rounded = Math.round(value);
    if (rounded === 0) return '±0';
    const magnitude = Math.abs(rounded).toLocaleString();
    return rounded > 0 ? `+${magnitude}` : `−${magnitude}`;
}

const roundStat = (value: number) => String(Math.round(value));

function AverageStatsComparisonChart({
    stats,
    showTeamRating = true,
}: {
    stats: AggregatedStats;
    showTeamRating?: boolean;
}) {
    const opponent: AverageStatsSummary = {
        stats: stats.opponentStats,
        rankScore: stats.opponentStats.rankScore.avg,
        teamRating: stats.opponentStats.teamRating.avg,
    };
    const npc: AverageStatsSummary = {
        stats: stats.npcStats,
        rankScore: stats.npcStats.rankScore.avg,
    };
    const rows = useMemo<CompareRow[]>(() => {
        // One domain for every stat so whiskers compare across rows as well as columns.
        const summaries = STAT_META.flatMap((stat) => [opponent.stats[stat.key], npc.stats[stat.key]])
            .filter((summary) => summary.count > 0);
        const low = Math.min(...summaries.map((summary) => summary.min));
        const high = Math.max(...summaries.map((summary) => summary.max));
        const domainMin = Number.isFinite(low) ? Math.floor(low / STAT_TICK_STEP) * STAT_TICK_STEP : 0;
        const domainMax = Number.isFinite(high)
            ? Math.max(domainMin + STAT_TICK_STEP, Math.ceil(high / STAT_TICK_STEP) * STAT_TICK_STEP)
            : 1200;
        const ticks = (domainMax - domainMin) / STAT_TICK_STEP + 1;
        const cell = (group: string, label: string, color: string, summary: NumericSummary) => ({
            fraction: 0,
            range: {
                min: summary.min,
                max: summary.max,
                avg: summary.avg,
                median: summary.median,
                domainMin,
                domainMax,
                ticks,
            },
            value: roundStat(summary.avg),
            tip: rangeTip(`${group} · ${label}`, summary, roundStat, { color }),
        });
        return STAT_META.map((stat) => {
            const opp = opponent.stats[stat.key];
            const base = npc.stats[stat.key];
            return {
                key: stat.key,
                label: stat.label,
                icon: AssetLoader.getStatIcon(stat.icon),
                color: stat.color,
                cells: [cell('Opponents', stat.label, stat.color, opp), cell('NPCs', stat.label, stat.color, base)],
                aside: <span className="cmp-delta"><AnimatedText text={signed(opp.avg - base.avg)} /></span>,
            };
        });
    }, [opponent.stats, npc.stats]);

    const umaRating = (rankScore: number) => (
        <span className="cmp-rating is-uma">
            <small>Uma rating</small>
            <RatingDisplay rankScore={rankScore} showLabel={false} />
        </span>
    );

    const columns: CompareColumn[] = [
        {
            key: 'opponent',
            title: 'Opponents',
            metaCenter: showTeamRating && opponent.teamRating !== undefined ? (
                <span className="cmp-rating is-team">
                    <small>Team rating</small>
                    <TeamRatingDisplay teamRating={opponent.teamRating} showLabel={false} />
                </span>
            ) : null,
            metaEnd: umaRating(opponent.rankScore),
        },
        { key: 'npc', title: 'NPCs', metaEnd: umaRating(npc.rankScore) },
    ];

    return <CompareGrid columns={columns} rows={rows} asideTitle="Δ" />;
}

export default memo(AverageStatsComparisonChart);
