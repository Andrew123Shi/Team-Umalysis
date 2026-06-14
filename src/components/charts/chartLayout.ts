/** Shared layout for side-by-side opponent bar charts (style composition + strength). */
export const BAR_CHART_HEIGHT = 240;

export const BAR_CHART_GRID = {
    left: 8,
    right: 8,
    top: 48,
    bottom: 36,
    containLabel: true,
} as const;

/** Style composition y-axis names need a touch more canvas to match strength plot height. */
export const STYLE_COMPOSITION_CHART_HEIGHT = BAR_CHART_HEIGHT + 3;

export const CHART_UPDATE_ANIMATION = {
    animation: true,
    animationDuration: 240,
    animationDurationUpdate: 420,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
} as const;
