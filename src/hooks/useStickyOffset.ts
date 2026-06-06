import { useEffect, useLayoutEffect } from 'react';

export function useStickyOffset(
    element: HTMLElement | null,
    cssVar: string,
    resetOnUnmount = false,
) {
    useLayoutEffect(() => {
        if (!element) return;

        const update = () => {
            document.documentElement.style.setProperty(cssVar, `${element.offsetHeight}px`);
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [element, cssVar]);

    useEffect(() => {
        return () => {
            if (resetOnUnmount) {
                document.documentElement.style.setProperty(cssVar, '0px');
            }
        };
    }, [cssVar, resetOnUnmount]);
}
