import { describe, it, expect } from 'vitest';
import { 
    removeNoteHeader, 
    isGCUrl, 
    extractUrls, 
    calculateNewLevelAndXP 
} from './note-utils';

describe('note-utils', () => {
    describe('removeNoteHeader', () => {
        it('should remove the header', () => {
            expect(removeNoteHeader('**Header**\n\nContent')).toBe('Content');
        });
    });

    describe('isGCUrl', () => {
        it('should return false for undefined or empty', () => {
            expect(isGCUrl(undefined)).toBe(false);
            expect(isGCUrl('')).toBe(false);
        });

        it('should return true for http urls', () => {
            expect(isGCUrl('http://example.com')).toBe(true);
            expect(isGCUrl('https://example.com')).toBe(true);
        });

        it('should return true for GC shortcodes', () => {
            expect(isGCUrl('2024/10/talk-title')).toBe(true);
        });

        it('should return false for other strings', () => {
            expect(isGCUrl('just a string')).toBe(false);
        });
    });

    describe('extractUrls', () => {
        it('should extract urls and clean trailing punctuation', () => {
            expect(extractUrls('Check this out: https://example.com, and this: http://test.com.')).toEqual([
                'https://example.com',
                'http://test.com'
            ]);
        });
        
        it('should return unique urls', () => {
            expect(extractUrls('https://example.com https://example.com')).toEqual(['https://example.com']);
        });

        it('should handle undefined', () => {
            expect(extractUrls(undefined)).toEqual([]);
            expect(extractUrls('no urls here')).toEqual([]);
        });
    });

    describe('calculateNewLevelAndXP', () => {
        it('should calculate XP without bonuses', () => {
            const result = calculateNewLevelAndXP(1, 0, 10, false, 0);
            expect(result.xpGain).toBe(15); // 10 * 1.5
            expect(result.newLevel).toBe(1);
            expect(result.newXP).toBe(15);
        });

        it('should add daily bonus', () => {
            const result = calculateNewLevelAndXP(1, 0, 10, true, 0);
            expect(result.xpGain).toBe(35); // 15 + 20
        });

        it('should add weekly streak bonus', () => {
            const result = calculateNewLevelAndXP(1, 0, 10, true, 7);
            expect(result.xpGain).toBe(85); // 15 + 20 + 50
        });

        it('should level up when XP exceeds threshold', () => {
            const result = calculateNewLevelAndXP(1, 90, 10, false, 0);
            // newXP = 90 + 15 = 105
            // 105 >= 100, level up!
            // remaining XP = 105 - 100 = 5
            expect(result.newLevel).toBe(2);
            expect(result.newXP).toBe(5);
        });

        it('should handle multiple level ups', () => {
            const result = calculateNewLevelAndXP(1, 0, 200, false, 0);
            // xpGain = 300
            // Level 1 -> requires 100 (rem 200) -> Level 2
            // Level 2 -> requires 200 (rem 0) -> Level 3
            expect(result.newLevel).toBe(3);
            expect(result.newXP).toBe(0);
        });
    });
});
