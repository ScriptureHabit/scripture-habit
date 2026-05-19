import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { StreakEngine, StreakState } from './streak-engine';

describe('StreakEngine', () => {
    const defaultState: StreakState = {
        streakCount: 5,
        highestStreak: 10,
        lastPostDate: '2026-04-10',
        lastPostAt: new Date('2026-04-10T10:00:00Z'),
        timeZone: 'UTC'
    };

    it('should increment streak when posting on the next day', () => {
        const now = new Date('2026-04-11T10:00:00Z');
        const result = StreakEngine.calculateNextStreak(defaultState, { now });

        expect(result.newStreak).toBe(6);
        expect(result.isConsecutive).toBe(true);
        expect(result.streakUpdated).toBe(true);
        expect(result.today).toBe('2026-04-11');
    });

    it('should NOT increment streak when posting again on the same day', () => {
        const now = new Date('2026-04-10T15:00:00Z');
        const result = StreakEngine.calculateNextStreak(defaultState, { now });

        expect(result.newStreak).toBe(5);
        expect(result.isConsecutive).toBe(false);
        expect(result.streakUpdated).toBe(false);
    });

    it('should increment streak within 36 hour grace period even if not consecutive calendar day', () => {
        // Last post: 2026-04-10 10:00
        // Current: 2026-04-11 21:00 (35 hours later)
        const now = new Date('2026-04-11T21:00:00Z');
        const result = StreakEngine.calculateNextStreak(defaultState, { now });

        expect(result.newStreak).toBe(6);
        expect(result.isConsecutive).toBe(true);
    });

    it('should increment streak when last post date is not yesterday but lastPostAt is within grace period', () => {
        const state: StreakState = {
            streakCount: 5,
            highestStreak: 10,
            lastPostDate: '2026-04-09',
            lastPostAt: { seconds: Math.floor(new Date('2026-04-10T12:00:00Z').getTime() / 1000) } as any,
            timeZone: 'UTC'
        };
        const now = new Date('2026-04-11T22:00:00Z');
        const result = StreakEngine.calculateNextStreak(state, { now });

        expect(result.newStreak).toBe(6);
        expect(result.isConsecutive).toBe(true);
        expect(result.streakUpdated).toBe(true);
    });

    it('should reset streak when missing more than 36 hours', () => {
        // Last post: 2026-04-10 10:00
        // Current: 2026-04-12T01:00:00Z (39 hours later)
        const now = new Date('2026-04-12T01:00:00Z');
        const result = StreakEngine.calculateNextStreak(defaultState, { now });

        expect(result.newStreak).toBe(1);
        expect(result.isConsecutive).toBe(false);
        expect(result.streakUpdated).toBe(true);
    });

    it('should update highest streak if new streak exceeds it', () => {
        const state: StreakState = {
            ...defaultState,
            streakCount: 10,
            highestStreak: 10,
            lastPostDate: '2026-04-10',
            lastPostAt: new Date('2026-04-10T10:00:00Z')
        };
        const now = new Date('2026-04-11T10:00:00Z');
        const result = StreakEngine.calculateNextStreak(state, { now });

        expect(result.newStreak).toBe(11);
        expect(result.currentHighest).toBe(11);
    });

    it('should fall back to ISO dates when timezone is invalid', () => {
        const state: StreakState = {
            streakCount: 5,
            highestStreak: 10,
            lastPostDate: '2026-04-10',
            lastPostAt: new Date('2026-04-10T10:00:00Z'),
            timeZone: 'Invalid/Zone'
        };
        const now = new Date('2026-04-11T10:00:00Z');
        const result = StreakEngine.calculateNextStreak(state, { now });

        expect(result.today).toBe(now.toISOString().split('T')[0]);
        expect(result.newStreak).toBe(6);
        expect(result.isConsecutive).toBe(true);
    });

    it('should handle first post correctly', () => {
        const state: StreakState = {
            streakCount: 0,
            highestStreak: 0,
            lastPostDate: null,
            lastPostAt: null,
            timeZone: 'UTC'
        };
        const now = new Date('2026-04-11T10:00:00Z');
        const result = StreakEngine.calculateNextStreak(state, { now });

        expect(result.newStreak).toBe(1);
        expect(result.streakUpdated).toBe(true);
    });

    it('should handle lastPostAt as a number (line 102)', () => {
        const lastPostAt = new Date('2026-04-10T10:00:00Z').getTime(); // number
        const state: StreakState = {
            streakCount: 5,
            highestStreak: 10,
            lastPostDate: '2026-04-10',
            lastPostAt: lastPostAt as any,
            timeZone: 'UTC'
        };
        const now = new Date('2026-04-11T10:00:00Z');
        const result = StreakEngine.calculateNextStreak(state, { now });

        expect(result.newStreak).toBe(6);
        expect(result.isConsecutive).toBe(true);
    });

    it('should fallback to 0 when lastPostAt is an unsupported format (line 103)', () => {
        const state: StreakState = {
            streakCount: 5,
            highestStreak: 10,
            lastPostDate: '2026-04-09',
            lastPostAt: 'unsupported-string-format' as any,
            timeZone: 'UTC'
        };
        const now = new Date('2026-04-11T10:00:00Z');
        const result = StreakEngine.calculateNextStreak(state, { now });

        expect(result.newStreak).toBe(1);
        expect(result.isConsecutive).toBe(false);
    });

    describe('Property-Based Tests', () => {
        it('should NEVER jump streak count by more than 1', () => {
            fc.assert(
                fc.property(
                    fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-01-01T00:00:00Z') }).filter(d => !Number.isNaN(d.getTime())),
                    fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-01-01T00:00:00Z') }).filter(d => !Number.isNaN(d.getTime())),
                    fc.integer({ min: 1, max: 1000 }),
                    fc.integer({ min: 1, max: 1000 }),
                    (lastPostAt, currentNow, currentStreak, highest) => {
                        // Ensure chronological order
                        fc.pre(currentNow.getTime() >= lastPostAt.getTime());
                        
                        const state: StreakState = {
                            streakCount: currentStreak,
                            highestStreak: highest,
                            lastPostDate: lastPostAt.toISOString().split('T')[0],
                            lastPostAt: lastPostAt,
                            timeZone: 'UTC'
                        };

                        const result = StreakEngine.calculateNextStreak(state, { now: currentNow });

                        // The new streak MUST be either the old streak (if same day),
                        // old streak + 1 (if within grace period), or 1 (if reset).
                        // It can NEVER jump arbitrarily.
                        expect(
                            result.newStreak === 1 || 
                            result.newStreak === currentStreak || 
                            result.newStreak === currentStreak + 1
                        ).toBe(true);

                        // It should never exceed old highest by more than 1
                        expect(result.currentHighest).toBeLessThanOrEqual(Math.max(highest, currentStreak + 1));
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should ALWAYS reset streak if gap is strictly greater than 48 hours (to be safe over 36 grace limit + 12 timezone variance max)', () => {
            fc.assert(
                fc.property(
                    fc.date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-01-01T00:00:00Z') }).filter(d => !Number.isNaN(d.getTime())),
                    fc.integer({ min: 49, max: 10000 }), // hours gap
                    fc.integer({ min: 1, max: 1000 }),
                    (lastPostAt, hoursGap, currentStreak) => {
                        const currentNow = new Date(lastPostAt.getTime() + hoursGap * 60 * 60 * 1000);
                        
                        const state: StreakState = {
                            streakCount: currentStreak,
                            highestStreak: currentStreak,
                            lastPostDate: lastPostAt.toISOString().split('T')[0],
                            lastPostAt: lastPostAt,
                            timeZone: 'UTC'
                        };

                        const result = StreakEngine.calculateNextStreak(state, { now: currentNow });

                        // If it's been more than 48 hours, it's definitely functionally impossible 
                        // to be within a consecutive calculation timeframe correctly.
                        expect(result.newStreak).toBe(1);
                        expect(result.isConsecutive).toBe(false);
                    }
                )
            );
        });
    });
});
