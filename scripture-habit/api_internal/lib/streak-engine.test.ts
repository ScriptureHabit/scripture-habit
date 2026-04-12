import { describe, it, expect } from 'vitest';
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
});
