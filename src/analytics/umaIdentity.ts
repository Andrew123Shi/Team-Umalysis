import type { UmaEntry } from './types';

export type PlayerIdentity = {
    teamId: number;
    trainerName: string;
};

/** Stable build key from rating + final stats (not trained_chara_id). */
export function buildUmaFingerprint(entry: Pick<UmaEntry, 'stats' | 'rankScore'>): string {
    const { stats, rankScore } = entry;
    return [
        stats.speed,
        stats.stamina,
        stats.pow,
        stats.guts,
        stats.wiz,
        rankScore,
    ].join(':');
}

/** Round win: player's best finish beats opponent's best finish. */
export function isRoundWinByPlacement(
    playerUmas: Pick<UmaEntry, 'finishOrder'>[],
    opponentUmas: Pick<UmaEntry, 'finishOrder'>[],
): boolean {
    if (playerUmas.length === 0 || opponentUmas.length === 0) return false;
    const playerBest = playerUmas.reduce((best, u) => Math.min(best, u.finishOrder), 99);
    const opponentBest = opponentUmas.reduce((best, u) => Math.min(best, u.finishOrder), 99);
    return playerBest < opponentBest;
}

function parseIdentityKey(key: string): PlayerIdentity {
    const [teamId, trainerName] = key.split(':');
    return { teamId: Number(teamId), trainerName };
}

function pickPlayerIdentityFromCounts(counts: Map<string, number>): PlayerIdentity {
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const max = sorted[0]?.[1] ?? 0;
    const tied = sorted.filter(([, count]) => count === max);
    const bonos = tied.find(([key]) => key === '1:BonosDischarge');
    if (bonos) return parseIdentityKey(bonos[0]);
    const fallback = tied.sort(([a], [b]) => Number(a.split(':')[0]) - Number(b.split(':')[0]))[0];
    return parseIdentityKey(fallback?.[0] ?? '1:');
}

/** Detect player from one session's start params (tie-break favors BonosDischarge on team 1). */
export function detectPlayerIdentityFromSession(
    starts: { race_horse_data_array?: { team_id?: number; trainer_name?: string }[] }[],
): PlayerIdentity {
    const counts = new Map<string, number>();
    starts.forEach((start) => {
        (start.race_horse_data_array ?? []).forEach((horse) => {
            const teamId = Number(horse.team_id);
            const trainer = String(horse.trainer_name ?? '');
            if (teamId > 0 && trainer) {
                const key = `${teamId}:${trainer}`;
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        });
    });
    return pickPlayerIdentityFromCounts(counts);
}

/** Detect player as the trainer+team present in the most sessions (e.g. BonosDischarge). */
export function detectPlayerIdentityAcrossSessions(
    sessions: { rounds: unknown[]; playerTrainerName: string; playerTeamId: number }[],
): PlayerIdentity {
    const sessionPresence = new Map<string, number>();
    sessions.forEach((session) => {
        const key = `${session.playerTeamId}:${session.playerTrainerName}`;
        if (session.playerTrainerName) {
            sessionPresence.set(key, (sessionPresence.get(key) ?? 0) + 1);
        }
    });
    if (sessionPresence.size === 0) {
        return { teamId: 1, trainerName: '' };
    }
    return pickPlayerIdentityFromCounts(sessionPresence);
}

export function resolvePlayerIdentity(
    sessions: { rounds: unknown[]; playerTrainerName: string; playerTeamId: number }[],
    configured?: string,
): PlayerIdentity {
    const trimmed = configured?.trim();
    if (trimmed) {
        const match = sessions.find((s) => s.playerTrainerName === trimmed);
        if (match) {
            return { teamId: match.playerTeamId, trainerName: match.playerTrainerName };
        }
        return { teamId: 1, trainerName: trimmed };
    }
    return detectPlayerIdentityAcrossSessions(sessions);
}

export function isPlayerHorse(
    horse: { team_id?: number; trainer_name?: string },
    identity: PlayerIdentity,
): boolean {
    return Number(horse.team_id) === identity.teamId
        && String(horse.trainer_name ?? '') === identity.trainerName;
}

/** Most common trainer name on the opposing team for a Team Trial session. */
export function detectOpponentTrainerFromSession(
    starts: { race_horse_data_array?: { team_id?: number; trainer_name?: string }[] }[],
    player: PlayerIdentity,
): string {
    const opponentTeamId = player.teamId === 1 ? 2 : 1;
    const counts = new Map<string, number>();
    for (const start of starts) {
        for (const horse of start.race_horse_data_array ?? []) {
            const teamId = Number(horse.team_id);
            const trainer = String(horse.trainer_name ?? '').trim();
            if (teamId === opponentTeamId && trainer) {
                counts.set(trainer, (counts.get(trainer) ?? 0) + 1);
            }
        }
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) return best[0];

    for (const start of starts) {
        for (const horse of start.race_horse_data_array ?? []) {
            const trainer = String(horse.trainer_name ?? '').trim();
            if (trainer && !isPlayerHorse(horse, player)) {
                return trainer;
            }
        }
    }
    return 'Unknown';
}

/** Resolve opponent trainer from a loaded session (works for sessions parsed before opponentTrainerName existed). */
export function getSessionOpponentTrainer(session: {
    opponentTrainerName?: string;
    playerTeamId: number;
    rounds: {
        opponentUmas: { trainerName: string }[];
        parsedRace: { raceHorseInfo: { team_id?: number; trainer_name?: string }[] };
    }[];
}): string {
    if (session.opponentTrainerName) return session.opponentTrainerName;

    const opponentTeamId = session.playerTeamId === 1 ? 2 : 1;
    for (const round of session.rounds) {
        const fromRaceInfo = round.parsedRace.raceHorseInfo.find(
            (h) => Number(h.team_id) === opponentTeamId && h.trainer_name,
        )?.trainer_name;
        if (fromRaceInfo) return String(fromRaceInfo);

        const fromUmas = round.opponentUmas.find((u) => u.trainerName && u.trainerName !== 'NPC')?.trainerName;
        if (fromUmas) return fromUmas;
    }
    return 'Unknown';
}

export function countRoundWinsByPlacement(
    starts: { race_horse_data_array?: { team_id?: number; trainer_name?: string }[] }[],
    results: { chara_result_array?: { team_id?: number; finish_order?: number }[] }[],
): { roundsWon: number; identity: PlayerIdentity } {
    const identity = detectPlayerIdentityFromSession(starts);
    const opponentTeamId = identity.teamId === 1 ? 2 : 1;
    let roundsWon = 0;

    for (let i = 0; i < results.length; i++) {
        const charaResults = results[i]?.chara_result_array ?? [];
        const playerBest = charaResults
            .filter((c) => Number(c.team_id) === identity.teamId)
            .reduce((best, c) => Math.min(best, Number(c.finish_order) || 99), 99);
        const opponentBest = charaResults
            .filter((c) => Number(c.team_id) === opponentTeamId)
            .reduce((best, c) => Math.min(best, Number(c.finish_order) || 99), 99);
        if (playerBest < opponentBest) roundsWon += 1;
    }

    return { roundsWon, identity };
}
