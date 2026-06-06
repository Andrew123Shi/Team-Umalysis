import { useEffect, useRef, useState } from 'react';
import { Nav } from 'react-bootstrap';
import { DISTANCE_LABELS, DISTANCE_ORDER } from '../analytics/types';

export default function DistanceJumpNav() {
    const [activeDistance, setActiveDistance] = useState<number>(DISTANCE_ORDER[0]);
    const suppressObserverRef = useRef(false);

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
                if (Number.isFinite(id)) setActiveDistance(id);
            },
            { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] },
        );
        sections.forEach((el) => { if (el) observer.observe(el); });
        return () => observer.disconnect();
    }, []);

    const scrollTo = (distanceType: number) => {
        suppressObserverRef.current = true;
        document.getElementById(`distance-${distanceType}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
        setActiveDistance(distanceType);
        window.setTimeout(() => {
            suppressObserverRef.current = false;
        }, 150);
    };

    return (
        <Nav className="flex-column distance-jump-nav">
            {DISTANCE_ORDER.map((distanceType) => (
                <Nav.Link
                    key={distanceType}
                    active={activeDistance === distanceType}
                    onClick={() => scrollTo(distanceType)}
                    className="mb-1 px-2 py-1"
                >
                    {DISTANCE_LABELS[distanceType]}
                </Nav.Link>
            ))}
        </Nav>
    );
}
