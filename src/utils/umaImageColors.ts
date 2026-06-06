import umaImageColors from '../data/umaImageColors.json';

type UmaImageColorEntry = {
    name: string;
    main?: string;
    sub?: string;
};

const colorMap = umaImageColors as Record<string, UmaImageColorEntry>;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!match) return null;
    return {
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16),
    };
}

function colorScore(hex: string): number {
    const rgb = hexToRgb(hex);
    if (!rgb) return -1;
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    const colorfulness = max - min;
    const brightness = (rgb.r + rgb.g + rgb.b) / 3;
    return colorfulness * 1.6 + brightness * 0.35;
}

export function getUmaImageColorByCharaId(charaId: number): string | undefined {
    const entry = colorMap[String(charaId)];
    if (!entry) return undefined;
    const candidates = [entry.main, entry.sub].filter((color): color is string => Boolean(color));
    if (candidates.length === 0) return undefined;
    return candidates.sort((a, b) => colorScore(b) - colorScore(a))[0];
}

export function getUmaImageColorByCardId(cardId: number): string | undefined {
    return getUmaImageColorByCharaId(Math.floor(cardId / 100));
}
