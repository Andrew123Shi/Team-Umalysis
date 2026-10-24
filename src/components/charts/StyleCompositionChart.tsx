import { memo, useMemo } from 'react';
import type { StyleComposition } from '../../analytics/types';
import { STYLE_SATURATION_COLORS } from '../../analytics/styleSaturation';
import AssetLoader from '../../data/AssetLoader';
import CompareGrid, { type CompareColumn, type CompareRow } from './CompareGrid';

/** Runaway has no style icon in game, so it borrows the Runaway skill's icon. */
const RUNAWAY_SKILL_ICON = AssetLoader.getSkillIcon(40012, 'Green');

const STYLES = [
    { key: 'runaway', label: 'Runaway', icon: RUNAWAY_SKILL_ICON, color: STYLE_SATURATION_COLORS[5] },
    { key: 'front', label: 'Front', icon: AssetLoader.getStatIcon('front'), color: STYLE_SATURATION_COLORS[1] },
    { key: 'pace', label: 'Pace', icon: AssetLoader.getStatIcon('pace'), color: STYLE_SATURATION_COLORS[2] },
    { key: 'late', label: 'Late', icon: AssetLoader.getStatIcon('late'), color: STYLE_SATURATION_COLORS[3] },
    { key: 'end', label: 'End', icon: AssetLoader.getStatIcon('end'), color: STYLE_SATURATION_COLORS[4] },
] as const;

type Group = {
    key: string;
    title: string;
    share: StyleComposition;
    avgCount?: StyleComposition;
};

function pct(fraction: number): string {
    return `${(fraction * 100).toFixed(1)}%`;
}

/** Shared scale: the largest share across all groups, rounded up to the next 10%. */
function shareScale(groups: Group[]): number {
    const peak = Math.max(...groups.flatMap((group) => STYLES.map((style) => group.share[style.key])), 0);
    return Math.max(0.1, Math.ceil(peak * 10) / 10);
}

function StyleCompositionChart({
    opponent,
    opponentAvgCount,
    npcPercent,
    npcAvgCount,
    roomPercent,
    roomAvgCount,
}: {
    opponent: StyleComposition;
    opponentAvgCount: StyleComposition;
    npcPercent: StyleComposition;
    npcAvgCount: StyleComposition;
    roomPercent: StyleComposition;
    roomAvgCount: StyleComposition;
}) {
    const { columns, rows } = useMemo(() => {
        const groups: Group[] = [
            { key: 'opponent', title: 'Opponent Team', share: opponent, avgCount: opponentAvgCount },
            { key: 'npc', title: 'NPCs', share: npcPercent, avgCount: npcAvgCount },
            { key: 'room', title: 'Full Field', share: roomPercent, avgCount: roomAvgCount },
        ];
        const scaleMax = shareScale(groups);
        const gridColumns: CompareColumn[] = groups.map((group) => ({
            key: group.key,
            title: group.title,
            strip: STYLES.map((style) => ({ label: style.label, value: group.share[style.key], color: style.color })),
        }));
        const gridRows: CompareRow[] = STYLES.map((style) => ({
            key: style.key,
            label: style.label,
            icon: style.icon,
            color: style.color,
            cells: groups.map((group) => {
                const share = group.share[style.key];
                const count = group.avgCount?.[style.key];
                return {
                    fraction: share / scaleMax,
                    value: pct(share),
                    sub: count !== undefined ? `${count.toFixed(2)} avg` : undefined,
                    tip: {
                        head: `${group.title} · ${style.label}`,
                        color: style.color,
                        rows: [
                            { label: 'Share', value: pct(share) },
                            ...(count !== undefined ? [{ label: 'Per Race', value: count.toFixed(2) }] : []),
                        ],
                    },
                };
            }),
        }));
        return { columns: gridColumns, rows: gridRows };
    }, [opponent, opponentAvgCount, npcPercent, npcAvgCount, roomPercent, roomAvgCount]);

    return <CompareGrid columns={columns} rows={rows} />;
}

export default memo(StyleCompositionChart);
