import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { 
    removeNoteHeader, 
    isGCUrl, 
    extractUrls, 
    calculateNewLevelAndXP, 
    isToday, 
    isYesterday, 
    getCategoryFromScripture 
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

    describe('isToday and isYesterday', () => {
        let originalDate: any;
        
        beforeEach(() => {
            originalDate = global.Date;
            const fixedDate = new Date('2023-05-15T12:00:00Z');
            global.Date = class extends Date {
                constructor(value?: any) {
                    if (arguments.length > 0) {
                        super(value);
                    } else {
                        super(fixedDate);
                    }
                }
            } as any;
        });

        afterEach(() => {
            global.Date = originalDate;
        });

        it('isToday should identify today', () => {
            const today = new Date('2023-05-15T08:00:00Z');
            const tomorrow = new Date('2023-05-16T08:00:00Z');
            expect(isToday(today, 'UTC')).toBe(true);
            expect(isToday(tomorrow, 'UTC')).toBe(false);
        });

        it('isYesterday should identify yesterday', () => {
            const yesterday = new Date('2023-05-14T08:00:00Z');
            const today = new Date('2023-05-15T08:00:00Z');
            expect(isYesterday(yesterday, 'UTC')).toBe(true);
            expect(isYesterday(today, 'UTC')).toBe(false);
        });
    });

    describe('getCategoryFromScripture', () => {
        it('should identify Book of Mormon', () => {
            expect(getCategoryFromScripture('1 Nephi 3:7')).toBe('bofm');
            expect(getCategoryFromScripture('Alma 32:21')).toBe('bofm');
            expect(getCategoryFromScripture('Mosiah 2:17')).toBe('bofm');
            expect(getCategoryFromScripture('Mormon 8:1')).toBe('bofm');
            expect(getCategoryFromScripture('Ether 12:6')).toBe('bofm');
        });

        it('should identify Old Testament', () => {
            expect(getCategoryFromScripture('Genesis 1:1')).toBe('ot');
            expect(getCategoryFromScripture('Exodus 20:1')).toBe('ot');
            expect(getCategoryFromScripture('Psalms 23:1')).toBe('ot');
            expect(getCategoryFromScripture('Isaiah 53:5')).toBe('ot');
        });

        it('should identify New Testament', () => {
            expect(getCategoryFromScripture('Matthew 5:1')).toBe('nt');
            expect(getCategoryFromScripture('Mark 1:1')).toBe('nt');
            expect(getCategoryFromScripture('Luke 2:1')).toBe('nt');
            expect(getCategoryFromScripture('John 3:16')).toBe('nt');
            expect(getCategoryFromScripture('Acts 2:38')).toBe('nt');
            expect(getCategoryFromScripture('Revelation 1:1')).toBe('nt');
        });

        it('should identify Doctrine and Covenants', () => {
            expect(getCategoryFromScripture('Doctrine and Covenants 89')).toBe('dc');
            expect(getCategoryFromScripture('D&C 4')).toBe('dc');
        });

        it('should identify Pearl of Great Price', () => {
            expect(getCategoryFromScripture('Moses 1:39')).toBe('pgp');
            expect(getCategoryFromScripture('Abraham 3:22')).toBe('pgp');
        });

        it('should default to other', () => {
            expect(getCategoryFromScripture('Unknown Book 1:1')).toBe('other');
        });
    });
});
