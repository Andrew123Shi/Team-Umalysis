import { formatScore } from '../utils/formatScore';
import { AnimatedText } from './AnimatedNumber';
import { getTeamRankIcon } from '../utils/teamRankUtils';

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
            <span className="rating-display-score"><AnimatedText text={formatScore(teamRating)} /></span>
        </span>
    );
}
