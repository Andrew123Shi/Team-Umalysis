import { useEffect, useRef, useState } from 'react';

const NUMBER_ANIMATION_MS = 420;
const NUMBER_PATTERN = /-?\d[\d,]*(?:\.\d+)?/g;

type NumberToken = {
    raw: string;
    value: number;
    start: number;
    end: number;
    decimals: number;
    useGrouping: boolean;
};

function parseTokens(text: string): NumberToken[] {
    return Array.from(text.matchAll(NUMBER_PATTERN)).map((match) => {
        const raw = match[0];
        const decimalPart = raw.includes('.') ? raw.split('.')[1] : '';
        return {
            raw,
            value: Number(raw.replace(/,/g, '')),
            start: match.index ?? 0,
            end: (match.index ?? 0) + raw.length,
            decimals: decimalPart.length,
            useGrouping: raw.includes(','),
        };
    }).filter((token) => Number.isFinite(token.value));
}

function formatToken(value: number, target: NumberToken): string {
    if (target.useGrouping) {
        return value.toLocaleString(undefined, {
            minimumFractionDigits: target.decimals,
            maximumFractionDigits: target.decimals,
        });
    }
    return value.toFixed(target.decimals);
}

function renderInterpolatedText(
    targetText: string,
    fromTokens: NumberToken[],
    toTokens: NumberToken[],
    progress: number,
): string {
    let output = '';
    let cursor = 0;
    toTokens.forEach((toToken, index) => {
        const fromToken = fromTokens[index];
        const value = fromToken.value + (toToken.value - fromToken.value) * progress;
        output += targetText.slice(cursor, toToken.start);
        output += formatToken(value, toToken);
        cursor = toToken.end;
    });
    return output + targetText.slice(cursor);
}

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function AnimatedText({ text }: { text: string }) {
    const [displayText, setDisplayText] = useState(text);
    const previousTextRef = useRef(text);
    const frameRef = useRef<number | null>(null);

    useEffect(() => {
        if (previousTextRef.current === text) return;

        if (frameRef.current !== null) {
            window.cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }

        const fromTokens = parseTokens(previousTextRef.current);
        const toTokens = parseTokens(text);
        previousTextRef.current = text;

        if (
            prefersReducedMotion()
            || fromTokens.length === 0
            || fromTokens.length !== toTokens.length
        ) {
            setDisplayText(text);
            return;
        }

        const startedAt = performance.now();
        const tick = (now: number) => {
            const progress = Math.min(1, (now - startedAt) / NUMBER_ANIMATION_MS);
            const eased = 1 - ((1 - progress) ** 3);
            setDisplayText(renderInterpolatedText(text, fromTokens, toTokens, eased));

            if (progress < 1) {
                frameRef.current = window.requestAnimationFrame(tick);
            } else {
                frameRef.current = null;
                setDisplayText(text);
            }
        };

        frameRef.current = window.requestAnimationFrame(tick);

        return () => {
            if (frameRef.current !== null) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
    }, [text]);

    return <>{displayText}</>;
}

export function AnimatedNumber({
    value,
    format = (nextValue) => String(nextValue),
}: {
    value: number;
    format?: (value: number) => string;
}) {
    return <AnimatedText text={format(value)} />;
}
