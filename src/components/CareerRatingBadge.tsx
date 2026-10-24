import {
    BADGE_SPRITE_SIZE,
    getCareerRatingBadge,
    getCareerRatingBadgeStyle,
} from '../utils/careerRatingBadges';
import { useChartScale } from './charts/chartTheme';

export default function CareerRatingBadge({
    score,
    size = 48,
    className,
}: {
    score: number;
    /** Size in px at the 1440p design root size; scales with the root font size. */
    size?: number;
    className?: string;
}) {
    const badge = getCareerRatingBadge(score);
    const px = useChartScale().px(size);
    const scale = px / BADGE_SPRITE_SIZE;

    return (
        <span
            className={`career-rating-badge-wrap${className ? ` ${className}` : ''}`}
            style={{ width: px, height: px }}
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
