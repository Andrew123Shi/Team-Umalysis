import { useEffect, useMemo } from 'react';
import { Alert, Button } from 'react-bootstrap';
import { Outlet, useLocation, useOutletContext } from 'react-router-dom';

import {
    aggregateByDistance,
    aggregateOverall,
    getTeamRosterGrid,
} from '../../analytics/aggregateTeamTrials';
import { DISTANCE_ORDER } from '../../analytics/types';
import type { AggregatedStats } from '../../analytics/types';
import { listHistoricalUmas } from '../../analytics/umaComparison';
import { useDashboardReady } from '../../hooks/useDashboardReady';
import { useRaceStore } from '../../store/RaceStore';
import type { DashboardOutletContext } from './types';
import { latestTrialSessions, RECENT_TRIAL_LIMIT, scrollToDashboardTop } from './utils';

export default function DashboardLayout() {
    const location = useLocation();
    const { sessions, loading, progress, error, hasTriedSavedFolder, loadFromFolder, scoreBonuses } = useRaceStore();
    const dashboardReady = useDashboardReady(sessions);
    const showDashboardLoading = sessions.length > 0 && !dashboardReady;

    useEffect(() => {
        scrollToDashboardTop();
    }, [location.pathname]);

    const overallStats = useMemo(
        () => (sessions.length ? aggregateOverall(sessions, scoreBonuses) : null),
        [sessions, scoreBonuses],
    );
    const recentOverallStats = useMemo(() => {
        if (!sessions.length) return null;
        return aggregateOverall(latestTrialSessions(sessions, RECENT_TRIAL_LIMIT), scoreBonuses);
    }, [sessions, scoreBonuses]);
    const distanceStatsByType = useMemo(() => {
        if (!sessions.length) return null;
        const map = new Map<number, AggregatedStats>();
        DISTANCE_ORDER.forEach((distanceType) => {
            map.set(distanceType, aggregateByDistance(sessions, distanceType, scoreBonuses));
        });
        return map;
    }, [sessions, scoreBonuses]);
    const recentDistanceStatsByType = useMemo(() => {
        if (!sessions.length) return null;
        const map = new Map<number, AggregatedStats>();
        const recentSessions = latestTrialSessions(sessions, RECENT_TRIAL_LIMIT);
        DISTANCE_ORDER.forEach((distanceType) => {
            map.set(distanceType, aggregateByDistance(recentSessions, distanceType, scoreBonuses));
        });
        return map;
    }, [sessions, scoreBonuses]);
    const rosterGrid = useMemo(() => getTeamRosterGrid(sessions, scoreBonuses), [sessions, scoreBonuses]);
    const historicalUmas = useMemo(() => listHistoricalUmas(sessions, scoreBonuses), [sessions, scoreBonuses]);

    const outletContext = useMemo((): DashboardOutletContext => ({
        sessions,
        scoreBonuses,
        dashboardReady,
        overallStats,
        recentOverallStats,
        distanceStatsByType,
        recentDistanceStatsByType,
        rosterGrid,
        historicalUmas,
    }), [
        sessions,
        scoreBonuses,
        dashboardReady,
        overallStats,
        recentOverallStats,
        distanceStatsByType,
        recentDistanceStatsByType,
        rosterGrid,
        historicalUmas,
    ]);

    return (
        <div className="page-shell dashboard-page">
            {error ? (
                <Alert variant="danger">{error}</Alert>
            ) : loading ? (
                <Alert variant="info" className="app-card dashboard-loading-alert">
                    {progress.total > 0 ? `Loading ${progress.loaded}/${progress.total} files...` : 'Loading files...'}
                </Alert>
            ) : !sessions.length ? (
                <div className="app-card empty-state">
                    <h2 className="h4">Choose Your Team Trials Folder</h2>
                    <p className="text-muted mb-3">
                        {hasTriedSavedFolder
                            ? 'No Team Trials files are loaded. Select the folder where your Team Trials .json files are stored.'
                            : 'Checking for a saved Team Trials folder...'}
                    </p>
                    <Button variant="primary" onClick={loadFromFolder}>
                        Choose Team Trials Folder
                    </Button>
                </div>
            ) : (
                <>
                    {showDashboardLoading && (
                        <Alert variant="info" className="app-card dashboard-loading-alert">
                            Loading race data...
                        </Alert>
                    )}
                    {dashboardReady && <Outlet context={outletContext} />}
                </>
            )}
        </div>
    );
}

export function useDashboardOutletContext(): DashboardOutletContext {
    return useOutletContext<DashboardOutletContext>();
}
