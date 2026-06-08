import { Card } from 'react-bootstrap';
import type { ReactNode } from 'react';

import type { AggregatedStats, TTRound, UmaEntry } from '../analytics/types';

import { COL_HALF, COL_THIRD } from './layout';
import SectionHeading from './SectionHeading';

import MatchupTable from './charts/MatchupTable';

import ScoreTrendChart from './charts/ScoreTrendChart';
import TeamRatingTrendChart from './charts/TeamRatingTrendChart';

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

function DistanceWinRatesPanel({ stats }: { stats: AggregatedStats }) {
    return (
        <Card className="app-card h-100">
            <Card.Body>
                <SectionHeading title="Distance Win Rates" compact className="mt-0" />
                <div className="row g-2">
                    {stats.distanceWinRates.map((d) => (
                        <div key={d.distance} className="col">
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
    children,
}: {
    showHeader: boolean;
    title: string;
    subtitle?: string;
    children: ReactNode;
}) {
    if (!showHeader) {
        return <div className="analytics-section">{children}</div>;
    }
    return (
        <section className="analytics-section">
            <SectionHeading level="section" title={title} subtitle={subtitle} />
            {children}
        </section>
    );
}


export default function StatsPanels({

    stats,

    viewMode = 'team',

    showDistanceWinRates = true,

    styleSaturationRounds,

    styleSaturationBuildKey,

    latestUmaEntry,

    profileUma,

}: {

    stats: AggregatedStats;

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

    const opponentChart = (
        <AverageStatsComparisonChart
            showTeamRating={!isDistanceView}
            opponent={{
                stats: {
                    speed: stats.opponentStats.speed.avg,
                    stamina: stats.opponentStats.stamina.avg,
                    pow: stats.opponentStats.pow.avg,
                    guts: stats.opponentStats.guts.avg,
                    wiz: stats.opponentStats.wiz.avg,
                },
                rankScore: stats.opponentStats.rankScore.avg,
                teamRating: stats.opponentStats.teamRating.avg,
            }}
            npc={{
                stats: {
                    speed: stats.npcStats.speed.avg,
                    stamina: stats.npcStats.stamina.avg,
                    pow: stats.npcStats.pow.avg,
                    guts: stats.npcStats.guts.avg,
                    wiz: stats.npcStats.wiz.avg,
                },
                rankScore: stats.npcStats.rankScore.avg,
            }}
        />
    );

    return (

        <>

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title={isUmaView ? 'Uma Profile' : 'Summary'}
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
                        stats={stats}
                        viewMode={viewMode as StatCardViewMode}
                        showSessionWinRate={viewMode !== 'distance' && !isUmaView}
                        showAvgPlacement={viewMode === 'uma'}
                        showTeamScorePerRound={false}
                        distanceWinRatesPanel={showOverviewPerformanceExtras
                            ? <DistanceWinRatesPanel stats={stats} />
                            : undefined}
                        opponentStrengthPanel={isDistanceView ? (
                            <Card className="app-card h-100">
                                <Card.Body>
                                    <SectionHeading title="Opponent Strength" compact className="mt-0" />
                                    {opponentChart}
                                </Card.Body>
                            </Card>
                        ) : undefined}
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
            >

                <Card className="app-card mb-3">

                    <Card.Body>

                        <ScoreTrendChart stats={stats} viewMode={viewMode as StatCardViewMode} />

                    </Card.Body>

                </Card>

                {!isUmaView && stats.scoreTrend.length > 0 && (

                    <Card className="app-card">

                        <Card.Body>

                            <TeamRatingTrendChart stats={stats} />

                        </Card.Body>

                    </Card>

                )}
            </AnalyticsSection>

            {!isUmaView && (

                <AnalyticsSection
                    showHeader={showSectionHeaders}
                    title="Opponent Characteristics"
                >

                    <div className="row g-3 opponent-characteristics-layout">
                        <div className={COL_HALF}>
                            <Card className="app-card h-100 opponent-characteristics-card">
                                <Card.Body>
                                    <SectionHeading title="Opponent Style Composition" compact className="mt-0" />
                                    <StyleCompositionChart
                                        opponent={stats.opponentStyleComposition}
                                        npcPercent={stats.npcStyleComposition}
                                        npcAvgCount={stats.npcStyleCompositionAvgCount}
                                        roomPercent={stats.roomStyleComposition}
                                        roomAvgCount={stats.roomStyleCompositionAvgCount}
                                    />
                                </Card.Body>
                            </Card>
                        </div>
                        <div className={COL_HALF}>
                            <Card className="app-card h-100 opponent-characteristics-card">
                                <Card.Body>
                                    <SectionHeading title="Opponent Strength" compact className="mt-0" />
                                    <div className="composition-chart-toolbar" aria-hidden="true" />
                                    {opponentChart}
                                </Card.Body>
                            </Card>
                        </div>
                    </div>

                </AnalyticsSection>

            )}

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title="Skill Analysis"
            >

                <div className="row g-3">

                    <div className={COL_HALF}>

                        <SkillTable title="Skill Activations" skills={stats.playerSkillActivations} mode="player" />

                    </div>

                    {!isUmaView && (

                        <div className={COL_HALF}>

                            <SkillTable title="Most Common Opponent Skills" skills={stats.opponentSkills} mode="opponent" />

                        </div>

                    )}

                </div>

            </AnalyticsSection>

            <AnalyticsSection
                showHeader={showSectionHeaders}
                title="Racetrack Analysis"
            >

                <div className="row g-3">

                    <div className={COL_HALF}>

                        <MatchupTable

                            entries={stats.trackMatchups}

                            title="Relative Overperformance"

                            variant="track"

                            defaultSortKey="avgNormalizedScore"

                        />

                    </div>

                    <div className={COL_HALF}>

                        <MatchupTable

                            entries={stats.trackMatchups}

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
            >

                <div className="row g-3">

                    {!isUmaView && (

                        <div className={COL_THIRD}>

                            <MatchupTable

                                entries={stats.matchups}

                                title="Most Common Opponents"

                                defaultSortKey="appearances"

                                defaultSortDir="desc"

                                defaultOccurrenceFilter="all"

                                compactColumns={viewMode === 'distance'}

                            />

                        </div>

                    )}

                    <div className={isUmaView ? COL_HALF : COL_THIRD}>

                        <MatchupTable

                            entries={stats.matchups}

                            title="Relative Overperformance"

                            defaultSortKey="winRate"

                            defaultSortDir="desc"

                            compactColumns={viewMode === 'distance'}

                        />

                    </div>

                    <div className={isUmaView ? COL_HALF : COL_THIRD}>

                        <MatchupTable

                            entries={stats.matchups}

                            title="Relative Underperformance"

                            defaultSortKey="winRate"

                            defaultSortDir="asc"

                            compactColumns={viewMode === 'distance'}

                        />

                    </div>

                </div>

            </AnalyticsSection>

        </>

    );

}
