import { useCallback, useEffect, useRef, useState } from 'react';
import { DISTANCE_LABELS, DISTANCE_ORDER } from '../analytics/types';

export default function DistanceJumpNav({
    onActiveDistanceChange,
}: {
    onActiveDistanceChange?: (distanceType: number) => void;
}) {
    const [activeDistance, setActiveDistance] = useState<number>(DISTANCE_ORDER[0]);
    const activeDistanceRef = useRef<number>(DISTANCE_ORDER[0]);
    const suppressObserverRef = useRef(false);

    const updateActiveDistance = useCallback((distanceType: number) => {
        if (activeDistanceRef.current === distanceType) return;
        activeDistanceRef.current = distanceType;
        setActiveDistance(distanceType);
        onActiveDistanceChange?.(distanceType);
    }, [onActiveDistanceChange]);

    useEffect(() => {
        const sections = DISTANCE_ORDER.map((id) => document.getElementById(`distance-${id}`));
        const observer = new IntersectionObserver(
            (entries) => {
                if (suppressObserverRef.current) return;
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (!visible?.target.id) return;
                const id = Number(visible.target.id.replace('distance-', ''));
                if (Number.isFinite(id)) updateActiveDistance(id);
            },
            { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] },
        );
        sections.forEach((el) => { if (el) observer.observe(el); });
        return () => observer.disconnect();
    }, [updateActiveDistance]);

    const scrollTo = (distanceType: number) => {
        suppressObserverRef.current = true;
        document.getElementById(`distance-${distanceType}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
        updateActiveDistance(distanceType);
        window.setTimeout(() => {
            suppressObserverRef.current = false;
        }, 150);
    };

    return (
        <nav className="distance-jump-nav" aria-label="Jump to distance">
            {DISTANCE_ORDER.map((distanceType) => (
                <button
                    key={distanceType}
                    type="button"
                    className={`distance-jump-link${activeDistance === distanceType ? ' is-active' : ''}`}
                    aria-current={activeDistance === distanceType ? 'true' : undefined}
                    onClick={() => scrollTo(distanceType)}
                >
                    {DISTANCE_LABELS[distanceType]}
                </button>
            ))}
        </nav>
    );
}
