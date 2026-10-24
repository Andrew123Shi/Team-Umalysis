import { MOTION_MS } from '../motion';

/**
 * Trend charts draw in over 1s like the other line charts (the ECharts
 * default); later changes are morphed by `EChart`, and anything ECharts still
 * animates itself (legend toggles) uses the shared easeOutQuint motion.
 */
export const CHART_UPDATE_ANIMATION = {
    animation: true,
    animationDuration: 1000,
    animationEasing: 'cubicOut',
    animationDurationUpdate: MOTION_MS,
    animationEasingUpdate: 'quinticOut',
} as const;
