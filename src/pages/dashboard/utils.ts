import type { TTSession, UmaEntry } from '../../analytics/types';

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

type UmaSlugSource = {
    buildKey: string;
    charaName: string;
    rankScore: number;
    stats: UmaEntry['stats'];
};

function slugifyName(name: string): string {
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Readable profile slug, e.g. "hishi-akebono-19321-4778" (name, rating, stat total). */
export function umaProfileSlug(uma: UmaSlugSource): string {
    const { speed, stamina, pow, guts, wiz } = uma.stats;
    const statTotal = speed + stamina + pow + guts + wiz;
    return `${slugifyName(uma.charaName)}-${Math.round(uma.rankScore)}-${statTotal}`;
}

export function umaProfilePath(uma: UmaSlugSource): string {
    return `/uma/${umaProfileSlug(uma)}`;
}

/** Resolves a profile URL segment (slug, or a legacy encoded build key) to a build key. */
export function resolveUmaProfileParam(
    param: string | undefined,
    candidates: readonly UmaSlugSource[],
): string | null {
    if (!param) return null;
    let decoded: string;
    try {
        decoded = decodeURIComponent(param);
    } catch {
        return null;
    }
    const slug = decoded.toLowerCase();
    const match = candidates.find((uma) => umaProfileSlug(uma) === slug)
        ?? candidates.find((uma) => uma.buildKey === decoded);
    return match?.buildKey ?? null;
}
