/**
 * Flat average within each segment delimited by boundary indices.
 * Boundaries mark segment starts (e.g. roster-update x indices).
 * Returns one value per input point; empty input yields [].
 */
export function segmentAverage(
    values: Array<number | null | undefined>,
    boundaryIndices: number[],
): (number | null)[] {
    const len = values.length;
    if (len === 0) return [];

    const starts = [
        0,
        ...boundaryIndices
            .filter((i) => Number.isInteger(i) && i > 0 && i < len)
            .sort((a, b) => a - b),
    ];
    // Deduplicate while preserving order
    const uniqueStarts = starts.filter((v, i) => i === 0 || v !== starts[i - 1]);

    const result: (number | null)[] = new Array(len).fill(null);

    for (let s = 0; s < uniqueStarts.length; s++) {
        const from = uniqueStarts[s];
        const to = s + 1 < uniqueStarts.length ? uniqueStarts[s + 1] : len;
        let sum = 0;
        let count = 0;
        for (let i = from; i < to; i++) {
            const v = values[i];
            if (v != null && Number.isFinite(v)) {
                sum += v;
                count += 1;
            }
        }
        if (count === 0) continue;
        const avg = sum / count;
        for (let i = from; i < to; i++) {
            result[i] = avg;
        }
    }

    return result;
}
