import { Button, ButtonGroup, Card } from 'react-bootstrap';
import { useState } from 'react';
import type { ReactNode } from 'react';

import type { AggregatedStats, TTRound, UmaEntry } from '../analytics/types';

import { COL_HALF, COL_THIRD } from './layout';
import SectionHeading from './SectionHeading';

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
    return (
        <ButtonGroup size="sm">
            <Button
                variant={value === 'recent' ? 'secondary' : 'outline-secondary'}
                onClick={() => onChange('recent')}
            >
                Recent
            </Button>
            <Button
                variant={value === 'overall' ? 'secondary' : 'outline-secondary'}
                onClick={() => onChange('overall')}
            >
                Overall
            </Button>
        </ButtonGroup>
    );
}

function DistanceWinRatesPanel({ stats }: { stats: AggregatedStats }) {
    return (
        <Card className="app-card h-100">
            <Card.Body>
                <SectionHeading title="Distance Win Rates" compact className="mt-0" />
                <div className="distance-win-rates-grid">
                    {stats.distanceWinRates.map((d) => (
                        <div key={d.distance} className="distance-win-rate-cell">
                            <WinRatePieCard
                                title={d.distance}
                                value={d.winRate}
                                detail={`${Math.round(d.winRate * d.appearances)}/${d.appearances} wins`}
                                footer={(
                                    <>
                                        <span>Avg. Score</span>
                                        <strong>{formatScore(d.avgScore)}</strong>
                                    </>
                                )}
                            />
                        </div>
                    ))}
                </div>
            </Card.Body>
        </Card>
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
            {actions ? (
                <div className="section-heading-action-row">
                    <SectionHeading level="section" title={title} subtitle={subtitle} />
                    {actions}
                </div>
            ) : (
                <SectionHeading level="section" title={title} subtitle={subtitle} />
            )}
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
    const hideMatchupOutfitName = isDistanceView;
    const showSectionHeaders = !isDistanceView;
    const showOverviewPerformanceExtras = showDistanceWinRates && isTeamView;
    const [overviewSectionScopes, setOverviewSectionScopes] = useState<OverviewSectionScopes>(
        DEFAULT_OVERVIEW_SECTION_SCOPES,
    );
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
        <AverageStatsComparisonChart
            showTeamRating={!isDistanceView}
            opponent={{
                stats: {
                    speed: chartStats.opponentStats.speed.avg,
                    stamina: chartStats.opponentStats.stamina.avg,
                    pow: chartStats.opponentStats.pow.avg,
                    guts: chartStats.opponentStats.guts.avg,
                    wiz: chartStats.opponentStats.wiz.avg,
                },
                rankScore: chartStats.opponentStats.rankScore.avg,
                teamRating: chartStats.opponentStats.teamRating.avg,
            }}
            npc={{
                stats: {
                    speed: chartStats.npcStats.speed.avg,
                    stamina: chartStats.npcStats.stamina.avg,
                    pow: chartStats.npcStats.pow.avg,
                    guts: chartStats.npcStats.guts.avg,
                    wiz: chartStats.npcStats.wiz.avg,
                },
                rankScore: chartStats.npcStats.rankScore.avg,
            }}
        />
    );
    const opponentChart = buildOpponentChart(stats);
    const progressionStats = overviewStatsFor('progression');
    const progressionUsesRecent = showOverviewScopeControls
        && overviewSectionScopes.progression === 'recent';
    const progressionEmaSource = emaSourceTrend
        ?? (progressionUsesRecent ? stats.scoreTrend : undefined);
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
                    <div className="row g-3 align-items-stretch">
                        <div className="col-lg-5 d-flex flex-column gap-3 uma-profile-column">
                            <UmaProfilePanel
                                charaName={profileUma.charaName}
                                cardId={profileUma.cardId}
                                rankScore={profileUma.rankScore}
                                stats={profileUma.stats}
                                distanceType={profileUma.distanceType}
                                entry={latestUmaEntry ?? null}
                            />
                            {styleSaturationRounds && styleSaturationBuildKey && (
                                <>
                                    <StyleSaturationChart
                                        rounds={styleSaturationRounds}
                                        buildKey={styleSaturationBuildKey}
                                    />
                                    <MoodWinRateChart
                                        rounds={styleSaturationRounds}
                                        buildKey={styleSaturationBuildKey}
                                    />
                                </>
                            )}
                        </div>
                        <div className="col-lg-7 d-flex flex-column gap-3 uma-profile-stats-column">
                            <StatCards
                                stats={stats}
                                viewMode="uma"
                                showSessionWinRate={false}
                                showAvgPlacement={false}
                                showTeamScorePerRound={false}
                                showRaceCount
                            />
                            {stats.scoreBreakdown && (
                                <ScoreBreakdownPanel breakdown={stats.scoreBreakdown} />
                            )}
                        </div>
                    </div>
                ) : (
                    <StatCards
                        stats={summaryDisplayStats}
                        viewMode={viewMode as StatCardViewMode}
                        showSessionWinRate={viewMode !== 'distance' && !isUmaView}
                        showAvgPlacement={viewMode === 'uma'}
                        showTeamScorePerRound={false}
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

                    <Card className="app-card">

                        <Card.Body>

                            {!showSectionHeaders && (
                                <SectionHeading title="Opponent Strength" compact className="mt-0" />
                            )}

                            {opponentChart}

                        </Card.Body>

                    </Card>

                </AnalyticsSection>

            )}

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title="Progression Trends"
                actions={overviewActionsFor('progression')}
            >

                <Card className="app-card mb-3">

                    <Card.Body>

                        <ScoreTrendChart
                            stats={progressionStats}
                            emaSourceTrend={progressionEmaSource}
                            viewMode={viewMode as StatCardViewMode}
                        />

                    </Card.Body>

                </Card>

                {!isUmaView && progressionStats.scoreTrend.length > 0 && (

                    <Card className="app-card mb-3">

                        <Card.Body>

                            <TeamRatingTrendChart
                                stats={progressionStats}
                                emaSourceTrend={progressionEmaSource}
                            />

                        </Card.Body>

                    </Card>

                )}

                {progressionStats.scoreTrend.length > 0 && (

                    <Card className="app-card">

                        <Card.Body>

                            <WinRateTrendChart
                                stats={progressionStats}
                                sourceTrend={progressionEmaSource}
                                showRaceWinRate={isTeamView}
                                averageSeriesLabel={isUmaView ? 'Average' : undefined}
                            />

                        </Card.Body>

                    </Card>

                )}
            </AnalyticsSection>

            {!isUmaView && (

                <AnalyticsSection
                    showHeader={showSectionHeaders}
                    title="Opponent Characteristics"
                    actions={overviewActionsFor('opponentCharacteristics')}
                >

                    <div className="row g-3 opponent-characteristics-layout">
                        <div className={COL_HALF}>
                            <Card className="app-card h-100 opponent-characteristics-card">
                                <Card.Body>
                                    <SectionHeading title="Opponent Style Composition" compact className="mt-0" />
                                    <StyleCompositionChart
                                        opponent={opponentCharacteristicsStats.opponentStyleComposition}
                                        npcPercent={opponentCharacteristicsStats.npcStyleComposition}
                                        npcAvgCount={opponentCharacteristicsStats.npcStyleCompositionAvgCount}
                                        roomPercent={opponentCharacteristicsStats.roomStyleComposition}
                                        roomAvgCount={opponentCharacteristicsStats.roomStyleCompositionAvgCount}
                                    />
                                </Card.Body>
                            </Card>
                        </div>
                        <div className={COL_HALF}>
                            <Card className="app-card h-100 opponent-characteristics-card">
                                <Card.Body>
                                    <SectionHeading title="Opponent Strength" compact className="mt-0" />
                                    <div className="composition-chart-toolbar" aria-hidden="true" />
                                    {buildOpponentChart(opponentCharacteristicsStats)}
                                </Card.Body>
                            </Card>
                        </div>
                    </div>

                </AnalyticsSection>

            )}

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title="Skill Analysis"
                actions={overviewActionsFor('skill')}
            >

                <div className="row g-3">

                    <div className={COL_HALF}>

                        <SkillTable title="Skill Activations" skills={skillStats.playerSkillActivations} mode="player" />

                    </div>

                    {!isUmaView && (

                        <div className={COL_HALF}>

                            <SkillTable title="Most Common Opponent Skills" skills={skillStats.opponentSkills} mode="opponent" />

                        </div>

                    )}

                </div>

            </AnalyticsSection>

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title="Racetrack Analysis"
                actions={overviewActionsFor('racetrack')}
            >

                <div className="row g-3">

                    <div className={COL_HALF}>

                        <MatchupTable

                            entries={racetrackStats.trackMatchups}

                            title="Relative Overperformance"

                            variant="track"

                            defaultSortKey="avgNormalizedScore"

                        />

                    </div>

                    <div className={COL_HALF}>

                        <MatchupTable

                            entries={racetrackStats.trackMatchups}

                            title="Relative Underperformance"

                            variant="track"

                            defaultSortKey="avgNormalizedScore"

                            defaultSortDir="asc"

                        />

                    </div>

                </div>

            </AnalyticsSection>

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title="Uma Analysis"
                actions={overviewActionsFor('uma')}
            >

                <div className="row g-3">

                    {!isUmaView && (

                        <div className={COL_THIRD}>

                            <MatchupTable

                                entries={umaStats.matchups}

                                title="Most Common Opponents"

                                defaultSortKey="appearances"

                                defaultSortDir="desc"

                                defaultOccurrenceFilter="all"

                                compactColumns={viewMode === 'distance'}

                                hideOutfitName={hideMatchupOutfitName}

                            />

                        </div>

                    )}

                    <div className={isUmaView ? COL_HALF : COL_THIRD}>

                        <MatchupTable

                            entries={umaStats.matchups}

                            title="Relative Overperformance"

                            defaultSortKey="winRate"

                            defaultSortDir="desc"

                            compactColumns={viewMode === 'distance'}

                            hideOutfitName={hideMatchupOutfitName}

                        />

                    </div>

                    <div className={isUmaView ? COL_HALF : COL_THIRD}>

                        <MatchupTable

                            entries={umaStats.matchups}

                            title="Relative Underperformance"

                            defaultSortKey="winRate"

                            defaultSortDir="asc"

                            compactColumns={viewMode === 'distance'}

                            hideOutfitName={hideMatchupOutfitName}

                        />

                    </div>

                </div>

            </AnalyticsSection>

        </>

    );

}
