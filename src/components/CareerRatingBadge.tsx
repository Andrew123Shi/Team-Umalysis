import {
    BADGE_SPRITE_SIZE,
    getCareerRatingBadge,
    getCareerRatingBadgeStyle,
} from '../utils/careerRatingBadges';

export default function CareerRatingBadge({
    score,
    size = 48,
    className,
}: {
    score: number;
    size?: number;
    className?: string;
}) {
    const badge = getCareerRatingBadge(score);
    const scale = size / BADGE_SPRITE_SIZE;

    return (
        <span
            className={`career-rating-badge-wrap${className ? ` ${className}` : ''}`}
            style={{ width: size, height: size }}
        >
            <span
                role="img"
                aria-label={`${badge.label} rank`}
                className="career-rating-badge-sprite"
                style={{
                    ...getCareerRatingBadgeStyle(badge, { size: BADGE_SPRITE_SIZE }),
                    transform: `scale(${scale})`,
                }}
            />
        </span>
    );
}
