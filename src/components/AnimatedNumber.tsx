import { useLayoutEffect, useRef, useState } from 'react';
import { prefersReducedMotion, startTween } from './motion';

/* --- Numbers inside text ------------------------------------------------- */

const NUMBER_PATTERN = /[+\-−±]?\d[\d,]*(?:\.\d+)?/g;

type NumberToken = {
    value: number;
    start: number;
    end: number;
    decimals: number;
    grouped: boolean;
    /** Explicitly signed ("+12", "−3", "±0"): intermediate values keep a sign. */
    signed: boolean;
};

function parseTokens(text: string): NumberToken[] {
    return Array.from(text.matchAll(NUMBER_PATTERN)).map((match) => {
        const raw = match[0];
        const signChar = /^[+\-−±]/.test(raw) ? raw[0] : '';
        const digits = signChar ? raw.slice(1) : raw;
        const magnitude = Number(digits.replace(/,/g, ''));
        const start = match.index ?? 0;
        return {
            value: signChar === '-' || signChar === '−' ? -magnitude : magnitude,
            start,
            end: start + raw.length,
            decimals: digits.includes('.') ? digits.split('.')[1].length : 0,
            grouped: digits.includes(','),
            signed: signChar === '+' || signChar === '−' || signChar === '±',
        };
    }).filter((token) => Number.isFinite(token.value));
}

function formatToken(value: number, target: NumberToken, grouped: boolean): string {
    const rounded = Number(value.toFixed(target.decimals));
    const magnitude = Math.abs(rounded);
    const digits = grouped
        ? magnitude.toLocaleString(undefined, {
            minimumFractionDigits: target.decimals,
            maximumFractionDigits: target.decimals,
        })
        : magnitude.toFixed(target.decimals);
    if (target.signed) {
        if (rounded > 0) return `+${digits}`;
        if (rounded < 0) return `−${digits}`;
        return `±${digits}`;
    }
    return rounded < 0 ? `-${digits}` : digits;
}

function interpolateText(targetText: string, from: NumberToken[], to: NumberToken[], progress: number): string {
    let output = '';
    let cursor = 0;
    to.forEach((toToken, index) => {
        const fromToken = from[index];
        const value = fromToken.value + (toToken.value - fromToken.value) * progress;
        output += targetText.slice(cursor, toToken.start);
        output += formatToken(value, toToken, toToken.grouped || fromToken.grouped);
        cursor = toToken.end;
    });
    return output + targetText.slice(cursor);
}

/**
 * Whether each animated element is in view (clipped scroll areas count as out
 * of view). Off-screen numbers swap instantly, so a page with hundreds of table
 * values only tweens the ones you can see.
 */
const onScreen = new WeakMap<Element, boolean>();
let visibilityObserver: IntersectionObserver | null = null;

function observeVisibility(element: Element): () => void {
    if (typeof IntersectionObserver === 'undefined') return () => {};
    visibilityObserver ??= new IntersectionObserver((entries) => {
        entries.forEach((entry) => onScreen.set(entry.target, entry.isIntersecting));
    });
    visibilityObserver.observe(element);
    return () => {
        visibilityObserver?.unobserve(element);
        onScreen.delete(element);
    };
}

/**
 * Tweens the numbers inside `text` when it changes, starting from whatever is
 * on screen (so an interrupted tween continues rather than jumping). Text whose
 * numbers don't line up (different count) swaps immediately.
 *
 * Frames write the text node directly instead of re-rendering, and React only
 * ever renders the initial text, so it never overwrites a frame. `<data>` rather
 * than `<span>` keeps the wrapper clear of `span` selectors in the surrounding markup.
 */
export function AnimatedText({ text }: { text: string }) {
    const elementRef = useRef<HTMLDataElement>(null);
    const [initialText] = useState(text);
    const shownRef = useRef(text);

    useLayoutEffect(() => {
        const element = elementRef.current;
        return element ? observeVisibility(element) : undefined;
    }, []);

    useLayoutEffect(() => {
        const element = elementRef.current;
        const fromText = shownRef.current;
        if (!element || fromText === text) return undefined;
        const show = (value: string) => {
            shownRef.current = value;
            const node = element.firstChild;
            if (node && node.nodeType === Node.TEXT_NODE) node.nodeValue = value;
            else element.textContent = value;
        };
        const fromTokens = parseTokens(fromText);
        const toTokens = parseTokens(text);
        if (
            prefersReducedMotion()
            || onScreen.get(element) === false
            || fromTokens.length === 0
            || fromTokens.length !== toTokens.length
        ) {
            show(text);
            return undefined;
        }
        return startTween(
            (progress) => show(interpolateText(text, fromTokens, toTokens, progress)),
            () => show(text),
        );
    }, [text]);

    return <data ref={elementRef} className="tween-text">{initialText}</data>;
}

/* --- Numeric arrays (SVG geometry) ---------------------------------------- */

/** Tweens each value toward `target`; arrays of a different length swap immediately. */
export function useTweenedValues(target: readonly number[]): number[] {
    const [shown, setShown] = useState<number[]>(() => [...target]);
    const shownRef = useRef(shown);
    const targetKey = target.join('|');

    useLayoutEffect(() => {
        const from = shownRef.current;
        const to = targetKey === '' ? [] : targetKey.split('|').map(Number);
        if (from.length === to.length && from.every((value, index) => value === to[index])) return undefined;
        const show = (values: number[]) => {
            shownRef.current = values;
            setShown(values);
        };
        if (prefersReducedMotion() || from.length !== to.length) {
            show(to);
            return undefined;
        }
        return startTween(
            (progress) => show(to.map((value, index) => from[index] + (value - from[index]) * progress)),
            () => show(to),
        );
    }, [targetKey]);

    return shown;
}
