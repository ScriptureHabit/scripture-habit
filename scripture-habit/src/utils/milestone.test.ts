import { describe, it, expect } from 'vitest';
import { isStudyMilestone, getNextMilestone } from './milestone';

describe('milestone utilities', () => {
    describe('isStudyMilestone', () => {
        it('should recognize 10 days as the first milestone', () => {
            expect(isStudyMilestone(10)).toBe(true);
        });

        it('should recognize multiples of 25 as milestones', () => {
            expect(isStudyMilestone(25)).toBe(true);
            expect(isStudyMilestone(50)).toBe(true);
            expect(isStudyMilestone(75)).toBe(true);
            expect(isStudyMilestone(100)).toBe(true);
            expect(isStudyMilestone(125)).toBe(true);
            expect(isStudyMilestone(200)).toBe(true);
            expect(isStudyMilestone(500)).toBe(true);
        });

        it('should return false for non-milestone numbers', () => {
            expect(isStudyMilestone(0)).toBe(false);
            expect(isStudyMilestone(1)).toBe(false);
            expect(isStudyMilestone(9)).toBe(false);
            expect(isStudyMilestone(11)).toBe(false);
            expect(isStudyMilestone(24)).toBe(false);
            expect(isStudyMilestone(26)).toBe(false);
            expect(isStudyMilestone(49)).toBe(false);
            expect(isStudyMilestone(99)).toBe(false);
        });
    });

    describe('getNextMilestone', () => {
        it('should return 10 for days less than 10', () => {
            expect(getNextMilestone(0)).toBe(10);
            expect(getNextMilestone(5)).toBe(10);
            expect(getNextMilestone(9)).toBe(10);
        });

        it('should return 25 for days between 10 and 24', () => {
            expect(getNextMilestone(10)).toBe(25);
            expect(getNextMilestone(15)).toBe(25);
            expect(getNextMilestone(24)).toBe(25);
        });

        it('should return next 25-multiple after that', () => {
            expect(getNextMilestone(25)).toBe(50);
            expect(getNextMilestone(49)).toBe(50);
            expect(getNextMilestone(50)).toBe(75);
            expect(getNextMilestone(100)).toBe(125);
        });
    });
});
