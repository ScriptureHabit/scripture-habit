import { describe, it, expect, vi } from 'vitest';
import { parseTimestampToDate, parseTimestampToMillis, formatDateInTimeZone, normalizeDateString } from './time-utils';

describe('time-utils', () => {
    describe('parseTimestampToDate', () => {
        it('should handle seconds property', () => {
            const date = parseTimestampToDate({ seconds: 1600000000, nanoseconds: 0 } as any);
            expect(date.getTime()).toBe(1600000000000);
        });

        it('should fallback to current date for unknown objects', () => {
            const date = parseTimestampToDate({ foo: 'bar' } as any);
            // Can't match exact time, but should be a valid Date object
            expect(date).toBeInstanceOf(Date);
        });
    });

    describe('parseTimestampToMillis', () => {
        it('should handle seconds property', () => {
            const millis = parseTimestampToMillis({ seconds: 1600000000, nanoseconds: 0 } as any);
            expect(millis).toBe(1600000000000);
        });

        it('should fallback to current time for unknown objects', () => {
            const millis = parseTimestampToMillis({ foo: 'bar' } as any);
            expect(typeof millis).toBe('number');
            expect(millis).toBeGreaterThan(0);
        });
    });

    describe('formatDateInTimeZone', () => {
        it('should fallback if parts are missing', () => {
            // Mock Intl.DateTimeFormat to return empty parts
            const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({
                formatToParts: () => []
            }) as any);

            const date = new Date('2023-05-10T12:00:00Z');
            expect(formatDateInTimeZone(date, 'UTC')).toBe('2023-05-10');
            spy.mockRestore();
        });

        it('should fallback on error', () => {
            const date = new Date('2023-05-10T12:00:00Z');
            // 'InvalidTimeZone' will throw an error
            expect(formatDateInTimeZone(date, 'InvalidTimeZone')).toBe('2023-05-10');
        });
    });

    describe('normalizeDateString', () => {
        it('should handle Date objects', () => {
            expect(normalizeDateString(new Date('2023-05-10T12:00:00Z'))).toBe('20230510');
        });

        it('should handle Firestore Timestamp objects', () => {
            const mockTimestamp = { toDate: () => new Date('2023-05-10T12:00:00Z') };
            expect(normalizeDateString(mockTimestamp as any)).toBe('20230510');
        });

        it('should return digits for short strings', () => {
            expect(normalizeDateString('2023-05')).toBe('202305');
        });

        it('should return empty string on error', () => {
            // Force an error by passing an object that throws when converted to string
            const badObject = {
                toString: () => { throw new Error('Cannot convert'); }
            };
            expect(normalizeDateString(badObject as any)).toBe('');
        });
    });
});
