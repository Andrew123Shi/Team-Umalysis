import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { DistributionMeta } from '../../analytics/raceConditions';
import type { DistributionSlice } from '../../analytics/types';
import { AnimatedText } from '../AnimatedNumber';
import SectionHeading from '../SectionHeading';
import { pctLabel, ShareRing, type RingSegment } from './WinRatePies';

const FALLBACK_COLOR = '#9ba5b4';

function DistributionPie({
    title,
    slices,
    meta,
    countLabel = 'Races',
    info,
    actions,
    centerKey,
}: {
    title: string;
    slices: DistributionSlice[];
    meta: readonly DistributionMeta[];
    countLabel?: string;
    info?: string;
    actions?: ReactNode;
    /** Slice whose share the ring center shows; defaults to the largest slice. */
    centerKey?: string;
}) {
    const metaByKey = useMemo(
        () => new Map(meta.map((entry) => [entry.key, entry])),
        [meta],
    );
    const largest = slices.reduce<DistributionSlice | null>(
        (best, slice) => (slice.count > (best?.count ?? 0) ? slice : best),
        null,
    );
    const leading = largest && (slices.find((slice) => slice.key === centerKey) ?? largest);
    const segments: RingSegment[] = slices.map((slice) => ({
        label: slice.label,
        value: slice.share * 100,
        color: metaByKey.get(slice.key)?.color ?? FALLBACK_COLOR,
        detail: `${slice.count} ${countLabel.toLowerCase()} · ${pctLabel(slice.winRate)} win`,
    }));

    return (
        <section className="app-card dist-card">
            <SectionHeading title={title} info={info} actions={actions} />
            {leading ? (
                <div className="dist-body">
                    <ShareRing value={pctLabel(leading.share)} caption={leading.label} segments={segments} />
                    <div className="dist-legend" role="table" aria-label={title}>
                        <div className="dist-legend-head" role="row">
                            <span role="columnheader" />
                            <span role="columnheader">Share</span>
                            <span role="columnheader">{countLabel}</span>
                            <span role="columnheader">Win %</span>
                        </div>
                        {slices.filter((slice) => slice.count > 0).map((slice) => {
                            const entry = metaByKey.get(slice.key);
                            return (
                                <div
                                    key={slice.key}
                                    className="dist-legend-row"
                                    role="row"
                                    style={{ '--dist-color': entry?.color ?? FALLBACK_COLOR } as CSSProperties}
                                >
                                    <span className="dist-legend-name" role="cell">
                                        <span className="dist-swatch" aria-hidden="true" />
                                        {entry?.icon && (
                                            <img
                                                src={entry.icon}
                                                alt={entry.iconOnly ? slice.label : ''}
                                                title={entry.iconOnly ? slice.label : undefined}
                                                className={entry.iconOnly ? 'dist-badge' : 'dist-icon'}
                                            />
                                        )}
                                        {!entry?.iconOnly && <span className="dist-legend-label">{slice.label}</span>}
                                    </span>
                                    <strong role="cell"><AnimatedText text={pctLabel(slice.share)} /></strong>
                                    <span role="cell"><AnimatedText text={String(slice.count)} /></span>
                                    <span role="cell"><AnimatedText text={pctLabel(slice.winRate)} /></span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="empty-note">Not enough data</div>
            )}
        </section>
    );
}

export default memo(DistributionPie);
