import { memo, startTransition, useEffect, useState } from 'react';
import { DISTANCE_LABELS, DISTANCE_ORDER, type AggregatedStats } from '../analytics/types';
import { useStickyOffset } from '../hooks/useStickyOffset';
import { MOTION_MS } from './motion';
import DistanceJumpNav from './DistanceJumpNav';
import { useLoadingRemainingFiles } from './RemainingFilesLoadingAlert';
import SectionHeading from './SectionHeading';
import StatsPanels, { StatsScopeToggle, type StatsScope } from './StatsPanels';

type Props = {
    distanceStats: Map<number, AggregatedStats>;
    recentDistanceStats: Map<number, AggregatedStats>;
};

type DistanceScopeState = Partial<Record<number, StatsScope>>;

function buildScopeState(scope: StatsScope): DistanceScopeState {
    return Object.fromEntries(DISTANCE_ORDER.map((distanceType) => [distanceType, scope]));
}

const DistanceSection = memo(function DistanceSection({
    distanceType,
    stats,
    emaSourceTrend,
}: {
    distanceType: number;
    stats: AggregatedStats;
    emaSourceTrend?: AggregatedStats['scoreTrend'];
}) {
    return (
        <section
            id={`distance-${distanceType}`}
            className="distance-section analytics-section"
        >
            <SectionHeading level="section" title={DISTANCE_LABELS[distanceType]} />
            <StatsPanels
                stats={stats}
                emaSourceTrend={emaSourceTrend}
                viewMode="distance"
                showDistanceWinRates={false}
            />
        </section>
    );
});

export default function DistanceDashboard({ distanceStats, recentDistanceStats }: Props) {
    const loadingRemaining = useLoadingRemainingFiles();
    const [scope, setScope] = useState<StatsScope>('recent');
    const [activeDistance, setActiveDistance] = useState<number>(DISTANCE_ORDER[0]);
    const [displayedScopes, setDisplayedScopes] = useState<DistanceScopeState>(() => buildScopeState('recent'));
    const [subnavEl, setSubnavEl] = useState<HTMLDivElement | null>(null);
    useStickyOffset(subnavEl, '--sticky-subnav-height', true);
    /** Off-screen sections still to switch, and to which scope (a new object per switch). */
    const [backgroundUpdate, setBackgroundUpdate] = useState<{ scope: StatsScope; distances: number[] } | null>(null);

    useEffect(() => {
        if (!loadingRemaining || scope === 'recent') return;
        setBackgroundUpdate(null);
        setScope('recent');
        setDisplayedScopes(buildScopeState('recent'));
    }, [loadingRemaining, scope]);

    // Runs after the visible sections' switch has committed. Off-screen sections then
    // update one by one once its animations are over, so their renders never stall them.
    useEffect(() => {
        if (!backgroundUpdate) return undefined;
        const timers = backgroundUpdate.distances
            .map((distanceType, index) => window.setTimeout(() => {
                startTransition(() => {
                    setDisplayedScopes((current) => {
                        if (current[distanceType] === backgroundUpdate.scope) return current;
                        return { ...current, [distanceType]: backgroundUpdate.scope };
                    });
                });
            }, MOTION_MS + 150 + 200 * index));
        return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, [backgroundUpdate]);

    useEffect(() => {
        setDisplayedScopes((current) => {
            if (current[activeDistance] === scope) return current;
            return { ...current, [activeDistance]: scope };
        });
    }, [activeDistance, scope]);

    const changeScope = (nextScope: StatsScope) => {
        if (nextScope === scope) return;
        if (nextScope === 'overall' && loadingRemaining) return;

        // Everything on screen switches together; the rest follows in the background.
        const onScreen = DISTANCE_ORDER.filter((distanceType) => {
            if (distanceType === activeDistance) return true;
            const rect = document.getElementById(`distance-${distanceType}`)?.getBoundingClientRect();
            return rect !== undefined && rect.bottom > 0 && rect.top < window.innerHeight;
        });
        setScope(nextScope);
        setDisplayedScopes((current) => ({
            ...current,
            ...Object.fromEntries(onScreen.map((distanceType) => [distanceType, nextScope])),
        }));
        setBackgroundUpdate({
            scope: nextScope,
            distances: DISTANCE_ORDER.filter((distanceType) => !onScreen.includes(distanceType)),
        });
    };

    return (
        <div className="distance-dashboard">
            <div className="distance-subnav" ref={setSubnavEl}>
                <DistanceJumpNav onActiveDistanceChange={setActiveDistance} />
                <StatsScopeToggle value={scope} onChange={changeScope} />
            </div>
            {DISTANCE_ORDER.map((distanceType) => {
                const displayedScope = displayedScopes[distanceType] ?? scope;
                const fullStats = distanceStats.get(distanceType);
                const stats = displayedScope === 'recent'
                    ? (recentDistanceStats.get(distanceType) ?? fullStats)
                    : fullStats;
                if (!stats) return null;
                return (
                    <DistanceSection
                        key={distanceType}
                        distanceType={distanceType}
                        stats={stats}
                        emaSourceTrend={
                            displayedScope === 'recent' ? fullStats?.scoreTrend : undefined
                        }
                    />
                );
            })}
        </div>
    );
}
