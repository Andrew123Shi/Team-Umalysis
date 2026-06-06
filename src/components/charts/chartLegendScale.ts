export type LegendSelectChangedEvent = {
    selected: Record<string, boolean>;
    name?: string;
};

export type LegendScaleSeries = {
    name: string;
    yAxisIndex: number;
    data: readonly (number | null | undefined)[];
};

export function isLegendSeriesVisible(selected: Record<string, boolean>, name: string): boolean {
    return selected[name] !== false;
}

export function collectVisibleAxisValues(
    series: LegendScaleSeries[],
    selected: Record<string, boolean>,
    yAxisIndex: number,
): number[] {
    const values: number[] = [];
    series.forEach((s) => {
        if (s.yAxisIndex !== yAxisIndex || !isLegendSeriesVisible(selected, s.name)) return;
        s.data.forEach((v) => {
            if (v != null && Number.isFinite(v)) values.push(v);
        });
    });
    return values;
}

export function collectAllAxisValues(
    series: LegendScaleSeries[],
    yAxisIndex: number,
): number[] {
    const values: number[] = [];
    series.forEach((s) => {
        if (s.yAxisIndex !== yAxisIndex) return;
        s.data.forEach((v) => {
            if (v != null && Number.isFinite(v)) values.push(v);
        });
    });
    return values;
}
