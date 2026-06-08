import type { SkillRef } from './types';
import UMDatabaseWrapper from '../data/UMDatabaseWrapper';

export type SkillRarityCategory = 'regular' | 'gold' | 'unique';

export function getSkillRarityCategory(skillId: number): SkillRarityCategory {
    const rarity = UMDatabaseWrapper.skills[skillId]?.rarity;
    if (rarity === 2) return 'gold';
    if (rarity === 4 || rarity === 5) return 'unique';
    return 'regular';
}

export function isGoldSkill(skillId: number): boolean {
    return getSkillRarityCategory(skillId) === 'gold';
}

export function isUniqueSkill(skillId: number): boolean {
    return getSkillRarityCategory(skillId) === 'unique';
}

function skillPointCost(skillId: number): number {
    const base = UMDatabaseWrapper.skillNeedPoints[skillId] ?? 0;
    let upgrade = 0;
    if (UMDatabaseWrapper.skills[skillId]?.rarity === 2) {
        const lastDigit = skillId % 10;
        const flippedId = lastDigit === 1 ? skillId + 1 : skillId - 1;
        upgrade = UMDatabaseWrapper.skillNeedPoints[flippedId] ?? 0;
    } else if (UMDatabaseWrapper.skills[skillId]?.rarity === 1 && skillId % 10 === 1) {
        const pairedId = skillId + 1;
        if (UMDatabaseWrapper.skills[pairedId]?.rarity === 1) {
            upgrade = UMDatabaseWrapper.skillNeedPoints[pairedId] ?? 0;
        }
    }
    return base + upgrade;
}

export function computeTotalSkillPoints(skills: SkillRef[]): number {
    return skills.reduce((sum, { skillId }) => sum + skillPointCost(skillId), 0);
}
