/**
 * Sliding-window average. At index i, averages values in
 * [max(0, i - window + 1), i] (uses fewer points until the window fills).
 */
export function rollingAverage(values: number[], window: number): (number | null)[] {
    if (values.length === 0) return [];

    const n = Math.max(1, Math.floor(window));
    const result: (number | null)[] = new Array(values.length);
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= n) sum -= values[i - n];
        const count = Math.min(i + 1, n);
        result[i] = sum / count;
    }
    return result;
}

/**
 * Compute rolling average on a longer source series, then align to the visible
 * window by key. Falls back to visible-only when source is missing/unrelated.
 */
export function rollingAverageForVisibleWindow(
    visibleValues: number[],
    visibleKeys: string[],
    sourceValues: number[] | undefined,
    sourceKeys: string[] | undefined,
    window: number,
): (number | null)[] {
    if (
        !sourceValues
        || !sourceKeys
        || sourceValues.length === 0
        || sourceValues.length !== sourceKeys.length
        || visibleKeys.length !== visibleValues.length
    ) {
        return rollingAverage(visibleValues, window);
    }

    const sourceKeySet = new Set(sourceKeys);
    const overlap = visibleKeys.some((key) => sourceKeySet.has(key));
    if (!overlap) return rollingAverage(visibleValues, window);

    const sourceRolling = rollingAverage(sourceValues, window);
    const byKey = new Map<string, number | null>();
    for (let i = 0; i < sourceKeys.length; i++) {
        byKey.set(sourceKeys[i], sourceRolling[i]);
    }

    return visibleKeys.map((key) => (byKey.has(key) ? byKey.get(key)! : null));
}
