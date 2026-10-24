import { useEffect, useState } from 'react';
import type { TTSession } from '../analytics/types';

/**
 * Flips true one frame after sessions first arrive so aggregated stats finish computing
 * before chart components mount visibly (preserving ECharts entrance animations).
 * Later session updates (e.g. the remaining files after the Recent batch) keep the
 * dashboard mounted so charts update in place instead of remounting.
 */
export function useDashboardReady(sessions: TTSession[]): boolean {
    const hasSessions = sessions.length > 0;
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!hasSessions) {
            setReady(false);
            return undefined;
        }

        let cancelled = false;
        const frame = requestAnimationFrame(() => {
            if (!cancelled) setReady(true);
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
        };
    }, [hasSessions]);

    return ready;
}
