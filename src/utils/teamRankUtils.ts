import teamStadiumRanks from '../data/team_stadium_rank.json';
import AssetLoader from '../data/AssetLoader';

export type TeamStadiumRank = {
    id: number;
    teamRank: number;
    teamRankGroup: number;
    teamMinValue: number;
    teamMaxValue: number;
    icon: string;
    iconLarge: string;
};

const ranks = teamStadiumRanks as TeamStadiumRank[];
const sortedByMin = [...ranks].sort((a, b) => b.teamMinValue - a.teamMinValue);
const lowestRank = sortedByMin[sortedByMin.length - 1];

export function resolveTeamStadiumRank(teamRating: number): TeamStadiumRank {
    if (!Number.isFinite(teamRating) || teamRating <= 0) {
        return lowestRank;
    }
    for (const rank of sortedByMin) {
        if (teamRating >= rank.teamMinValue) {
            return rank;
        }
    }
    return lowestRank;
}

export function getTeamRankIcon(
    teamRating: number,
    options?: { large?: boolean },
): { icon: string; name: string; teamRank: number } {
    const entry = resolveTeamStadiumRank(teamRating);
    const filename = options?.large ? entry.iconLarge : entry.icon;
    return {
        icon: AssetLoader.getTeamRankIcon(filename),
        name: filename,
        teamRank: entry.teamRank,
    };
}
