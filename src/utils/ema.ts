/**
 * Standard EMA seeded with the first value so the line covers the full series.
 * EMA_0 = value_0; thereafter
 * EMA_t = value_t * k + EMA_{t-1} * (1 - k) with k = 2 / (period + 1).
 */
export function ema(values: number[], period: number): (number | null)[] {
    if (values.length === 0) return [];

    const n = Math.max(1, Math.floor(period));
    const k = 2 / (n + 1);
    const result: (number | null)[] = new Array(values.length);
    let emaVal = values[0];
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
 */
export function emaForVisibleWindow(
    visibleValues: number[],
    visibleKeys: string[],
    sourceValues: number[] | undefined,
    sourceKeys: string[] | undefined,
    period: number,
): (number | null)[] {
    if (
        !sourceValues
        || !sourceKeys
        || sourceValues.length === 0
        || sourceValues.length !== sourceKeys.length
        || visibleKeys.length !== visibleValues.length
    ) {
        return ema(visibleValues, period);
    }

    const sourceKeySet = new Set(sourceKeys);
    const overlap = visibleKeys.some((key) => sourceKeySet.has(key));
    if (!overlap) return ema(visibleValues, period);

    const sourceEma = ema(sourceValues, period);
    const byKey = new Map<string, number | null>();
    for (let i = 0; i < sourceKeys.length; i++) {
        byKey.set(sourceKeys[i], sourceEma[i]);
    }

    return visibleKeys.map((key) => (byKey.has(key) ? byKey.get(key)! : null));
}
