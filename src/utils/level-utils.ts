/**
 * level-utils.ts
 * Utility functions for habit levels, level-up calculations, and visual tiers.
 */

export function calculateLevel(daysStudied: number = 0): number {
    if (daysStudied <= 0) return 1;
    return Math.floor(daysStudied / 7) + 1;
}

export function isLevelUpDay(daysStudied: number = 0): boolean {
    return daysStudied > 0 && daysStudied % 7 === 0;
}

export function getDaysInCurrentLevel(daysStudied: number = 0): number {
    return daysStudied % 7;
}

export function getDaysToNextLevel(daysStudied: number = 0): number {
    const remainder = daysStudied % 7;
    return remainder === 0 ? 7 : 7 - remainder;
}

export type LevelTier = 'bronze' | 'silver' | 'gold' | 'emerald' | 'diamond' | 'master';

export function getLevelTier(level: number): LevelTier {
    if (level <= 1) return 'bronze';
    if (level <= 4) return 'silver';
    if (level <= 9) return 'gold';
    if (level <= 19) return 'emerald';
    if (level <= 49) return 'diamond';
    return 'master';
}
