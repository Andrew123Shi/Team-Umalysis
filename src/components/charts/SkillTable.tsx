import { memo, useMemo, useState } from 'react';
import AssetLoader from '../../data/AssetLoader';
import UMDatabaseWrapper from '../../data/UMDatabaseWrapper';
import BarTable, { type BarColumn, type BarRow, type SortDir } from './BarTable';
import type { SkillFrequencyEntry } from '../../analytics/types';
import {
    getSkillIconFolderByIconId,
    type SkillIconFolder,
} from '../../utils/profileSkillUtils';

type SkillMode = 'player' | 'opponent';
type ValueKey = 'count' | 'activationRate';
type SortKey = 'skillName' | ValueKey;

function sortSkills(
    skills: SkillFrequencyEntry[],
    sortKey: SortKey,
    sortDir: SortDir,
    mode: SkillMode,
): SkillFrequencyEntry[] {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...skills].sort((a, b) => {
        if (sortKey === 'skillName') {
            return a.skillName.localeCompare(b.skillName) * dir;
        }
        if (sortKey === 'activationRate') {
            return (a.activationRate - b.activationRate) * dir;
        }
        const aVal = mode === 'opponent' ? a.prevalenceRate : a.activated;
        const bVal = mode === 'opponent' ? b.prevalenceRate : b.activated;
        return (aVal - bVal) * dir;
    });
}

function skillAccentClass(folder: SkillIconFolder | undefined): string {
    switch (folder) {
        case 'Blue': return 'skill-recovery';
        case 'Green': return 'skill-green';
        case 'Red': return 'skill-debuff';
        case 'Rainbow': return 'skill-unique';
        case 'Purple': return 'skill-purple';
        case 'Grey': return 'skill-grey';
        case 'Yellow':
        default: return 'skill-yellow';
    }
}

function SkillTable({
    title,
    skills,
    mode,
}: {
    title: string;
    skills: SkillFrequencyEntry[];
    mode: SkillMode;
}) {
    const [sortKey, setSortKey] = useState<SortKey>('count');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const sorted = useMemo(
        () => sortSkills(skills, sortKey, sortDir, mode),
        [skills, sortKey, sortDir, mode],
    );
    const visible = sorted;
    const countLabel = mode === 'opponent' ? 'Prevalence' : 'Count';
    const metricValue = (skill: SkillFrequencyEntry) => {
        if (sortKey === 'activationRate') return Math.max(0, skill.activationRate);
        if (sortKey === 'count') return Math.max(0, mode === 'opponent' ? skill.prevalenceRate : skill.activated);
        return Math.max(0, mode === 'opponent' ? skill.prevalenceRate : skill.activated);
    };
    const maxBarValue = Math.max(1, ...visible.map(metricValue));

    const columns = useMemo<BarColumn<ValueKey>[]>(() => (
        mode === 'player'
            ? [
                { key: 'count', label: countLabel, title: 'Activated / Learned' },
                { key: 'activationRate', label: 'Act %', title: 'Activation Rate' },
            ]
            : [{ key: 'count', label: countLabel, title: 'Share of Opponents with This Skill' }]
    ), [mode, countLabel]);

    const rows: BarRow<ValueKey>[] = visible.map((s) => {
        const skill = UMDatabaseWrapper.skills[s.skillId];
        const iconId = skill?.iconId ?? 0;
        const iconFolder = getSkillIconFolderByIconId(iconId);
        return {
            key: String(s.skillId),
            label: s.skillName,
            iconSrc: iconId > 0 ? AssetLoader.getSkillIcon(iconId, iconFolder) : undefined,
            values: {
                count: mode === 'opponent'
                    ? `${(s.prevalenceRate * 100).toFixed(1)}%`
                    : `${s.activated}/${s.learned}`,
                activationRate: `${(s.activationRate * 100).toFixed(1)}%`,
            },
            barPct: (metricValue(s) / maxBarValue) * 100,
            barClassName: skillAccentClass(iconFolder),
        };
    });

    return (
        <BarTable
            title={title}
            nameColumn={{ key: 'skillName', label: 'Skill' }}
            columns={columns}
            rows={rows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
        />
    );
}

export default memo(SkillTable);
