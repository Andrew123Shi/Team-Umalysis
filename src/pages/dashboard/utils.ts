import type { TTSession } from '../../analytics/types';

export const HISTORICAL_PLACEHOLDER_LABEL = 'Choose historical uma...';
export const RECENT_TRIAL_LIMIT = 100;

export function scrollToDashboardTop() {
    requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
}

export function latestTrialSessions(sessions: TTSession[], limit: number): TTSession[] {
    return sessions
        .map((session, sessionIndex) => ({ session, sessionIndex }))
        .sort((a, b) => {
            const aTime = a.session.savedAt?.getTime();
            const bTime = b.session.savedAt?.getTime();
            if (aTime !== undefined && bTime !== undefined && aTime !== bTime) {
                return bTime - aTime;
            }
            if (aTime !== undefined && bTime === undefined) return -1;
            if (aTime === undefined && bTime !== undefined) return 1;
            return a.sessionIndex - b.sessionIndex;
        })
        .slice(0, limit)
        .map(({ session }) => session);
}

export function umaProfilePath(buildKey: string): string {
    return `/uma/${encodeURIComponent(buildKey)}`;
}

export function decodeBuildKey(encoded: string | undefined): string | null {
    if (!encoded) return null;
    try {
        return decodeURIComponent(encoded);
    } catch {
        return null;
    }
}
