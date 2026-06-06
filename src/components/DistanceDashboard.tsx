import { memo } from 'react';
import { Col, Row } from 'react-bootstrap';
import { DISTANCE_LABELS, DISTANCE_ORDER, type AggregatedStats } from '../analytics/types';
import DistanceJumpNav from './DistanceJumpNav';
import SectionHeading from './SectionHeading';
import StatsPanels from './StatsPanels';

type Props = {
    distanceStats: Map<number, AggregatedStats>;
};

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

export default function DistanceDashboard({ distanceStats }: Props) {
    return (
        <Row>
            <Col lg={2} className="mb-3">
                <DistanceJumpNav />
            </Col>
            <Col lg={10}>
                {DISTANCE_ORDER.map((distanceType) => {
                    const stats = distanceStats.get(distanceType);
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
