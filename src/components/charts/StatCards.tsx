import type { ReactNode } from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import type { AggregatedStats, NumericSummary } from '../../analytics/types';
import { formatScore } from '../../utils/formatScore';
import SectionHeading from '../SectionHeading';
import { WinRateDonut, WinRateLegend, WinRateRings } from './WinRatePies';

function fmtNum(v: number, digits = 1) {
    return v.toFixed(digits);
}

function SummaryCard({
    title,
    summary,
    suffix = '',
    hideMin = false,
    hideCount = false,
    roundAvg = false,
}: {
    title: string;
    summary: NumericSummary;
    suffix?: string;
    hideMin?: boolean;
    hideCount?: boolean;
    roundAvg?: boolean;
}) {
    if (summary.count === 0) {
        return (
            <Card className="app-card h-100">
                <Card.Body>
                    <SectionHeading level="card" title={title} />
                    <div className="text-muted">No data</div>
                </Card.Body>
            </Card>
        );
    }
    const avgDisplay = roundAvg ? formatScore(summary.avg) : fmtNum(summary.avg);
    const medDisplay = roundAvg ? formatScore(summary.median) : fmtNum(summary.median);
    const minDisplay = roundAvg ? formatScore(summary.min) : fmtNum(summary.min);
    const maxDisplay = roundAvg ? formatScore(summary.max) : fmtNum(summary.max);
    const minMaxLine = hideMin
        ? `med ${medDisplay}${suffix} · max ${maxDisplay}${suffix}`
        : `med ${medDisplay}${suffix} · min ${minDisplay}${suffix} · max ${maxDisplay}${suffix}`;
    return (
        <Card className="app-card h-100">
            <Card.Body>
                <SectionHeading level="card" title={title} />
                <div className="metric-value">{avgDisplay}{suffix}</div>
                <div className="small metric-detail">
                    {minMaxLine}
                </div>
                {!hideCount && <div className="small metric-detail">n={summary.count}</div>}
            </Card.Body>
        </Card>
    );
}

export type StatCardViewMode = 'team' | 'uma' | 'distance';

