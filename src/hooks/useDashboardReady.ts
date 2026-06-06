import { useEffect, useState } from 'react';
import type { TTSession } from '../analytics/types';

/**
 * Flips true one frame after sessions arrive so aggregated stats finish computing
 * before chart components mount visibly (preserving ECharts entrance animations).
 */
export function useDashboardReady(sessions: TTSession[]): boolean {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!sessions.length) {
            setReady(false);
            return undefined;
        }

        setReady(false);
        let cancelled = false;
        const frame = requestAnimationFrame(() => {
            if (!cancelled) setReady(true);
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
        };
    }, [sessions]);

    return ready;
}
