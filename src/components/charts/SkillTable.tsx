import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import AssetLoader from '../../data/AssetLoader';
import UMDatabaseWrapper from '../../data/UMDatabaseWrapper';
import { AnimatedText } from '../AnimatedNumber';
import SectionHeading from '../SectionHeading';
import type { SkillFrequencyEntry } from '../../analytics/types';

type SkillMode = 'player' | 'opponent';
type SortKey = 'skillName' | 'count' | 'activationRate';
type SortDir = 'asc' | 'desc';

type SkillIconFolder = 'Blue' | 'Green' | 'Grey' | 'Purple' | 'Rainbow' | 'Red' | 'Yellow';

const SKILL_ICON_FOLDER_BY_ID: Record<number, SkillIconFolder> = {
    20021: 'Blue', 20022: 'Blue', 20031: 'Blue', 20032: 'Blue', 20111: 'Blue', 20112: 'Blue',
    10011: 'Green', 10012: 'Green', 10013: 'Green', 10021: 'Green', 10022: 'Green', 10023: 'Green',
    10031: 'Green', 10032: 'Green', 10033: 'Green', 10041: 'Green', 10042: 'Green', 10043: 'Green',
    10051: 'Green', 10052: 'Green', 10053: 'Green', 10061: 'Green', 10062: 'Green', 10063: 'Green',
    40012: 'Green',
    30013: 'Grey', 30023: 'Grey', 30033: 'Grey', 30043: 'Grey',
    10014: 'Purple', 10024: 'Purple', 10034: 'Purple', 10044: 'Purple', 10054: 'Purple',
    20014: 'Purple', 20024: 'Purple', 20034: 'Purple', 20044: 'Purple', 20064: 'Purple', 20094: 'Purple',
    20013: 'Rainbow', 20023: 'Rainbow', 20033: 'Rainbow', 20043: 'Rainbow',
    30011: 'Red', 30012: 'Red', 30021: 'Red', 30022: 'Red', 30031: 'Red', 30032: 'Red',
    30041: 'Red', 30042: 'Red', 30051: 'Red', 30052: 'Red', 30053: 'Red', 30061: 'Red',
    30062: 'Red', 30071: 'Red', 30072: 'Red',
    20011: 'Yellow', 20012: 'Yellow', 20041: 'Yellow', 20042: 'Yellow', 20051: 'Yellow', 20052: 'Yellow',
    20053: 'Yellow', 20061: 'Yellow', 20062: 'Yellow', 20063: 'Yellow', 20071: 'Yellow', 20072: 'Yellow',
    20073: 'Yellow', 20081: 'Yellow', 20082: 'Yellow', 20083: 'Yellow', 20091: 'Yellow', 20092: 'Yellow',
    20101: 'Yellow', 20102: 'Yellow', 20121: 'Yellow', 20122: 'Yellow', 20131: 'Yellow', 20132: 'Yellow',
    20141: 'Yellow', 20142: 'Yellow',
    2010010: 'Yellow',
};

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

function SortButton({
    label,
    sortKey,
    activeKey,
    sortDir,
    onSort,
}: {
    label: string;
    sortKey: SortKey;
    activeKey: SortKey;
    sortDir: SortDir;
    onSort: (key: SortKey) => void;
}) {
    const active = activeKey === sortKey;
    const arrow = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return (
        <button
            type="button"
            onClick={() => onSort(sortKey)}
            className={`bar-sort-button${active ? ' is-active' : ''}`}
        >
            {label}{arrow}
        </button>
    );
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

export default function SkillTable({
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

    return (
        <div className="app-card p-3 mb-4">
            <div className="bar-table-toolbar">
                <SectionHeading title={title} compact />
                <div className="bar-sort-controls">
                    <SortButton label="Skill" sortKey="skillName" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortButton label={countLabel} sortKey="count" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    {mode === 'player' && (
                        <SortButton label="Activation %" sortKey="activationRate" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    )}
                </div>
            </div>
            <div className="bar-list bar-list-scroll">
                {visible.length === 0 && <div className="bar-empty">No data</div>}
                {visible.map((s) => {
                    const skill = UMDatabaseWrapper.skills[s.skillId];
                    const iconId = skill?.iconId ?? 0;
                    const iconFolder = SKILL_ICON_FOLDER_BY_ID[iconId];
                    const width = Math.max(4, Math.min(100, (metricValue(s) / maxBarValue) * 100));
                    const accentClass = skillAccentClass(iconFolder);
                    return (
                        <div key={s.skillId} className="bar-row">
                            <span className={`bar-row-fill ${accentClass}`} style={{ '--bar-width': `${width}%` } as CSSProperties} />
                            <span className="bar-row-content">
                                <span className="bar-row-label">
                                    {iconId > 0 && (
                                        <img src={AssetLoader.getSkillIcon(iconId, iconFolder)} alt="" className="bar-row-icon" />
                                    )}
                                    <span className="bar-row-label-text">{s.skillName}</span>
                                </span>
                                <span className="bar-row-values">
                                    <span className={`bar-chip${sortKey === 'count' ? ' is-active' : ''}`}>
                                        <AnimatedText text={mode === 'opponent'
                                            ? `${(s.prevalenceRate * 100).toFixed(1)}%`
                                            : `${s.activated} / ${s.learned}`}
                                        />
                                    </span>
                                    {mode === 'player' && (
                                        <span className={`bar-chip${sortKey === 'activationRate' ? ' is-active' : ''}`}><AnimatedText text={`${(s.activationRate * 100).toFixed(1)}%`} /></span>
                                    )}
                                </span>
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
