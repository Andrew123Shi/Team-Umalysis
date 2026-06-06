import type { CSSProperties } from 'react';

export interface CareerRatingBadge {
    threshold: number;
    label: string;
    sprite: { col: number; row: number };
}

export const CAREER_RATING_BADGES: CareerRatingBadge[] = [
    { threshold: 300, label: 'G', sprite: { col: 0, row: 0 } },
    { threshold: 600, label: 'G+', sprite: { col: 0, row: 1 } },
    { threshold: 900, label: 'F', sprite: { col: 0, row: 2 } },
    { threshold: 1300, label: 'F+', sprite: { col: 0, row: 3 } },
    { threshold: 1800, label: 'E', sprite: { col: 0, row: 4 } },
    { threshold: 2300, label: 'E+', sprite: { col: 0, row: 5 } },
    { threshold: 2900, label: 'D', sprite: { col: 1, row: 0 } },
    { threshold: 3500, label: 'D+', sprite: { col: 1, row: 1 } },
    { threshold: 4900, label: 'C', sprite: { col: 1, row: 2 } },
    { threshold: 6500, label: 'C+', sprite: { col: 1, row: 3 } },
    { threshold: 8200, label: 'B', sprite: { col: 1, row: 4 } },
    { threshold: 10000, label: 'B+', sprite: { col: 1, row: 5 } },
    { threshold: 12100, label: 'A', sprite: { col: 2, row: 0 } },
    { threshold: 14500, label: 'A+', sprite: { col: 2, row: 1 } },
    { threshold: 15900, label: 'S', sprite: { col: 2, row: 2 } },
    { threshold: 17500, label: 'S+', sprite: { col: 2, row: 3 } },
    { threshold: 19200, label: 'SS', sprite: { col: 2, row: 4 } },
    { threshold: 19600, label: 'SS+', sprite: { col: 2, row: 5 } },
    { threshold: 20000, label: 'UG', sprite: { col: 3, row: 0 } },
    { threshold: 20400, label: 'UG1', sprite: { col: 3, row: 1 } },
    { threshold: 20800, label: 'UG2', sprite: { col: 3, row: 2 } },
    { threshold: 21200, label: 'UG3', sprite: { col: 3, row: 3 } },
    { threshold: 21600, label: 'UG4', sprite: { col: 3, row: 4 } },
    { threshold: 22100, label: 'UG5', sprite: { col: 3, row: 5 } },
    { threshold: 22500, label: 'UG6', sprite: { col: 4, row: 0 } },
    { threshold: 23000, label: 'UG7', sprite: { col: 4, row: 1 } },
    { threshold: 23400, label: 'UG8', sprite: { col: 4, row: 2 } },
    { threshold: 23900, label: 'UG9', sprite: { col: 4, row: 3 } },
    { threshold: 24300, label: 'UF', sprite: { col: 4, row: 4 } },
    { threshold: 24800, label: 'UF1', sprite: { col: 4, row: 5 } },
    { threshold: 25300, label: 'UF2', sprite: { col: 5, row: 0 } },
    { threshold: 25800, label: 'UF3', sprite: { col: 5, row: 1 } },
    { threshold: 26300, label: 'UF4', sprite: { col: 5, row: 2 } },
    { threshold: 26800, label: 'UF5', sprite: { col: 5, row: 3 } },
    { threshold: 27300, label: 'UF6', sprite: { col: 5, row: 4 } },
    { threshold: 27800, label: 'UF7', sprite: { col: 5, row: 5 } },
    { threshold: Infinity, label: 'UF7', sprite: { col: 5, row: 5 } },
];

export const BADGE_SPRITE_SIZE = 96;
export const BADGE_SHEET_SIZE = 576;

const RANK_BADGE_SHEET_URL = `${import.meta.env.BASE_URL}assets/textures/uma_ranks/rank_badges.png`;

export function getCareerRatingBadge(score: number): CareerRatingBadge {
    for (const badge of CAREER_RATING_BADGES) {
        if (score < badge.threshold) return badge;
    }
    return CAREER_RATING_BADGES[CAREER_RATING_BADGES.length - 1];
}

export function getCareerRatingBadgeStyle(
    badge: CareerRatingBadge,
    options?: { size?: number; sheetUrl?: string },
): CSSProperties {
    const size = options?.size ?? BADGE_SPRITE_SIZE;
    const scale = size / BADGE_SPRITE_SIZE;
    const sheetUrl = options?.sheetUrl ?? RANK_BADGE_SHEET_URL;

    return {
        width: size,
        height: size,
        display: 'inline-block',
        backgroundImage: `url(${sheetUrl})`,
        backgroundSize: `${BADGE_SHEET_SIZE * scale}px ${BADGE_SHEET_SIZE * scale}px`,
        backgroundPosition: `-${badge.sprite.col * size}px -${badge.sprite.row * size}px`,
        backgroundRepeat: 'no-repeat',
        flexShrink: 0,
    };
}
