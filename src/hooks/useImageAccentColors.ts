import { useEffect, useMemo, useState } from 'react';

type AccentSource = {
    key: string;
    url: string;
};

function fallbackColor(key: string | number): string {
    const text = String(key);
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return `hsl(${hash % 360} 82% 62%)`;
}

function rgbToHsl(red: number, green: number, blue: number): [number, number, number] {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            default:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
}

function sampleImageColor(url: string): Promise<string> {
    return new Promise((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 24;
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) {
                resolve(fallbackColor(url));
                return;
            }
            context.drawImage(image, 0, 0, size, size);
            const data = context.getImageData(0, 0, size, size).data;
            let best: { red: number; green: number; blue: number; score: number } | null = null;
            for (let i = 0; i < data.length; i += 16) {
                const alpha = data[i + 3];
                if (alpha < 160) continue;
                const red = data[i];
                const green = data[i + 1];
                const blue = data[i + 2];
                const [, saturation, lightness] = rgbToHsl(red, green, blue);
                if (lightness < 25 || lightness > 94 || saturation < 45) continue;
                const colorfulness = Math.max(red, green, blue) - Math.min(red, green, blue);
                const isSkinTone = red > green && green > blue && red - blue > 35 && saturation < 72;
                if (isSkinTone) continue;
                const score = saturation * 2.35 + colorfulness * 0.36 + lightness * 0.45;
                if (!best || score > best.score) {
                    best = { red, green, blue, score };
                }
            }
            if (!best) {
                resolve(fallbackColor(url));
                return;
            }
            const [hue, saturation, lightness] = rgbToHsl(best.red, best.green, best.blue);
            const boostedSaturation = Math.max(88, Math.min(100, saturation * 1.35));
            const boostedLightness = Math.max(60, Math.min(74, lightness * 1.12));
            resolve(`hsl(${Math.round(hue)} ${Math.round(boostedSaturation)}% ${Math.round(boostedLightness)}%)`);
        };
        image.onerror = () => resolve(fallbackColor(url));
        image.src = url;
    });
}

export function useImageAccentColors(sources: AccentSource[]): Record<string, string> {
    const stableSources = useMemo(
        () => sources.map((source) => `${source.key}\u0000${source.url}`).join('\u0001'),
        [sources],
    );
    const [colors, setColors] = useState<Record<string, string>>({});

    useEffect(() => {
        let cancelled = false;
        sources.forEach(({ key, url }) => {
            if (!url || colors[key]) return;
            sampleImageColor(url).then((color) => {
                if (cancelled) return;
                setColors((current) => current[key] ? current : { ...current, [key]: color });
            });
        });
        return () => {
            cancelled = true;
        };
    }, [colors, sources, stableSources]);

    return colors;
}

export { fallbackColor as fallbackAccentColor };
