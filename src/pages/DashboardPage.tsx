import { useMemo, useState } from 'react';

import { Alert, Button, Nav, Tab } from 'react-bootstrap';

import {
    aggregateByDistance,
    aggregateByUma,
    aggregateOverall,
    getTeamRosterGrid,
} from '../analytics/aggregateTeamTrials';
import { DISTANCE_ORDER } from '../analytics/types';
import type { AggregatedStats } from '../analytics/types';
import { collectUmaRounds } from '../analytics/styleSaturation';
import { getLatestUmaEntry, listHistoricalUmas, getCurrentRosterBuildKeys } from '../analytics/umaComparison';

import DistanceDashboard from '../components/DistanceDashboard';
import { useDashboardReady } from '../hooks/useDashboardReady';
import { useStickyOffset } from '../hooks/useStickyOffset';
import SectionHeading from '../components/SectionHeading';
import StatsPanels from '../components/StatsPanels';
import UmaLeaderboardSection from '../components/UmaLeaderboardSection';
import UmaRosterSummary from '../components/UmaRosterSummary';
import HistoricalUmaSelect from '../components/HistoricalUmaSelect';
import { useRaceStore } from '../store/RaceStore';

const SUMMARY_VALUE = '__summary__';
const HISTORICAL_PLACEHOLDER = '';
const HISTORICAL_PLACEHOLDER_LABEL = 'Choose historical uma...';

function scrollToDashboardTop() {
    requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
}

