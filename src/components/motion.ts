import { flushSync } from 'react-dom';

/** Shared with the CSS `--motion` transitions, number tweens and chart morphs. */
export const MOTION_MS = 420;

/** easeOutQuint, the curve of the CSS `cubic-bezier(0.22, 1, 0.36, 1)` transitions. */
function ease(progress: number): number {
    return 1 - ((1 - progress) ** 5);
}

export function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type FrameCallback = (now: number) => void;

/**
 * One animation-frame loop for every tween. Updates are flushed together each
 * frame, so all animated numbers, rings and charts commit before the same paint.
 */
const frameCallbacks = new Set<FrameCallback>();
let frameId = 0;

function runFrame(now: number) {
    frameId = 0;
    flushSync(() => {
        frameCallbacks.forEach((callback) => callback(now));
    });
    if (frameCallbacks.size > 0) frameId = requestAnimationFrame(runFrame);
}

function onEveryFrame(callback: FrameCallback): () => void {
    frameCallbacks.add(callback);
    if (!frameId) frameId = requestAnimationFrame(runFrame);
    return () => {
        frameCallbacks.delete(callback);
    };
}

/**
 * Drives `onProgress` with eased 0–1 progress for MOTION_MS, then calls
 * `onDone`. The clock starts when the first frame callback actually runs, not
 * at that frame's timestamp: a heavy render or chart frame earlier in the same
 * frame would otherwise be counted as elapsed time and the tween would jump
 * straight to its end. Returns a function that cancels the tween.
 */
export function startTween(onProgress: (eased: number) => void, onDone: () => void): () => void {
    let startedAt: number | null = null;
    const stop = onEveryFrame((now) => {
        startedAt ??= performance.now();
        const progress = Math.min(1, Math.max(0, now - startedAt) / MOTION_MS);
        if (progress >= 1) {
            stop();
            onDone();
            return;
        }
        onProgress(ease(progress));
    });
    return stop;
}
