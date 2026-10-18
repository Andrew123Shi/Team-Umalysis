import type {
    ScoreBonusKey,
    ScoreBonusSettings,
    ScoreEvent,
    TTRound,
    TTSession,
    UmaEntry,
} from '../analytics/types';

/**
 * Every score line is a base value plus up to four bonuses, all stored in the save file:
 * score = base + ace + opponentRating + streak + supportCard.
 * Turning every bonus on reproduces the in-game score exactly.
 */
export const SCORE_BONUS_KEYS: ScoreBonusKey[] = ['supportCard', 'opponentRating', 'streak', 'ace'];

export const BASE_SCORE_ONLY: ScoreBonusSettings = {
    ace: false,
    opponentRating: false,
    streak: false,
    supportCard: false,
};

export const IN_GAME_SCORE: ScoreBonusSettings = {
    ace: true,
    opponentRating: true,
    streak: true,
    supportCard: true,
};

export function scoreEventValue(event: ScoreEvent, bonuses: ScoreBonusSettings): number {
    return SCORE_BONUS_KEYS.reduce(
        (sum, key) => sum + (bonuses[key] ? event.bonusScores[key] : 0),
        event.baseScore,
    );
}

export function scoreEventsValue(events: ScoreEvent[], bonuses: ScoreBonusSettings): number {
    return events.reduce((sum, event) => sum + scoreEventValue(event, bonuses), 0);
}

export function umaScore(uma: UmaEntry, bonuses: ScoreBonusSettings): number {
    return scoreEventsValue(uma.scoreEvents, bonuses);
}

/** Team-wide events (All Members Podiumed / Placed). */
export function teamEventsScore(round: TTRound, bonuses: ScoreBonusSettings): number {
    return scoreEventsValue(round.teamScoreEvents, bonuses);
}

/**
 * One race's score. With a buildKey, only that uma's lines count (team events can't be
 * attributed to a single uma); otherwise the whole team plus team events.
 */
export function roundScore(round: TTRound, bonuses: ScoreBonusSettings, buildKey?: string): number {
    if (buildKey !== undefined) {
        return round.playerUmas
            .filter((uma) => uma.buildKey === buildKey)
            .reduce((sum, uma) => sum + umaScore(uma, bonuses), 0);
    }
    const umaTotal = round.playerUmas.reduce((sum, uma) => sum + umaScore(uma, bonuses), 0);
    return umaTotal + teamEventsScore(round, bonuses);
}

export function victoryBonusScore(session: TTSession, bonuses: ScoreBonusSettings): number {
    return session.victoryBonus ? scoreEventValue(session.victoryBonus, bonuses) : 0;
}

/** Sum of race scores plus the victory bonus when the session was won. */
export function sessionScore(session: TTSession, bonuses: ScoreBonusSettings): number {
    const racesTotal = session.rounds.reduce((sum, round) => sum + roundScore(round, bonuses), 0);
    return racesTotal + victoryBonusScore(session, bonuses);
}

/** Race score as displayed in game (team_total_score). */
export function inGameRoundScore(round: TTRound): number {
    if (Number.isFinite(round.teamTotalScore) && round.teamTotalScore > 0) return round.teamTotalScore;
    return roundScore(round, IN_GAME_SCORE);
}

/** Session total as displayed in game: race totals plus the victory bonus. */
export function inGameSessionScore(session: TTSession): number {
    const racesTotal = session.rounds.reduce((sum, round) => sum + inGameRoundScore(round), 0);
    return racesTotal + victoryBonusScore(session, IN_GAME_SCORE);
}
