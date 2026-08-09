import { Alert } from 'react-bootstrap';

import { useRaceProgress, useRaceStore } from '../store/RaceStore';

/** True while older files continue loading after the priority (Recent) batch. */
export function useLoadingRemainingFiles(): boolean {
    const { loadingRemaining } = useRaceStore();
    return loadingRemaining;
}

function RemainingFilesLoadingAlertBody() {
    const { progress } = useRaceProgress();
    return (
        <Alert variant="warning" className="dashboard-loading-alert dashboard-remaining-alert mb-3">
            Caution: Loading remaining files {progress.loaded}/{progress.total}…
        </Alert>
    );
}

/** Yellow caution bar while older files load in the background. */
export default function RemainingFilesLoadingAlert() {
    const loadingRemaining = useLoadingRemainingFiles();
    if (!loadingRemaining) return null;
    return <RemainingFilesLoadingAlertBody />;
}
