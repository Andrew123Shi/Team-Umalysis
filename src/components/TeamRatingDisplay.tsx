import { formatScore } from '../utils/formatScore';
import { getTeamRankIcon } from '../utils/teamRankUtils';

export function formatTeamRatingHtml(teamRating: number, showLabel = true): string {
    const { icon, name } = getTeamRankIcon(teamRating);
    const label = showLabel ? 'Team Rating ' : '';
    return `${label}<img src="${icon}" alt="${name}" class="rating-display-icon team-rating-display-icon" /> ${formatScore(teamRating)}`;
}

export default function TeamRatingDisplay({
    teamRating,
    className,
    showLabel = true,
    label = 'Team Rating',
}: {
    teamRating: number;
    className?: string;
    showLabel?: boolean;
    label?: string;
}) {
    const { icon, name } = getTeamRankIcon(teamRating);

    return (
        <span className={`rating-display team-rating-display${className ? ` ${className}` : ''}`}>
            {showLabel && <span className="rating-display-label">{label} </span>}
            <img src={icon} alt={name} className="rating-display-icon team-rating-display-icon" />
            <span className="rating-display-score">{formatScore(teamRating)}</span>
        </span>
    );
}
