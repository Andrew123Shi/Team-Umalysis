import { Fragment } from 'react';
import AssetLoader from '../data/AssetLoader';

type StatValues = {
    speed: number;
    stamina: number;
    pow: number;
    guts: number;
    wiz: number;
};

const STAT_KEYS = [
    { key: 'speed' as const, icon: 'speed', alt: 'Speed' },
    { key: 'stamina' as const, icon: 'stamina', alt: 'Stamina' },
    { key: 'pow' as const, icon: 'power', alt: 'Power' },
    { key: 'guts' as const, icon: 'guts', alt: 'Guts' },
    { key: 'wiz' as const, icon: 'wit', alt: 'Wit' },
];

function formatStatValue(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(0);
}

export default function StatDisplay({
    stats,
    className,
    separator = 'dot',
}: {
    stats: StatValues;
    className?: string;
    separator?: 'dot' | 'slash';
}) {
    const divider = separator === 'slash' ? '/' : '·';

    return (
        <span className={`stat-display${className ? ` ${className}` : ''}`}>
            {STAT_KEYS.map(({ key, icon, alt }, index) => (
                <Fragment key={key}>
                    {index > 0 && <span className="stat-display-sep">{divider}</span>}
                    <span className="stat-display-item">
                        <img src={AssetLoader.getStatIcon(icon)} alt={alt} className="stat-display-icon" />
                        <span>{formatStatValue(stats[key])}</span>
                    </span>
                </Fragment>
            ))}
        </span>
    );
}
