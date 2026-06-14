import { memo, startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Col, Row } from 'react-bootstrap';
import { DISTANCE_LABELS, DISTANCE_ORDER, type AggregatedStats } from '../analytics/types';
import DistanceJumpNav from './DistanceJumpNav';
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
}: {
    distanceType: number;
    stats: AggregatedStats;
}) {
    return (
        <section
            id={`distance-${distanceType}`}
            className="distance-section analytics-section"
            style={{ scrollMarginTop: 'var(--sticky-subnav-offset)' }}
        >
            <SectionHeading level="section" title={DISTANCE_LABELS[distanceType]} />
            <StatsPanels stats={stats} viewMode="distance" showDistanceWinRates={false} />
        </section>
    );
});

export default function DistanceDashboard({ distanceStats, recentDistanceStats }: Props) {
    const [scope, setScope] = useState<StatsScope>('recent');
    const [activeDistance, setActiveDistance] = useState<number>(DISTANCE_ORDER[0]);
    const [displayedScopes, setDisplayedScopes] = useState<DistanceScopeState>(() => buildScopeState('recent'));
    const backgroundUpdateTimersRef = useRef<number[]>([]);

    const clearBackgroundUpdates = useCallback(() => {
        backgroundUpdateTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        backgroundUpdateTimersRef.current = [];
    }, []);

    useEffect(() => clearBackgroundUpdates, [clearBackgroundUpdates]);

    useEffect(() => {
        setDisplayedScopes((current) => {
            if (current[activeDistance] === scope) return current;
            return { ...current, [activeDistance]: scope };
        });
    }, [activeDistance, scope]);

    const changeScope = (nextScope: StatsScope) => {
        if (nextScope === scope) return;

        setScope(nextScope);
        clearBackgroundUpdates();

        setDisplayedScopes((current) => ({
            ...current,
            [activeDistance]: nextScope,
        }));

        DISTANCE_ORDER
            .filter((distanceType) => distanceType !== activeDistance)
            .forEach((distanceType, index) => {
                const timer = window.setTimeout(() => {
                    startTransition(() => {
                        setDisplayedScopes((current) => {
                            if (current[distanceType] === nextScope) return current;
                            return { ...current, [distanceType]: nextScope };
                        });
                    });
                }, 140 * (index + 1));
                backgroundUpdateTimersRef.current.push(timer);
            });
    };

    return (
        <Row>
            <Col lg={2} className="mb-3">
                <div className="distance-sidebar">
                    <DistanceJumpNav onActiveDistanceChange={setActiveDistance} />
                    <div className="distance-scope-control">
                        <StatsScopeToggle value={scope} onChange={changeScope} />
                    </div>
                </div>
            </Col>
            <Col lg={10}>
                {DISTANCE_ORDER.map((distanceType) => {
                    const displayedScope = displayedScopes[distanceType] ?? scope;
                    const stats = displayedScope === 'recent'
                        ? (recentDistanceStats.get(distanceType) ?? distanceStats.get(distanceType))
                        : distanceStats.get(distanceType);
                    if (!stats) return null;
                    return (
                        <DistanceSection
                            key={distanceType}
                            distanceType={distanceType}
                            stats={stats}
                        />
                    );
                })}
            </Col>
        </Row>
    );
}
