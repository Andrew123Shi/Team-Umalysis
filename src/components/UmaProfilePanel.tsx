import { Card } from 'react-bootstrap';

import type { AptitudeSet, SkillRef, UmaEntry } from '../analytics/types';
import { computeTotalSkillPoints } from '../analytics/skillUtils';
import { STYLE_SATURATION_COLORS } from '../analytics/styleSaturation';
import AssetLoader from '../data/AssetLoader';
import * as UMDatabaseUtils from '../data/UMDatabaseUtils';
import UMDatabaseWrapper from '../data/UMDatabaseWrapper';
import { getSkillDef } from './RaceReplay/utils/SkillDataUtils';
import CareerRatingBadge from './CareerRatingBadge';
import { formatScore } from '../utils/formatScore';
import {
    getProfileSkillIconFolder,
    getProfileSkillRarityClass,
    sortProfileSkills,
} from '../utils/profileSkillUtils';

const STYLE_SHORT_LABELS: Record<number, string> = {
    1: 'Front',
    2: 'Pace',
    3: 'Late',
    4: 'End',
    5: 'Front',
};

const PROFILE_STAT_ITEMS = [
    { key: 'speed' as const, icon: 'speed', alt: 'SPD' },
    { key: 'stamina' as const, icon: 'stamina', alt: 'STA' },
    { key: 'pow' as const, icon: 'power', alt: 'POW' },
    { key: 'guts' as const, icon: 'guts', alt: 'GUT' },
    { key: 'wiz' as const, icon: 'wit', alt: 'WIZ' },
] as const;

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

function StarDisplay({ count }: { count: number }) {
    if (count <= 0) return null;
    const filled = Math.min(count, 5);
    return (
        <span className="uma-roster-sm-stars" aria-label={`${filled} stars`}>
            {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={i < filled ? 'uma-roster-sm-star is-filled' : 'uma-roster-sm-star'}>
                    ★
                </span>
            ))}
        </span>
    );
}

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
    return (
        <span className={`apt-item${active ? ' is-active' : ''}`}>
            <span className="apt-key">{label}</span>
            <AptGradeBadge value={value} />
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

function ProfileStatsBar({
    stats,
    totalSkillPoints,
}: {
    stats: UmaEntry['stats'];
    totalSkillPoints: number;
}) {
    return (
        <div className="uma-roster-sm-stats uma-profile-stats-bar">
            {PROFILE_STAT_ITEMS.map(({ key, icon, alt }) => (
                <div key={key} className="uma-roster-sm-stat">
                    <img src={AssetLoader.getStatIcon(icon)} alt={alt} className="uma-roster-sm-stat-icon" />
                    <span className="uma-roster-sm-stat-value">{stats[key]}</span>
                </div>
            ))}
            <div className="uma-roster-sm-stat">
                <img src={AssetLoader.getStatIcon('hint')} alt="Skill" className="uma-roster-sm-stat-icon" />
                <span className="uma-roster-sm-stat-value">{totalSkillPoints}</span>
            </div>
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
            <span className="skill-level">Lv{level}</span>
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
    const outfitName = UMDatabaseWrapper.cards[cardId]?.name;
    const styleLabel = entry ? STYLE_SHORT_LABELS[entry.runningStyle] ?? 'Pace' : null;
    const styleColor = entry
        ? STYLE_SATURATION_COLORS[entry.runningStyle] ?? STYLE_SATURATION_COLORS[2]
        : STYLE_SATURATION_COLORS[2];
    const totalSkillPoints = entry ? computeTotalSkillPoints(entry.skills) : 0;

    return (
        <Card className="app-card h-100 uma-profile-panel uma-roster-member">
            <Card.Body className="uma-roster-member-body uma-profile-member-body">
                <div className="uma-roster-sm-header uma-profile-sm-header">
                    <img
                        src={AssetLoader.getRacewearIcon(cardId)}
                        alt=""
                        className="uma-roster-sm-avatar uma-profile-sm-avatar"
                    />
                    <div className="uma-roster-sm-info">
                        <div className="uma-roster-sm-name">
                            {outfitName && (
                                <div className="uma-roster-sm-outfit text-truncate">{outfitName}</div>
                            )}
                            <div className="uma-roster-sm-chara-line">
                                <span className="uma-roster-sm-chara text-truncate">{charaName}</span>
                                {entry && <StarDisplay count={entry.starCount} />}
                            </div>
                        </div>
                        {styleLabel && (
                            <div className="uma-roster-sm-tags">
                                <span
                                    className="uma-roster-sm-tag style"
                                    style={{
                                        color: styleColor,
                                        background: `color-mix(in srgb, ${styleColor} 18%, transparent)`,
                                    }}
                                >
                                    {styleLabel}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="uma-roster-sm-rank-block">
                        <CareerRatingBadge score={rankScore} size={56} />
                        <span className="uma-roster-sm-score-value">{formatScore(rankScore)}</span>
                    </div>
                </div>

                <ProfileStatsBar stats={stats} totalSkillPoints={totalSkillPoints} />

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
            </Card.Body>
        </Card>
    );
}