function ScoreSummary({
    title,
    avg,
    median,
    min,
    max,
    rawAvg,
    compact = false,
}: {
    title: string;
    avg: number;
    median: number;
    min: number;
    max: number;
    rawAvg?: number;
    compact?: boolean;
}) {
    return (
        <Card className={`app-card h-100${compact ? ' overview-score-card' : ''}`}>
            <Card.Body>
                <SectionHeading title={title} compact className="mt-0" />
                <div className="score-summary-layout">
                    <div className="metric-value">{formatScore(avg)}</div>
                    <div className="score-summary-details">
                        <span><strong>Med</strong> {formatScore(median)}</span>
                        {compact ? (
                            <div className="score-summary-minmax">
                                <span><strong>Min</strong> {formatScore(min)}</span>
                                <span><strong>Max</strong> {formatScore(max)}</span>
                            </div>
                        ) : (
                            <>
                                <span><strong>Min</strong> {formatScore(min)}</span>
                                <span><strong>Max</strong> {formatScore(max)}</span>
                            </>
                        )}
                        {rawAvg !== undefined && (
                            <span><strong>Raw Avg</strong> {formatScore(rawAvg)}</span>
                        )}
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
}

function RaceWinRateCard({
    winRate,
    top2,
    top3,
    raceCount,
    raceWins,
    compact = false,
}: {
    winRate: number;
    top2: number;
    top3: number;
    raceCount: number;
    raceWins: number;
    compact?: boolean;
}) {
    return (
        <Card className={`app-card h-100${compact ? ' overview-win-rate-card' : ''}`}>
            <Card.Body>
                <SectionHeading title="Race Win Rate" compact className="mt-0" />
                <div className="win-rate-card-layout">
                    <WinRateRings winRate={winRate} top2Rate={top2} top3Rate={top3} />
                    <div className="win-rate-count">
                        <strong>{raceWins}/{raceCount}</strong>
                        <span>Races Won</span>
                    </div>
                    <WinRateLegend
                        items={[
                            { label: 'Win', value: winRate, color: '#66bb6a' },
                            { label: 'Top 2', value: top2, color: '#ffca28' },
                            { label: 'Top 3', value: top3, color: '#fd7e14' },
                        ]}
                    />
                </div>
            </Card.Body>
        </Card>
    );
}

function TeamWinRatesCard({
    stats,
    primaryWinRate,
    primaryTop2,
    primaryTop3,
    raceCount,
    raceWins,
    compact = false,
}: {
    stats: AggregatedStats;
    primaryWinRate: number;
    primaryTop2: number;
    primaryTop3: number;
    raceCount: number;
    raceWins: number;
    compact?: boolean;
}) {
    return (
        <Card className={`app-card h-100${compact ? ' overview-win-rate-card' : ''}`}>
            <Card.Body>
                <SectionHeading title="Win Rate" compact className="mt-0" />
                <div className="win-rate-comparison-grid">
                    <div className="win-rate-panel">
                        <div className="win-rate-panel-title">Overall Win Rate</div>
                        <div className="win-rate-card-layout">
                            <WinRateDonut value={stats.sessionWinRate} />
                            <div className="win-rate-count">
                                <strong>{Math.round(stats.sessionWinRate * stats.totalSessions)}/{stats.totalSessions}</strong>
                                <span>Trials Won</span>
                            </div>
                        </div>
                    </div>
                    <div className="win-rate-panel">
                        <div className="win-rate-panel-title">Race Win Rate</div>
                        <div className="win-rate-card-layout">
                            <WinRateRings winRate={primaryWinRate} top2Rate={primaryTop2} top3Rate={primaryTop3} />
                            <div className="win-rate-count">
                                <strong>{raceWins}/{raceCount}</strong>
                                <span>Races Won</span>
                            </div>
                            <WinRateLegend
                                items={[
                                    { label: 'Win', value: primaryWinRate, color: '#66bb6a' },
                                    { label: 'Top 2', value: primaryTop2, color: '#ffca28' },
                                    { label: 'Top 3', value: primaryTop3, color: '#fd7e14' },
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
}

function AverageTotalScoreCard({
    stats,
    isUmaView,
    isDistanceView,
    compact = false,
}: {
    stats: AggregatedStats;
    isUmaView: boolean;
    isDistanceView: boolean;
    compact?: boolean;
}) {
    if (isUmaView) {
        return <SummaryCard title="Average Score" summary={stats.score} roundAvg hideCount />;
    }
    if (isDistanceView) {
        if (stats.teamScore.count === 0) {
            return (
                <Card className={`app-card h-100${compact ? ' overview-score-card' : ''}`}>
                    <Card.Body>
                        <SectionHeading title="Average Race Score" compact className="mt-0" />
                        <div className="text-muted">No data</div>
                    </Card.Body>
                </Card>
            );
        }
        return (
            <ScoreSummary
                title="Average Race Score"
                avg={stats.teamScore.avg}
                median={stats.teamScore.median}
                min={stats.teamScore.min}
                max={stats.teamScore.max}
                rawAvg={stats.teamScoreRaw.avg}
                compact={compact}
            />
        );
    }
    if (stats.raceScoreTotal.count === 0) {
        return (
            <Card className={`app-card h-100${compact ? ' overview-score-card' : ''}`}>
                <Card.Body>
                    <SectionHeading title="Average Total Score" compact className="mt-0" />
                    <div className="text-muted">No data</div>
                </Card.Body>
            </Card>
        );
    }
    return (
        <ScoreSummary
            title="Average Total Score"
            avg={stats.raceScoreTotalNormalized.avg}
            median={stats.raceScoreTotalNormalized.median}
            min={stats.raceScoreTotalNormalized.min}
            max={stats.raceScoreTotalNormalized.max}
            rawAvg={stats.raceScoreTotal.avg}
            compact={compact}
        />
    );
}

export default function StatCards({
    stats,
    viewMode = 'team',
    showSessionWinRate = true,
    showAvgPlacement = true,
    showTeamScorePerRound = true,
    showRaceCount = false,
    distanceWinRatesPanel,
    opponentStrengthPanel,
}: {
    stats: AggregatedStats;
    viewMode?: StatCardViewMode;
    showSessionWinRate?: boolean;
    showAvgPlacement?: boolean;
    showTeamScorePerRound?: boolean;
    showRaceCount?: boolean;
    distanceWinRatesPanel?: ReactNode;
    opponentStrengthPanel?: ReactNode;
}) {
    const isUmaView = viewMode === 'uma';
    const isDistanceView = viewMode === 'distance';
    const isTeamView = !isUmaView && !isDistanceView;
    const isOverviewLayout = isTeamView && showSessionWinRate && !!distanceWinRatesPanel;
    const isDistanceLayout = isDistanceView && !!opponentStrengthPanel;
    const isUmaOverviewLayout = isUmaView && showRaceCount;

    const primaryWinRate = isUmaView ? stats.winRate : stats.roundWinRate;
    const primaryTop2 = isUmaView ? stats.top2Rate : stats.roundTop2Rate;
    const primaryTop3 = isUmaView ? stats.top3Rate : stats.roundTop3Rate;
    const raceCount = stats.totalRounds;
    const raceWins = Math.round(primaryWinRate * raceCount);

    if (isUmaOverviewLayout) {
        return (
            <Row className="g-3 performance-overview-row">
                <Col lg={4}>
                    <RaceWinRateCard
                        winRate={primaryWinRate}
                        top2={primaryTop2}
                        top3={primaryTop3}
                        raceCount={raceCount}
                        raceWins={raceWins}
                        compact
                    />
                </Col>
                <Col lg={4}>
                    {stats.score.count === 0 ? (
                        <Card className="app-card h-100 overview-score-card">
                            <Card.Body>
                                <SectionHeading title="Average Score" compact className="mt-0" />
                                <div className="text-muted">No data</div>
                            </Card.Body>
                        </Card>
                    ) : (
                        <ScoreSummary
                            title="Average Score"
                            avg={stats.score.avg}
                            median={stats.score.median}
                            min={stats.score.min}
                            max={stats.score.max}
                            compact
                        />
                    )}
                </Col>
                <Col lg={4}>
                    <Card className="app-card h-100 overview-score-card">
                        <Card.Body>
                            <SectionHeading title="Number of Races" compact className="mt-0" />
                            <div className="score-summary-layout">
                                <div className="metric-value">{stats.totalRounds}</div>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        );
    }

    if (isDistanceLayout) {
        return (
            <Row className="g-3 performance-overview-row">
                <Col lg={4}>
                    <RaceWinRateCard
                        winRate={primaryWinRate}
                        top2={primaryTop2}
                        top3={primaryTop3}
                        raceCount={raceCount}
                        raceWins={raceWins}
                        compact
                    />
                </Col>
                <Col lg={3}>
                    <AverageTotalScoreCard
                        stats={stats}
                        isUmaView={isUmaView}
                        isDistanceView={isDistanceView}
                        compact
                    />
                </Col>
                <Col lg={5}>
                    {opponentStrengthPanel}
                </Col>
            </Row>
        );
    }

    if (isOverviewLayout) {
        return (
            <Row className="g-3 performance-overview-row">
                <Col lg={5}>
                    <TeamWinRatesCard
                        stats={stats}
                        primaryWinRate={primaryWinRate}
                        primaryTop2={primaryTop2}
                        primaryTop3={primaryTop3}
                        raceCount={raceCount}
                        raceWins={raceWins}
                        compact
                    />
                </Col>
                <Col lg={2}>
                    <AverageTotalScoreCard
                        stats={stats}
                        isUmaView={isUmaView}
                        isDistanceView={isDistanceView}
                        compact
                    />
                </Col>
                <Col lg={5}>
                    {distanceWinRatesPanel}
                </Col>
            </Row>
        );
    }

    return (
        <Row className="g-3">
            {showSessionWinRate && isTeamView && (
                <Col md={6} sm={12}>
                    <TeamWinRatesCard
                        stats={stats}
                        primaryWinRate={primaryWinRate}
                        primaryTop2={primaryTop2}
                        primaryTop3={primaryTop3}
                        raceCount={raceCount}
                        raceWins={raceWins}
                    />
                </Col>
            )}

            {(!showSessionWinRate || !isTeamView) && (
            <Col md={3} sm={6}>
                <Card className="app-card h-100">
                    <Card.Body>
                        <SectionHeading title={isUmaView ? 'Win Rate' : 'Race Win Rate'} compact className="mt-0" />
                        <div className="win-rate-card-layout">
                            <WinRateRings winRate={primaryWinRate} top2Rate={primaryTop2} top3Rate={primaryTop3} />
                            <div>
                                {isTeamView && (
                                    <div className="win-rate-count mb-2">
                                        <strong>{raceWins}/{raceCount}</strong>
                                        <span>Races Won</span>
                                    </div>
                                )}
                                <WinRateLegend
                                    items={[
                                        { label: 'Win', value: primaryWinRate, color: '#66bb6a' },
                                        { label: 'Top 2', value: primaryTop2, color: '#ffca28' },
                                        { label: 'Top 3', value: primaryTop3, color: '#fd7e14' },
                                    ]}
                                />
                            </div>
                        </div>
                    </Card.Body>
                </Card>
            </Col>
            )}

            {showSessionWinRate && !isTeamView && (
                <Col md={3} sm={6}>
                    <Card className="app-card h-100">
                        <Card.Body>
                            <SectionHeading title="Session Win Rate" compact className="mt-0" />
                            <div className="win-rate-card-layout">
                                <WinRateDonut value={stats.sessionWinRate} />
                                <div className="win-rate-count">
                                    <strong>{stats.playerRoundWins}/{stats.totalRounds}</strong>
                                    <span>Rounds Won</span>
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            )}

            {showAvgPlacement && (
                <Col md={3} sm={6}>
                    <SummaryCard
                        title={isUmaView ? 'Average Placement' : 'Avg Placement'}
                        summary={stats.placement}
                        hideMin={isUmaView}
                        hideCount={isUmaView}
                    />
                </Col>
            )}

            {!isOverviewLayout && (
            <Col md={3} sm={6}>
                <AverageTotalScoreCard stats={stats} isUmaView={isUmaView} isDistanceView={isDistanceView} />
            </Col>
            )}

            {showTeamScorePerRound && (
                <Col md={3} sm={6}>
                    <SummaryCard title="Team Score / Round" summary={stats.teamScore} roundAvg />
                </Col>
            )}

            {showRaceCount && (
                <Col md={3} sm={6}>
                    <Card className="app-card h-100">
                        <Card.Body>
                            <SectionHeading level="card" title="Number of Races" />
                            <div className="metric-value">{stats.totalRounds}</div>
                        </Card.Body>
                    </Card>
                </Col>
            )}

        </Row>
    );
}
