import DistanceDashboard from '../../components/DistanceDashboard';
import { useDashboardOutletContext } from './DashboardLayout';

export default function DistanceAnalysisPage() {
    const { distanceStatsByType, recentDistanceStatsByType } = useDashboardOutletContext();

    if (!distanceStatsByType || !recentDistanceStatsByType) return null;

    return (
        <DistanceDashboard
            distanceStats={distanceStatsByType}
            recentDistanceStats={recentDistanceStatsByType}
        />
    );
}
