import StatsPanels from '../../components/StatsPanels';
import { useDashboardOutletContext } from './DashboardLayout';

export default function OverviewPage() {
    const { overallStats, recentOverallStats } = useDashboardOutletContext();

    if (!overallStats) return null;

    return (
        <StatsPanels
            stats={overallStats}
            recentStats={recentOverallStats ?? overallStats}
            showDistanceWinRates
        />
    );
}
