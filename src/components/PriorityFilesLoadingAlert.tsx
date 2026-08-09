import { Alert } from 'react-bootstrap';

import { PRIORITY_SESSION_LOAD_COUNT } from '../data/raceLoader';
import { useRaceProgress } from '../store/RaceStore';

/** Isolated so progress ticks don't re-render the rest of the dashboard shell. */
export default function PriorityFilesLoadingAlert() {
    const { progress } = useRaceProgress();
    return (
        <Alert variant="info" className="app-card dashboard-loading-alert">
            {progress.total > 0
                ? `Loading most recent files ${progress.loaded}/${Math.min(progress.total, PRIORITY_SESSION_LOAD_COUNT)}…`
                : 'Initializing file loading...'}
        </Alert>
    );
}
