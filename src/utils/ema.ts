/**
 * Standard EMA. By default seeds with the first value so the line covers the full series:
 * EMA_0 = value_0; thereafter
 * EMA_t = value_t * k + EMA_{t-1} * (1 - k) with k = 2 / (period + 1).
 *
 * When `seed` is provided it acts as a synthetic value before index 0:
 * EMA_0 = value_0 * k + seed * (1 - k).
 */
export function ema(values: number[], period: number, seed?: number): (number | null)[] {
    if (values.length === 0) return [];

    const n = Math.max(1, Math.floor(period));
    const k = 2 / (n + 1);
    const result: (number | null)[] = new Array(values.length);
    const hasSeed = seed !== undefined && Number.isFinite(seed);
    let emaVal = hasSeed ? values[0] * k + seed * (1 - k) : values[0];
    result[0] = emaVal;

    for (let i = 1; i < values.length; i++) {
        emaVal = values[i] * k + emaVal * (1 - k);
        result[i] = emaVal;
    }
    return result;
}

/**
 * Compute EMA on a longer source series, then return values aligned to the
 * visible window by key (e.g. fileName). Falls back to EMA on visible values
 * alone when no usable source overlap exists.
 *
 * `seed` is only used for the visible-only fallback (e.g. roster average while
 * older history is still loading).
 */
export function emaForVisibleWindow(
    visibleValues: number[],
    visibleKeys: string[],
    sourceValues: number[] | undefined,
    sourceKeys: string[] | undefined,
    period: number,
    seed?: number,
): (number | null)[] {
    if (
        !sourceValues
        || !sourceKeys
        || sourceValues.length === 0
        || sourceValues.length !== sourceKeys.length
        || visibleKeys.length !== visibleValues.length
    ) {
        return ema(visibleValues, period, seed);
    }

    const sourceKeySet = new Set(sourceKeys);
    const overlap = visibleKeys.some((key) => sourceKeySet.has(key));
    if (!overlap) return ema(visibleValues, period, seed);

    const sourceEma = ema(sourceValues, period);
    const byKey = new Map<string, number | null>();
    for (let i = 0; i < sourceKeys.length; i++) {
        byKey.set(sourceKeys[i], sourceEma[i]);
    }

    return visibleKeys.map((key) => (byKey.has(key) ? byKey.get(key)! : null));
}

/** Fade EMA stroke from transparent at point 0 to full opacity by `fadeThroughPoint` (1-based). */
export const EMA_FADE_THROUGH_POINT = 50;

export function emaLineFadeColor(
    opaqueCssColor: string,
    pointCount: number,
    fadeThroughPoint: number = EMA_FADE_THROUGH_POINT,
): { type: 'linear'; x: number; y: number; x2: number; y2: number; colorStops: { offset: number; color: string }[] } {
    const fadeEnd = pointCount <= 1
        ? 1
        : Math.min(1, (Math.max(1, fadeThroughPoint) - 1) / Math.max(1, pointCount - 1));

    let transparent = opaqueCssColor;
    let opaque = opaqueCssColor;
    const hex = /^#([0-9a-fA-F]{6})$/.exec(opaqueCssColor.trim());
    if (hex) {
        const n = Number.parseInt(hex[1], 16);
        const r = (n >> 16) & 255;
        const g = (n >> 8) & 255;
        const b = n & 255;
        transparent = `rgba(${r}, ${g}, ${b}, 0)`;
        opaque = `rgba(${r}, ${g}, ${b}, 1)`;
    }

    const colorStops = [
        { offset: 0, color: transparent },
        { offset: fadeEnd, color: opaque },
    ];
    if (fadeEnd < 1) {
        colorStops.push({ offset: 1, color: opaque });
    }

    return {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 1,
        y2: 0,
        colorStops,
    };
}
