/** Format race/total/rank scores with thousands separators (e.g. 600,000). */
export function formatScore(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return Math.round(value).toLocaleString();
}
