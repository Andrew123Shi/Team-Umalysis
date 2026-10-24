import { useMemo, type ReactNode } from 'react';
import type { AggregatedStats, NumericSummary } from '../../analytics/types';
import { formatScore } from '../../utils/formatScore';
import { AnimatedText } from '../AnimatedNumber';
import SectionHeading from '../SectionHeading';
import Histogram, { buildContinuousBins, type HistogramBin } from './Histogram';
import { OUTCOME_COLORS, WinRateDonut, WinRateLegend, WinRateRings, TeamPlacementRings } from './WinRatePies';

export type StatCardViewMode = 'team' | 'uma' | 'distance';

/** Gold / silver / bronze for the podium, then tan for the remaining scoring places. */
const PLACE_COLORS = ['#f2c14e', '#c9d1d9', '#d08a4f', '#e8d4b6', '#e8d4b6'];

function ordinal(n: number): string {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    const suffix = ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
    return `${n}${suffix}`;
}

function formatPosition(value: number): string {
    return Number.isInteger(value) ? ordinal(value) : value.toFixed(1);
}

function KpiCard({
    title,
    className = '',
    children,
}: {
    title: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={['app-card', 'kpi-card', className].filter(Boolean).join(' ')}>
            <SectionHeading title={title} />
            {children}
        </section>
    );
}

function KpiCount({ value, total, label }: { value: number; total: number; label: string }) {
    return (
        <div className="kpi-count">
            <strong><AnimatedText text={String(value)} /><span>/<AnimatedText text={String(total)} /></span></strong>
            <span className="kpi-count-label">{label}</span>
        </div>
    );
}

function MetaItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="kpi-meta-item">
            <dt>{label}</dt>
            <dd><AnimatedText text={value} /></dd>
        </div>
    );
}

function ScoreKpi({
    title,
    summary,
    inGameAvg,
    values,
    scaleValues,
    unit,
}: {
    title: string;
    summary: NumericSummary;
    /** Shown only when the score bonus settings make avg differ from the in-game score. */
    inGameAvg?: number;
    values: number[];
    /** Full-history scores the bin width is taken from, so every scope shares bins. */
    scaleValues?: number[];
    unit: string;
}) {
    const bins = useMemo(() => buildContinuousBins(values, scaleValues), [values, scaleValues]);
    if (summary.count === 0) {
        return (
            <KpiCard title={title}>
                <div className="empty-note">No data</div>
            </KpiCard>
        );
    }
    const showInGame = inGameAvg !== undefined && Math.round(inGameAvg) !== Math.round(summary.avg);
    const hasHistogram = values.length >= 3;

    return (
        <KpiCard title={title} className="kpi-score">
            <div className="kpi-head">
                <div className="kpi-figure"><AnimatedText text={formatScore(summary.avg)} /></div>
                <dl className="kpi-meta">
                    {!hasHistogram && <MetaItem label="Median" value={formatScore(summary.median)} />}
                    {showInGame && <MetaItem label="In-game" value={formatScore(inGameAvg)} />}
                </dl>
            </div>
            {hasHistogram && (
                <Histogram
                    bins={bins}
                    avg={summary.avg}
                    median={summary.median}
                    min={summary.min}
                    max={summary.max}
                    format={formatScore}
                    unit={unit}
                />
            )}
        </KpiCard>
    );
}

function RaceRatesBlock({
    winRate,
    top2,
    top3,
    raceCount,
    raceWins,
}: {
    winRate: number;
    top2: number;
    top3: number;
    raceCount: number;
    raceWins: number;
}) {
    return (
        <div className="ring-stat">
            <WinRateRings winRate={winRate} top2Rate={top2} top3Rate={top3} />
            <div className="ring-stat-body">
                <KpiCount value={raceWins} total={raceCount} label="races won" />
                <WinRateLegend
                    items={[
                        { label: 'Win', value: winRate, color: OUTCOME_COLORS.win },
                        { label: 'Top 2', value: top2, color: OUTCOME_COLORS.top2 },
                        { label: 'Top 3', value: top3, color: OUTCOME_COLORS.top3 },
                    ]}
                />
            </div>
        </div>
    );
}

function TeamWinRatesCard({
    stats,
    winRate,
    top2,
    top3,
    raceCount,
    raceWins,
}: {
    stats: AggregatedStats;
    winRate: number;
    top2: number;
    top3: number;
    raceCount: number;
    raceWins: number;
}) {
    const trialWins = Math.round(stats.sessionWinRate * stats.totalSessions);
    return (
        <KpiCard title="Win Rate" className="kpi-win-rates">
            <div className="kpi-split">
                <div className="kpi-split-cell">
                    <div className="kpi-sublabel">Trials</div>
                    <div className="ring-stat">
                        <WinRateDonut value={stats.sessionWinRate} />
                        <div className="ring-stat-body">
                            <KpiCount value={trialWins} total={stats.totalSessions} label="trials won" />
                            <WinRateLegend
                                items={[
                                    { label: 'Win', value: stats.sessionWinRate, color: OUTCOME_COLORS.win },
                                    { label: 'Loss', value: 1 - stats.sessionWinRate, color: OUTCOME_COLORS.loss },
                                ]}
                            />
                        </div>
                    </div>
                </div>
                <div className="kpi-split-cell">
                    <div className="kpi-sublabel">Races</div>
                    <RaceRatesBlock winRate={winRate} top2={top2} top3={top3} raceCount={raceCount} raceWins={raceWins} />
                </div>
            </div>
        </KpiCard>
    );
}

