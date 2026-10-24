import { useMemo } from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';

import { aggregateByUma } from '../../analytics/aggregateTeamTrials';
import { collectUmaRounds } from '../../analytics/styleSaturation';
import { getLatestUmaEntry } from '../../analytics/umaComparison';
import HistoricalUmaSelect from '../../components/HistoricalUmaSelect';
import RemainingFilesLoadingAlert from '../../components/RemainingFilesLoadingAlert';
import SectionHeading from '../../components/SectionHeading';
import StatsPanels from '../../components/StatsPanels';
import UmaLeaderboardSection from '../../components/UmaLeaderboardSection';
import UmaRosterSummary from '../../components/UmaRosterSummary';
import { useDashboardOutletContext } from './DashboardLayout';
import {
    HISTORICAL_PLACEHOLDER_LABEL,
    resolveUmaProfileParam,
    scrollToDashboardTop,
    umaProfilePath,
} from './utils';

export default function UmaAnalysisPage() {
    const navigate = useNavigate();
    const { umaSlug } = useParams();
    const {
        sessions,
        scoreBonuses,
        rosterGrid,
        historicalUmas,
    } = useDashboardOutletContext();
    const knownUmas = useMemo(
        () => [
            ...rosterGrid.flat().filter((uma): uma is NonNullable<typeof uma> => !!uma),
            ...historicalUmas,
        ],
        [rosterGrid, historicalUmas],
    );
    const activeBuildKey = useMemo(
        () => resolveUmaProfileParam(umaSlug, knownUmas),
        [umaSlug, knownUmas],
    );

    const umaStats = useMemo(() => {
        if (!sessions.length || !activeBuildKey) return null;
        return aggregateByUma(sessions, activeBuildKey, scoreBonuses);
    }, [sessions, activeBuildKey, scoreBonuses]);
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

    const selectUma = (buildKey: string) => {
        const uma = knownUmas.find((candidate) => candidate.buildKey === buildKey);
        if (!uma) return;
        scrollToDashboardTop();
        navigate(umaProfilePath(uma));
    };

    const returnToSummary = () => {
        navigate('/uma');
    };

    if (activeBuildKey) {
        if (!umaStats || !selectedUma) return null;

        return (
            <>
                <RemainingFilesLoadingAlert />
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
                    styleSaturationBuildKey={activeBuildKey}
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
        );
    }

    return (
        <>
            <RemainingFilesLoadingAlert />
            {rosterGrid.length > 0 && (
                <section className="analytics-section">
                    <SectionHeading
                        level="section"
                        title="Current Roster"
                    />
                    <UmaRosterSummary
                        rosterGrid={rosterGrid}
                        onSelectUma={selectUma}
                    />
                </section>
            )}
            <UmaLeaderboardSection
                sessions={sessions}
                scoreBonuses={scoreBonuses}
                onSelectUma={selectUma}
            />
            <section className="analytics-section historical-uma-section">
                <SectionHeading
                    level="section"
                    title="Historical Umas"
                />
                <HistoricalUmaSelect
                    historicalUmas={historicalUmas}
                    selectedBuildKey=""
                    placeholder={historicalUmas.length === 0 ? 'No historical umas' : HISTORICAL_PLACEHOLDER_LABEL}
                    onSelect={selectUma}
                    onClear={returnToSummary}
                />
            </section>
        </>
    );
}