export default function DashboardPage() {
    const [tabsEl, setTabsEl] = useState<HTMLDivElement | null>(null);
    const { sessions, loading, progress, error, hasTriedSavedFolder, loadFromFolder } = useRaceStore();
    const [selectedBuildKey, setSelectedBuildKey] = useState<string>(SUMMARY_VALUE);
    const [historicalSelection, setHistoricalSelection] = useState<string>(HISTORICAL_PLACEHOLDER);
    useStickyOffset(tabsEl, '--sticky-dashboard-tabs-height', true);
    const dashboardReady = useDashboardReady(sessions);
    const showDashboardLoading = sessions.length > 0 && !dashboardReady;

    const overallStats = useMemo(() => (sessions.length ? aggregateOverall(sessions) : null), [sessions]);
    const distanceStatsByType = useMemo(() => {
        if (!sessions.length) return null;
        const map = new Map<number, AggregatedStats>();
        DISTANCE_ORDER.forEach((distanceType) => {
            map.set(distanceType, aggregateByDistance(sessions, distanceType));
        });
        return map;
    }, [sessions]);
    const rosterGrid = useMemo(() => getTeamRosterGrid(sessions), [sessions]);
    const historicalUmas = useMemo(() => listHistoricalUmas(sessions), [sessions]);
    const activeBuildKey = selectedBuildKey !== SUMMARY_VALUE ? selectedBuildKey : historicalSelection || null;
    const umaStats = useMemo(() => {
        if (!sessions.length || !activeBuildKey) return null;
        return aggregateByUma(sessions, activeBuildKey);
    }, [sessions, activeBuildKey]);
    const umaStyleSaturationRounds = useMemo(() => {
        if (!activeBuildKey) return [];
        return collectUmaRounds(sessions, activeBuildKey);
    }, [sessions, activeBuildKey]);
    const latestUmaEntry = useMemo(() => {
        if (!activeBuildKey) return null;
        return getLatestUmaEntry(sessions, activeBuildKey);
    }, [sessions, activeBuildKey]);
    const selectedUma = useMemo(() => {
        if (!activeBuildKey) return null;
        return historicalUmas.find((u) => u.buildKey === activeBuildKey)
            ?? rosterGrid.flat().find((u) => u?.buildKey === activeBuildKey)
            ?? null;
    }, [activeBuildKey, historicalUmas, rosterGrid]);
    const isSummaryView = selectedBuildKey === SUMMARY_VALUE && !historicalSelection;

    const selectRosterUma = (buildKey: string) => {
        setSelectedBuildKey(buildKey);
        setHistoricalSelection(HISTORICAL_PLACEHOLDER);
        scrollToDashboardTop();
    };

    const selectHistoricalUma = (buildKey: string) => {
        setHistoricalSelection(buildKey);
        setSelectedBuildKey(SUMMARY_VALUE);
        scrollToDashboardTop();
    };

    const selectUmaFromLeaderboard = (buildKey: string) => {
        if (getCurrentRosterBuildKeys(sessions).has(buildKey)) {
            selectRosterUma(buildKey);
        } else {
            selectHistoricalUma(buildKey);
        }
    };

    const returnToSummary = () => {
        setSelectedBuildKey(SUMMARY_VALUE);
        setHistoricalSelection(HISTORICAL_PLACEHOLDER);
    };

    return (
        <div className="page-shell dashboard-page">
            <Tab.Container
                defaultActiveKey="overall"
                onSelect={(key) => {
                    if (key) {
                        scrollToDashboardTop();
                    }
                    if (key === 'uma' && !isSummaryView) {
                        returnToSummary();
                    }
                }}
            >
                <div ref={setTabsEl} className="dashboard-fixed-tabs">
                    <Nav variant="tabs">
                        <Nav.Item><Nav.Link eventKey="overall">Overview</Nav.Link></Nav.Item>
                        <Nav.Item>
                            <Nav.Link
                                eventKey="uma"
                                onClick={() => {
                                    if (!isSummaryView) returnToSummary();
                                }}
                            >
                                Uma Analysis
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item><Nav.Link eventKey="distance">Distance Analysis</Nav.Link></Nav.Item>
                    </Nav>
                </div>
                {error ? (
                    <div className="dashboard-tab-content">
                        <Alert variant="danger">{error}</Alert>
                    </div>
                ) : loading ? (
                    <div className="dashboard-tab-content">
                        <Alert variant="info" className="app-card dashboard-loading-alert">
                            {progress.total > 0 ? `Loading ${progress.loaded}/${progress.total} files...` : 'Loading files...'}
                        </Alert>
                    </div>
                ) : !sessions.length ? (
                    <div className="dashboard-tab-content">
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
                    </div>
                ) : (
                    <div className="dashboard-tab-content">
                        {showDashboardLoading && (
                            <Alert variant="info" className="app-card dashboard-loading-alert">
                                Loading race data...
                            </Alert>
                        )}
                        {sessions.length > 0 && dashboardReady && (
                                <Tab.Content>
                <Tab.Pane eventKey="overall">
                    {overallStats && <StatsPanels stats={overallStats} showDistanceWinRates />}
                </Tab.Pane>
                <Tab.Pane eventKey="uma">
                    <Tab.Container activeKey={isSummaryView ? 'summary' : 'profile'}>
                        <Tab.Content>
                            <Tab.Pane eventKey="summary">
                                {rosterGrid.length > 0 && (
                                    <section className="analytics-section">
                                        <SectionHeading
                                            level="section"
                                            title="Current Roster"
                                        />
                                        <UmaRosterSummary
                                            rosterGrid={rosterGrid}
                                            onSelectUma={selectRosterUma}
                                        />
                                    </section>
                                )}
                                <section className="analytics-section">
                                    <SectionHeading
                                        level="section"
                                        title="Uma Comparison"
                                    />
                                    <UmaLeaderboardSection
                                        sessions={sessions}
                                        onSelectUma={selectUmaFromLeaderboard}
                                    />
                                </section>
                                <section className="analytics-section historical-uma-section">
                                    <SectionHeading
                                        level="section"
                                        title="Historical Umas"
                                    />
                                    <HistoricalUmaSelect
                                        historicalUmas={historicalUmas}
                                        selectedBuildKey={historicalSelection}
                                        placeholder={historicalUmas.length === 0 ? 'No historical umas' : HISTORICAL_PLACEHOLDER_LABEL}
                                        onSelect={selectHistoricalUma}
                                        onClear={returnToSummary}
                                    />
                                </section>
                            </Tab.Pane>
                            <Tab.Pane eventKey="profile">
                                {umaStats && selectedUma && (
                                    <>
                                        <div className="mb-3">
                                            <Button
                                                variant="outline-secondary"
                                                size="sm"
                                                onClick={returnToSummary}
                                            >
                                                ← Team Summary
                                            </Button>
                                        </div>
                                        <StatsPanels
                                            stats={umaStats}
                                            viewMode="uma"
                                            showDistanceWinRates={false}
                                            styleSaturationRounds={umaStyleSaturationRounds}
                                            styleSaturationBuildKey={activeBuildKey ?? undefined}
                                            latestUmaEntry={latestUmaEntry}
                                            profileUma={{
                                                charaName: selectedUma.charaName,
                                                cardId: selectedUma.cardId,
                                                rankScore: selectedUma.rankScore,
                                                stats: selectedUma.stats,
                                                distanceType: selectedUma.distanceType,
                                            }}
                                        />
                                    </>
                                )}
                            </Tab.Pane>
                        </Tab.Content>
                    </Tab.Container>
                </Tab.Pane>
                <Tab.Pane eventKey="distance">
                    {distanceStatsByType && (
                        <DistanceDashboard distanceStats={distanceStatsByType} />
                    )}
                </Tab.Pane>
            </Tab.Content>
                        )}
                    </div>
                )}
            </Tab.Container>
        </div>
    );
}
