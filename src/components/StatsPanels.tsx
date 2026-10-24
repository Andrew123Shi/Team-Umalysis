import { Button, ButtonGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import type { AggregatedStats, TTRound, UmaEntry } from '../analytics/types';

import SectionHeading from './SectionHeading';
import { useLoadingRemainingFiles } from './RemainingFilesLoadingAlert';

import MatchupTable from './charts/MatchupTable';

import ScoreTrendChart from './charts/ScoreTrendChart';
import TeamRatingTrendChart from './charts/TeamRatingTrendChart';
import WinRateTrendChart from './charts/WinRateTrendChart';

import SkillTable from './charts/SkillTable';

import StatCards, { type StatCardViewMode } from './charts/StatCards';

import ScoreBreakdownPanel from './charts/ScoreBreakdownPanel';
import MoodWinRateChart from './charts/MoodWinRateChart';
import StyleSaturationChart from './charts/StyleSaturationChart';
import AverageStatsComparisonChart from './charts/AverageStatsComparisonChart';
import { WinRatePieCard } from './charts/WinRatePies';
import UmaProfilePanel from './UmaProfilePanel';
import { formatScore } from '../utils/formatScore';
import { AnimatedText } from './AnimatedNumber';

import StyleCompositionChart from './charts/StyleCompositionChart';

export type StatsScope = 'recent' | 'overall';
type OverviewSectionKey = 'summary' | 'progression' | 'opponentCharacteristics' | 'skill' | 'racetrack' | 'uma';
type OverviewSectionScopes = Record<OverviewSectionKey, StatsScope>;

const DEFAULT_OVERVIEW_SECTION_SCOPES: OverviewSectionScopes = {
    summary: 'recent',
    progression: 'recent',
    opponentCharacteristics: 'recent',
    skill: 'recent',
    racetrack: 'recent',
    uma: 'recent',
};

export function StatsScopeToggle({
    value,
    onChange,
}: {
    value: StatsScope;
    onChange: (value: StatsScope) => void;
}) {
    const overallDisabled = useLoadingRemainingFiles();
    const overallButton = (
        <Button
            variant={value === 'overall' ? 'secondary' : 'outline-secondary'}
            className={overallDisabled ? 'disabled' : undefined}
            aria-disabled={overallDisabled}
            tabIndex={overallDisabled ? -1 : undefined}
            // Bootstrap .disabled sets pointer-events:none; keep hover so the tooltip works.
            style={overallDisabled ? { pointerEvents: 'auto' } : undefined}
            onClick={() => {
                if (overallDisabled) return;
                onChange('overall');
            }}
        >
            Overall
        </Button>
    );

    return (
        <ButtonGroup size="sm">
            <Button
                variant={value === 'recent' ? 'secondary' : 'outline-secondary'}
                onClick={() => onChange('recent')}
            >
                Recent
            </Button>
            {overallDisabled ? (
                <OverlayTrigger
                    placement="top"
                    overlay={<Tooltip id="overall-scope-loading">Loading...</Tooltip>}
                >
                    {overallButton}
                </OverlayTrigger>
            ) : (
                overallButton
            )}
        </ButtonGroup>
    );
}

function DistanceWinRatesPanel({ stats }: { stats: AggregatedStats }) {
    return (
        <section className="app-card kpi-card kpi-distances">
            <SectionHeading title="Distance Win Rates" />
            <div className="ring-tile-grid">
                {stats.distanceWinRates.map((d) => (
                    <WinRatePieCard
                        key={d.distance}
                        title={d.distance}
                        value={d.winRate}
                        detail={(
                            <>
                                <strong><AnimatedText text={String(Math.round(d.winRate * d.appearances))} /></strong>
                                /<AnimatedText text={String(d.appearances)} />
                            </>
                        )}
                        footer={(
                            <>
                                <span>Avg</span>
                                <strong><AnimatedText text={formatScore(d.avgScore)} /></strong>
                            </>
                        )}
                    />
                ))}
            </div>
        </section>
    );
}

function AnalyticsSection({
    showHeader,
    title,
    subtitle,
    actions,
    children,
}: {
    showHeader: boolean;
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    children: ReactNode;
}) {
    if (!showHeader) {
        return <div className="analytics-section">{children}</div>;
    }
    return (
        <section className="analytics-section">
            <SectionHeading level="section" title={title} subtitle={subtitle} actions={actions} />
            {children}
        </section>
    );
}


export default function StatsPanels({

    stats,
    summaryStats = stats,
    summaryScope,
    onSummaryScopeChange,
    recentStats,
    emaSourceTrend,

    viewMode = 'team',

    showDistanceWinRates = true,

    styleSaturationRounds,

    styleSaturationBuildKey,

    latestUmaEntry,

    profileUma,

}: {

    stats: AggregatedStats;
    summaryStats?: AggregatedStats;
    summaryScope?: StatsScope;
    onSummaryScopeChange?: (value: StatsScope) => void;
    recentStats?: AggregatedStats;
    emaSourceTrend?: AggregatedStats['scoreTrend'];

    viewMode?: StatCardViewMode | 'distance';

    showDistanceWinRates?: boolean;

    styleSaturationRounds?: TTRound[];

    styleSaturationBuildKey?: string;

    latestUmaEntry?: UmaEntry | null;

    profileUma?: {
        charaName: string;
        cardId: number;
        rankScore: number;
        stats: UmaEntry['stats'];
        distanceType: number;
    } | null;

}) {

    const isUmaView = viewMode === 'uma';
    const isDistanceView = viewMode === 'distance';
    const isTeamView = viewMode === 'team';
    const showSectionHeaders = !isDistanceView;
    const showOverviewPerformanceExtras = showDistanceWinRates && isTeamView;
    const [overviewSectionScopes, setOverviewSectionScopes] = useState<OverviewSectionScopes>(
        DEFAULT_OVERVIEW_SECTION_SCOPES,
    );
    const loadingRemaining = useLoadingRemainingFiles();
    useEffect(() => {
        if (!loadingRemaining) return;
        setOverviewSectionScopes(DEFAULT_OVERVIEW_SECTION_SCOPES);
    }, [loadingRemaining]);
    const showOverviewScopeControls = isTeamView && showDistanceWinRates && recentStats !== undefined;
    const overviewStatsFor = (section: OverviewSectionKey): AggregatedStats => (
        showOverviewScopeControls && overviewSectionScopes[section] === 'recent'
            ? recentStats
            : stats
    );
    const overviewActionsFor = (section: OverviewSectionKey): ReactNode | undefined => {
        if (!showOverviewScopeControls) return undefined;
        return (
            <StatsScopeToggle
                value={overviewSectionScopes[section]}
                onChange={(value) => setOverviewSectionScopes((current) => ({
                    ...current,
                    [section]: value,
                }))}
            />
        );
    };
    const summaryDisplayStats = showOverviewScopeControls
        ? overviewStatsFor('summary')
        : summaryStats;
    const summaryActions = summaryScope && onSummaryScopeChange ? (
        <StatsScopeToggle value={summaryScope} onChange={onSummaryScopeChange} />
    ) : overviewActionsFor('summary');

    const buildOpponentChart = (chartStats: AggregatedStats) => (
        <AverageStatsComparisonChart showTeamRating={!isDistanceView} stats={chartStats} />
    );
    const opponentChart = buildOpponentChart(stats);
    const progressionStats = overviewStatsFor('progression');
    const progressionUsesRecent = showOverviewScopeControls
        && overviewSectionScopes.progression === 'recent';
    // While older files load, avoid warm-starting EMA from incomplete "overall" history.
    const progressionEmaSource = loadingRemaining
        ? undefined
        : (emaSourceTrend ?? (progressionUsesRecent ? stats.scoreTrend : undefined));
    const opponentCharacteristicsStats = overviewStatsFor('opponentCharacteristics');
    const skillStats = overviewStatsFor('skill');
    const racetrackStats = overviewStatsFor('racetrack');
    const umaStats = overviewStatsFor('uma');

    return (

        <>

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title={isUmaView ? 'Uma Profile' : 'Summary'}
                actions={!isUmaView ? summaryActions : undefined}
            >

                {isUmaView && profileUma ? (
                    <div className="uma-profile-layout">
                        <div className="uma-profile-column">
                            <UmaProfilePanel
                                charaName={profileUma.charaName}
                                cardId={profileUma.cardId}
                                rankScore={profileUma.rankScore}
                                stats={profileUma.stats}
                                distanceType={profileUma.distanceType}
                                entry={latestUmaEntry ?? null}
                            />
                            {styleSaturationRounds && styleSaturationBuildKey && (
                                <div className="layout-grid is-2 is-tight">
                                    <StyleSaturationChart
                                        rounds={styleSaturationRounds}
                                        buildKey={styleSaturationBuildKey}
                                    />
                                    <MoodWinRateChart
                                        rounds={styleSaturationRounds}
                                        buildKey={styleSaturationBuildKey}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="uma-profile-column">
                            <StatCards stats={stats} viewMode="uma" />
                            {stats.scoreBreakdown && (
                                <ScoreBreakdownPanel breakdown={stats.scoreBreakdown} />
                            )}
                        </div>
                    </div>
                ) : (
                    <StatCards
                        stats={summaryDisplayStats}
                        scaleTrend={emaSourceTrend ?? stats.scoreTrend}
                        viewMode={viewMode as StatCardViewMode}
                        distanceWinRatesPanel={showOverviewPerformanceExtras
                            ? <DistanceWinRatesPanel stats={summaryDisplayStats} />
                            : undefined}
                    />
                )}
            </AnalyticsSection>

            {!showDistanceWinRates && !isUmaView && !isDistanceView && (

                <AnalyticsSection
                    showHeader={showSectionHeaders}
                    title="Opponent Analysis"
                    subtitle="Average stats for opponents and NPCs"
                >

                    <section className="app-card">
                        {opponentChart}
                    </section>

                </AnalyticsSection>

            )}

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title="Progression Trends"
                actions={overviewActionsFor('progression')}
            >
                <div className="layout-stack">
                    <section className="app-card">
                        <ScoreTrendChart
                            stats={progressionStats}
                            emaSourceTrend={progressionEmaSource}
                            viewMode={viewMode as StatCardViewMode}
                        />
                    </section>

                    {progressionStats.scoreTrend.length > 0 && !isUmaView && (
                        <section className="app-card">
                            <TeamRatingTrendChart
                                stats={progressionStats}
                                emaSourceTrend={progressionEmaSource}
                            />
                        </section>
                    )}
                    {progressionStats.scoreTrend.length > 0 && (
                        <section className="app-card">
                            <WinRateTrendChart
                                stats={progressionStats}
                                sourceTrend={progressionEmaSource}
                                showRaceWinRate={isTeamView}
                                averageSeriesLabel={isUmaView ? 'Average' : undefined}
                            />
                        </section>
                    )}
                </div>
            </AnalyticsSection>

            {!isUmaView && (
                <AnalyticsSection
                    showHeader={showSectionHeaders}
                    title="Opponent Characteristics"
                    actions={overviewActionsFor('opponentCharacteristics')}
                >
                    <div className="layout-grid is-2 is-wide">
                        <section className="app-card">
                            <SectionHeading title="Running Style Composition" />
                            <StyleCompositionChart
                                opponent={opponentCharacteristicsStats.opponentStyleComposition}
                                opponentAvgCount={opponentCharacteristicsStats.opponentStyleCompositionAvgCount}
                                npcPercent={opponentCharacteristicsStats.npcStyleComposition}
                                npcAvgCount={opponentCharacteristicsStats.npcStyleCompositionAvgCount}
                                roomPercent={opponentCharacteristicsStats.roomStyleComposition}
                                roomAvgCount={opponentCharacteristicsStats.roomStyleCompositionAvgCount}
                            />
                        </section>
                        <section className="app-card">
                            <SectionHeading title="Average Stats" />
                            {buildOpponentChart(opponentCharacteristicsStats)}
                        </section>
                    </div>
                </AnalyticsSection>
            )}

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title="Skill Analysis"
                actions={overviewActionsFor('skill')}
            >
                <div className="layout-grid is-2">
                    <SkillTable title="Skill Activations" skills={skillStats.playerSkillActivations} mode="player" />
                    {!isUmaView && (
                        <SkillTable title="Most Common Opponent Skills" skills={skillStats.opponentSkills} mode="opponent" />
                    )}
                </div>
            </AnalyticsSection>

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title="Racetrack Analysis"
                actions={overviewActionsFor('racetrack')}
            >
                <div className="layout-grid is-2">
                    <MatchupTable
                        entries={racetrackStats.trackMatchups}
                        title="Relative Overperformance"
                        variant="track"
                        defaultSortKey="avgNormalizedScore"
                    />
                    <MatchupTable
                        entries={racetrackStats.trackMatchups}
                        title="Relative Underperformance"
                        variant="track"
                        defaultSortKey="avgNormalizedScore"
                        defaultSortDir="asc"
                    />
                </div>
            </AnalyticsSection>

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title="Uma Analysis"
                actions={overviewActionsFor('uma')}
            >
                <div className={`layout-grid${isUmaView ? ' is-2' : ' is-3'}`}>
                    {!isUmaView && (
                        <MatchupTable
                            entries={umaStats.matchups}
                            title="Most Common Opponents"
                            defaultSortKey="appearances"
                            defaultSortDir="desc"
                            defaultOccurrenceFilter="all"
                            compactColumns={isDistanceView}
                        />
                    )}
                    <MatchupTable
                        entries={umaStats.matchups}
                        title="Relative Overperformance"
                        defaultSortKey="winRate"
                        defaultSortDir="desc"
                        compactColumns={isDistanceView}
                    />
                    <MatchupTable
                        entries={umaStats.matchups}
                        title="Relative Underperformance"
                        defaultSortKey="winRate"
                        defaultSortDir="asc"
                        compactColumns={isDistanceView}
                    />
                </div>
            </AnalyticsSection>
        </>
    );
}
