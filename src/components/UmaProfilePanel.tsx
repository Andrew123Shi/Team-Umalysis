import type { AptitudeSet, SkillRef, UmaEntry } from '../analytics/types';
import { computeTotalSkillPoints } from '../analytics/skillUtils';
import AssetLoader from '../data/AssetLoader';
import * as UMDatabaseUtils from '../data/UMDatabaseUtils';
import { getSkillDef } from './RaceReplay/utils/SkillDataUtils';
import { StatStrip, UmaIdentity } from './UmaCardParts';
import {
    getProfileSkillIconFolder,
    getProfileSkillRarityClass,
    isMainUniqueSkill,
    sortProfileSkills,
} from '../utils/profileSkillUtils';

const TRACK_APTITUDES = [
    { key: 'turf' as const, label: 'Turf' },
    { key: 'dirt' as const, label: 'Dirt' },
] as const;

const DIST_APTITUDES = [
    { key: 'short' as const, label: 'Sprint' },
    { key: 'mile' as const, label: 'Mile' },
    { key: 'middle' as const, label: 'Medium' },
    { key: 'long' as const, label: 'Long' },
] as const;

const STYLE_APTITUDES = [
    { key: 'nige' as const, label: 'Front', runningStyle: 1 },
    { key: 'senko' as const, label: 'Pace', runningStyle: 2 },
    { key: 'sashi' as const, label: 'Late', runningStyle: 3 },
    { key: 'oikomi' as const, label: 'End', runningStyle: 4 },
] as const;

function AptGradeBadge({ value }: { value: number }) {
    const label = UMDatabaseUtils.charaProperLabels[value];
    if (!label) return <span className="apt-grade-badge grade-G">—</span>;
    const src = AssetLoader.getGradeIcon(label);
    if (src) {
        return <img src={src} alt={label} className="apt-rank-icon" />;
    }
    return <span className={`apt-grade-badge grade-${label}`}>{label}</span>;
}

function AptitudeItem({
    label,
    value,
    active,
}: {
    label: string;
    value: number;
    active: boolean;
}) {
    const isS = UMDatabaseUtils.charaProperLabels[value] === 'S';
    return (
        <span className={`apt-item${active ? ' is-active' : ''}${active && isS ? ' is-s' : ''}`}>
            <AptGradeBadge value={value} />
            <span className="apt-key">{label}</span>
        </span>
    );
}

function AptitudeGrid({
    aptitudes,
    distanceType,
    runningStyle,
}: {
    aptitudes: AptitudeSet;
    distanceType: number;
    runningStyle: number;
}) {
    const activeTrack = distanceType === 5 ? 'dirt' : 'turf';
    const activeDistance = ({ 1: 'short', 2: 'mile', 3: 'middle', 4: 'long' } as const)[distanceType];
    const normalizedStyle = runningStyle === 5 ? 1 : runningStyle;

    return (
        <div className="uma-profile-aptitudes">
            <span className="apt-row-label">Track</span>
            {TRACK_APTITUDES.map(({ key, label }) => (
                <AptitudeItem
                    key={key}
                    label={label}
                    value={aptitudes[key]}
                    active={key === activeTrack}
                />
            ))}
            <span />
            <span />

            <span className="apt-row-label">Dist</span>
            {DIST_APTITUDES.map(({ key, label }) => (
                <AptitudeItem
                    key={key}
                    label={label}
                    value={aptitudes[key]}
                    active={key === activeDistance}
                />
            ))}

            <span className="apt-row-label">Style</span>
            {STYLE_APTITUDES.map(({ key, label, runningStyle: style }) => (
                <AptitudeItem
                    key={key}
                    label={label}
                    value={aptitudes[key]}
                    active={style === normalizedStyle}
                />
            ))}
        </div>
    );
}

function ProfileSkillChip({ skillId, level }: SkillRef) {
    const skill = getSkillDef(skillId);
    const name = skill?.name ?? `Skill ${skillId}`;
    const iconId = skill?.iconId ?? 0;
    const iconFolder = getProfileSkillIconFolder(skillId);
    const rarityClass = getProfileSkillRarityClass(skillId);

    return (
        <span className={`skill-chip skill-chip--compact${rarityClass ? ` ${rarityClass}` : ''}`}>
            {iconId > 0 && (
                <span className="skill-icon-frame">
                    <img
                        src={AssetLoader.getSkillIcon(iconId, iconFolder)}
                        alt=""
                        className="skill-icon"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                </span>
            )}
            <span className="skill-name">{name}</span>
            {isMainUniqueSkill(skillId) && <span className="skill-level">Lv{level}</span>}
        </span>
    );
}

function SkillList({ skills }: { skills: UmaEntry['skills'] }) {
    const seen = new Set<number>();
    const unique = skills.filter(({ skillId }) => {
        if (seen.has(skillId)) return false;
        seen.add(skillId);
        return true;
    });
    const sorted = sortProfileSkills(unique);

    if (sorted.length === 0) {
        return <div className="small text-muted">No skills recorded</div>;
    }

    return (
        <div className="uma-profile-skills">
            {sorted.map((skill) => (
                <ProfileSkillChip key={skill.skillId} {...skill} />
            ))}
        </div>
    );
}

export default function UmaProfilePanel({
    charaName,
    cardId,
    rankScore,
    stats,
    distanceType,
    entry,
}: {
    charaName: string;
    cardId: number;
    rankScore: number;
    stats: UmaEntry['stats'];
    distanceType: number;
    entry: UmaEntry | null;
}) {
    const totalSkillPoints = entry ? computeTotalSkillPoints(entry.skills) : undefined;

    return (
        <section className="app-card uma-profile-panel">
            <UmaIdentity
                cardId={cardId}
                charaName={charaName}
                rankScore={rankScore}
                starCount={entry?.starCount}
                runningStyle={entry?.runningStyle}
                badgeSize={56}
                size="lg"
            />
            <StatStrip stats={stats} totalSkillPoints={totalSkillPoints} />
            {entry && (
                <>
                    <AptitudeGrid
                        aptitudes={entry.aptitudes}
                        distanceType={distanceType}
                        runningStyle={entry.runningStyle}
                    />
                    <SkillList skills={entry.skills} />
                </>
            )}
        </section>
    );
}
