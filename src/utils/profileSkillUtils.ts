import type { SkillRef } from '../analytics/types';
import type { Skill } from '../data/data_pb';
import { getSkillDef } from '../components/RaceReplay/utils/SkillDataUtils';

export type SkillIconFolder = 'Blue' | 'Green' | 'Grey' | 'Purple' | 'Rainbow' | 'Red' | 'Yellow';

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

function isInheritedSkill(skillId: number): boolean {
    return skillId >= 900000 && skillId < 1000000;
}

function hasUniqueFlag(skillId: number, skill: Skill): boolean {
    return skill.rarity === 4 || skill.rarity === 5 || isInheritedSkill(skillId);
}

function getSkillText(skill: Skill): string {
    const effectTypes = skill.conditionGroups
        .flatMap((group) => group.effects.map((effect) => effect.type))
        .join(' ');
    return `${skill.name} ${skill.tagId.join(' ')} ${effectTypes}`.toLowerCase();
}

function getSkillTypeRank(skill: Skill): number {
    const text = getSkillText(skill);
    if (/speed down|decrease(?:s|d)? .*speed|lower(?:s|ed)? .*speed|slow(?:s|ed)?|hesitat|intimidat|disorient|drain|debuff|fatigue.*(?:opponent|enemy|rival)|(?:opponent|enemy|rival).*fatigue/.test(text)) {
        return 2;
    }
    if (/stamina recovery|recover(?:s|ed)? stamina|recover endurance|restore(?:s|d)? stamina|regain|decrease fatigue|reduce fatigue|harder to tire/.test(text)) {
        return 1;
    }
    if (/speed|velocity|target speed|current speed/.test(text) || skill.tagId.includes('401')) {
        return 0;
    }
    return 3;
}

function getSkillSortBucket(skillId: number): number {
    const skill = getSkillDef(skillId);
    if (!skill) return 99;

    if (hasUniqueFlag(skillId, skill)) {
        return isInheritedSkill(skillId) ? 1 : 0;
    }

    const typeRank = getSkillTypeRank(skill);
    if (skill.rarity === 2) return 2 + typeRank;
    return 6 + typeRank;
}

export function sortProfileSkills(skills: SkillRef[]): SkillRef[] {
    return skills
        .map((skill, index) => ({ skill, index }))
        .sort((a, b) => {
            const bucketDiff = getSkillSortBucket(a.skill.skillId) - getSkillSortBucket(b.skill.skillId);
            return bucketDiff !== 0 ? bucketDiff : a.index - b.index;
        })
        .map((entry) => entry.skill);
}

export function getProfileSkillRarityClass(skillId: number): string {
    const skill = getSkillDef(skillId);
    if (!skill) return '';

    if (hasUniqueFlag(skillId, skill)) {
        return isInheritedSkill(skillId)
            ? 'rarity-unique-inherited'
            : 'rarity-gold rarity-unique-main';
    }
    if (skill.rarity === 2) return 'rarity-gold';
    return '';
}

export function getSkillIconFolderByIconId(iconId: number): SkillIconFolder | undefined {
    return SKILL_ICON_FOLDER_BY_ID[iconId];
}

export function getProfileSkillIconFolder(skillId: number): SkillIconFolder | undefined {
    const iconId = getSkillDef(skillId)?.iconId ?? 0;
    return iconId > 0 ? getSkillIconFolderByIconId(iconId) : undefined;
}
