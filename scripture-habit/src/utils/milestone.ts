/**
 * milestone.ts
 * Logic for calculating study day milestones (10 days, and every 25 days thereafter: 25, 50, 75, 100, 125, 150...).
 */

export function isStudyMilestone(days: number): boolean {
    if (!days || days <= 0) return false;
    return days === 10 || days % 25 === 0;
}

export function getNextMilestone(currentDays: number): number {
    if (currentDays < 10) return 10;
    return (Math.floor(currentDays / 25) + 1) * 25;
}
