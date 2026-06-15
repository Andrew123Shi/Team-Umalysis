import type { AggregatedStats, ScoreBonusSettings, TTSession } from '../../analytics/types';
import type { getTeamRosterGrid } from '../../analytics/aggregateTeamTrials';
import type { listHistoricalUmas } from '../../analytics/umaComparison';

export type DashboardOutletContext = {
    sessions: TTSession[];
    scoreBonuses: ScoreBonusSettings;
    dashboardReady: boolean;
    overallStats: AggregatedStats | null;
    recentOverallStats: AggregatedStats | null;
    distanceStatsByType: Map<number, AggregatedStats> | null;
    recentDistanceStatsByType: Map<number, AggregatedStats> | null;
    rosterGrid: ReturnType<typeof getTeamRosterGrid>;
    historicalUmas: ReturnType<typeof listHistoricalUmas>;
};
