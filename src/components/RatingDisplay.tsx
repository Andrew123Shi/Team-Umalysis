import { formatScore } from '../utils/formatScore';
import { getRankIcon } from '../utils/rankUtils';

export function formatRatingHtml(rankScore: number, showLabel = true): string {
    const { icon, name } = getRankIcon(rankScore);
    const label = showLabel ? 'Rating ' : '';
    return `${label}<img src="${icon}" alt="${name}" class="rating-display-icon" style="height:1.1em;width:auto;vertical-align:middle" /> ${formatScore(rankScore)}`;
}

export default function RatingDisplay({
    rankScore,
    className,
    showLabel = true,
    label = 'Rating',
}: {
    rankScore: number;
    className?: string;
    showLabel?: boolean;
    label?: string;
}) {
    const { icon, name } = getRankIcon(rankScore);

    return (
        <span className={`rating-display${className ? ` ${className}` : ''}`}>
            {showLabel && <span className="rating-display-label">{label} </span>}
            <img src={icon} alt={name} className="rating-display-icon" />
            <span className="rating-display-score">{formatScore(rankScore)}</span>
        </span>
    );
}