function TeamPlacementCard({
    allPodiumRate,
    allPlacedRate,
    raceCount,
}: {
    allPodiumRate: number;
    allPlacedRate: number;
    raceCount: number;
}) {
    return (
        <KpiCard title="Team Placement">
            <div className="ring-stat">
                <TeamPlacementRings allPodiumRate={allPodiumRate} allPlacedRate={allPlacedRate} />
                <div className="ring-stat-body">
                    <KpiCount value={Math.round(allPlacedRate * raceCount)} total={raceCount} label="all placed" />
                    <WinRateLegend
                        items={[
                            { label: 'All Podiumed (1st/2nd/3rd)', value: allPodiumRate, color: OUTCOME_COLORS.podium },
                            { label: 'All Placed (≤5th)', value: allPlacedRate, color: OUTCOME_COLORS.placed },
                        ]}
                    />
                </div>
            </div>
        </KpiCard>
    );
}

function PlacementCard({
    placement,
    counts,
    raceCount,
}: {
    placement: NumericSummary;
    counts: number[];
    raceCount: number;
}) {
    const bins = useMemo<HistogramBin[]>(() => counts.map((count, index) => ({
        lo: index + 0.5,
        hi: index + 1.5,
        count,
        tick: String(index + 1),
        color: PLACE_COLORS[index],
    })), [counts]);

    if (placement.count === 0) {
        return (
            <KpiCard title="Average Finishing Position">
                <div className="empty-note">No data</div>
            </KpiCard>
        );
    }
    return (
        <KpiCard title="Average Finishing Position" className="kpi-score kpi-placement">
            <div className="kpi-head">
                <div className="kpi-figure"><AnimatedText text={placement.avg.toFixed(2)} /></div>
            </div>
            <Histogram
                bins={bins}
                avg={placement.avg}
                median={placement.median}
                min={placement.min}
                max={placement.max}
                format={formatPosition}
                minLabel="best"
                maxLabel="worst"
                binTip={(bin) => {
                    const share = raceCount > 0 ? (bin.count / raceCount) * 100 : 0;
                    return {
                        head: ordinal(bin.lo + 0.5),
                        color: bin.color,
                        rows: [
                            { label: 'Races', value: bin.count },
                            { label: 'Share', value: `${share.toFixed(1)}%` },
                        ],
                    };
                }}
            />
        </KpiCard>
    );
}

export default function StatCards({
    stats,
    scaleTrend = stats.scoreTrend,
    viewMode = 'team',
    distanceWinRatesPanel,
}: {
    stats: AggregatedStats;
    /** Full-history trend when `stats` is a recent subset; sets the histogram bin width. */
    scaleTrend?: AggregatedStats['scoreTrend'];
    viewMode?: StatCardViewMode;
    distanceWinRatesPanel?: ReactNode;
}) {
    const isUmaView = viewMode === 'uma';
    const winRate = isUmaView ? stats.winRate : stats.roundWinRate;
    const top2 = isUmaView ? stats.top2Rate : stats.roundTop2Rate;
    const top3 = isUmaView ? stats.top3Rate : stats.roundTop3Rate;
    const raceCount = stats.totalRounds;
    const raceWins = Math.round(winRate * raceCount);
    const trendScores = useMemo(() => stats.scoreTrend.map((point) => point.teamScore), [stats.scoreTrend]);
    const scaleScores = useMemo(() => scaleTrend.map((point) => point.teamScore), [scaleTrend]);

    if (isUmaView) {
        return (
            <div className="kpi-grid is-uma">
                <KpiCard title="Race Win Rate">
                    <RaceRatesBlock winRate={winRate} top2={top2} top3={top3} raceCount={raceCount} raceWins={raceWins} />
                </KpiCard>
                <ScoreKpi title="Average Score" summary={stats.score} values={trendScores} unit="races" />
                <PlacementCard placement={stats.placement} counts={stats.placementCounts} raceCount={raceCount} />
            </div>
        );
    }

    if (viewMode === 'distance') {
        return (
            <div className="kpi-grid is-distance">
                <ScoreKpi
                    title="Average Race Score"
                    summary={stats.teamScore}
                    inGameAvg={stats.teamScoreInGame.avg}
                    values={trendScores}
                    scaleValues={scaleScores}
                    unit="races"
                />
                <KpiCard title="Race Win Rate">
                    <RaceRatesBlock winRate={winRate} top2={top2} top3={top3} raceCount={raceCount} raceWins={raceWins} />
                </KpiCard>
                <TeamPlacementCard
                    allPodiumRate={stats.roundAllPodiumRate}
                    allPlacedRate={stats.roundAllPlacedRate}
                    raceCount={raceCount}
                />
            </div>
        );
    }

    return (
        <div className="kpi-grid is-overview">
            <TeamWinRatesCard
                stats={stats}
                winRate={winRate}
                top2={top2}
                top3={top3}
                raceCount={raceCount}
                raceWins={raceWins}
            />
            <ScoreKpi
                title="Average Total Score"
                summary={stats.raceScoreTotal}
                inGameAvg={stats.raceScoreTotalInGame.avg}
                values={trendScores}
                scaleValues={scaleScores}
                unit="trials"
            />
            {distanceWinRatesPanel}
        </div>
    );
}
