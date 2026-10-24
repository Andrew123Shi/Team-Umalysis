export const chartTooltipStyle = {
    backgroundColor: 'rgba(5, 7, 10, 0.96)',
    borderColor: 'rgba(255, 255, 255, 0.13)',
    borderWidth: 1,
    padding: [10, 14],
    textStyle: {
        color: '#9ba5b4',
        fontWeight: 500,
    },
    extraCssText: [
        'border-radius: 6px',
        'box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5)',
        'backdrop-filter: blur(10px)',
        "font-family: 'Geist Mono', ui-monospace, Consolas, monospace",
        'font-size: 0.92rem',
        'line-height: 1.55',
    ].join(';'),
};

/** Tooltip markup helpers; styled by `.chart-tip-*` in the app stylesheet. */
export function tooltipHead(text: string): string {
    return `<div class="chart-tip-head">${text}</div>`;
}

export function tooltipRow(label: string, value: string): string {
    return `<div class="chart-tip-row"><span>${label}</span><b>${value}</b></div>`;
}

export function tooltipNote(html: string): string {
    return `<div class="chart-tip-note">${html}</div>`;
}

export function tooltipSection(html: string): string {
    return `<div class="chart-tip-section">${html}</div>`;
}
