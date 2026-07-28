import type { TTRound } from '../analytics/types';

export function roundSupportCardBonusScore(round: TTRound): number {
    const umaBonus = round.playerUmas.reduce(
        (sum, uma) => sum + uma.scoreEvents.reduce(
            (eventSum, event) => eventSum + (event.bonusScores?.supportCard ?? 0),
            0,
        ),
        0,
    );
    const teamBonus = round.teamScoreEvents.reduce(
        (sum, event) => sum + (event.bonusScores?.supportCard ?? 0),
        0,
    );
    return umaBonus + teamBonus;
}

function recordedRoundTeamScore(round: TTRound): number {
    const playerScore = round.playerUmas.reduce((sum, uma) => sum + uma.totalScore, 0);
    const teamScore = round.teamScoreEvents.reduce((sum, event) => sum + event.score, 0);
    const calculatedScore = playerScore + teamScore;
    const hasScoreEvents = round.playerUmas.some((uma) => uma.scoreEvents.length > 0)
        || round.teamScoreEvents.length > 0;

    return hasScoreEvents ? calculatedScore : round.teamTotalScore;
}

export function rawRoundTeamScore(round: TTRound): number {
    return recordedRoundTeamScore(round) + roundSupportCardBonusScore(round);
}

export function rawSessionTeamScore(rounds: TTRound[]): number {
    return rounds.reduce((sum, round) => sum + rawRoundTeamScore(round), 0);
}
