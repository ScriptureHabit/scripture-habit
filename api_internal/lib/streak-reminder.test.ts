import { describe, it, expect } from 'vitest';
import { StreakReminderEngine, getCalendarDaysDiff } from './streak-reminder.js';

describe('StreakReminderEngine', () => {
    describe('getCalendarDaysDiff', () => {
        it('should correctly calculate calendar day differences', () => {
            expect(getCalendarDaysDiff('2026-05-17', '2026-05-18')).toBe(1);
            expect(getCalendarDaysDiff('2026-05-15', '2026-05-18')).toBe(3);
            expect(getCalendarDaysDiff('2026-05-14', '2026-05-18')).toBe(4);
            expect(getCalendarDaysDiff('2026-05-18', '2026-05-18')).toBe(0);
            expect(getCalendarDaysDiff('2026-05-10', '2026-05-18')).toBe(8);
        });
    });

    describe('getTargetTimezones', () => {
        it('should return Asia/Tokyo when it is 20:30 in JST', () => {
            // UTC 11:30 = JST 20:30 (UTC+9)
            const now = new Date('2026-05-18T11:30:00Z');
            const zones = StreakReminderEngine.getTargetTimezones(now, 20);
            
            expect(zones).toContain('Asia/Tokyo');
            expect(zones).not.toContain('America/New_York'); 
            expect(zones).not.toContain('Europe/London');    
        });

        it('should return America/New_York when it is 20:30 in EST (Winter time)', () => {
            // UTC 01:30 = EST 20:30 (UTC-5 in standard time, e.g. January)
            const now = new Date('2026-01-02T01:30:00Z'); 
            const zones = StreakReminderEngine.getTargetTimezones(now, 20);
            
            expect(zones).toContain('America/New_York');
            expect(zones).not.toContain('Asia/Tokyo'); 
        });

        it('should handle midnight edge case correctly (hour 0)', () => {
            // UTC 15:30 = JST 00:30 (next day)
            const now = new Date('2026-05-18T15:30:00Z');
            const zones = StreakReminderEngine.getTargetTimezones(now, 0);
            
            expect(zones).toContain('Asia/Tokyo');
        });
    });

    describe('getReminderDecision', () => {
        const now = new Date('2026-05-18T11:30:00Z'); // 20:30 JST on May 18, 2026

        it('Day 0: should return null when user posted today', () => {
            const decision = StreakReminderEngine.getReminderDecision(
                { lastPostDate: '2026-05-18', daysStudiedCount: 5 },
                now,
                'Asia/Tokyo'
            );
            expect(decision.type).toBe(null);
            expect(decision.totalDaysToReach).toBe(6);
        });

        it('Day 1: should return daily when user posted yesterday (active habit loop)', () => {
            const decision = StreakReminderEngine.getReminderDecision(
                { lastPostDate: '2026-05-17', daysStudiedCount: 10 },
                now,
                'Asia/Tokyo'
            );
            expect(decision.type).toBe('daily');
            expect(decision.totalDaysToReach).toBe(11);
        });

        it('Day 2: should return null (rest day / skip day)', () => {
            const decision = StreakReminderEngine.getReminderDecision(
                { lastPostDate: '2026-05-16', daysStudiedCount: 10 },
                now,
                'Asia/Tokyo'
            );
            expect(decision.type).toBe(null);
        });

        it('Day 3: should return comeback_3day (gentle re-engagement)', () => {
            const decision = StreakReminderEngine.getReminderDecision(
                { lastPostDate: '2026-05-15', daysStudiedCount: 10 },
                now,
                'Asia/Tokyo'
            );
            expect(decision.type).toBe('comeback_3day');
            expect(decision.totalDaysToReach).toBe(11);
        });

        it('Day 4: should return fadeout_4day (final pause notice)', () => {
            const decision = StreakReminderEngine.getReminderDecision(
                { lastPostDate: '2026-05-14', daysStudiedCount: 10 },
                now,
                'Asia/Tokyo'
            );
            expect(decision.type).toBe('fadeout_4day');
            expect(decision.totalDaysToReach).toBe(11);
        });

        it('Day 5+: should return null (permanently paused to prevent spamming inactive users)', () => {
            const decisionDay5 = StreakReminderEngine.getReminderDecision(
                { lastPostDate: '2026-05-13', daysStudiedCount: 10 },
                now,
                'Asia/Tokyo'
            );
            expect(decisionDay5.type).toBe(null);

            const decisionDay30 = StreakReminderEngine.getReminderDecision(
                { lastPostDate: '2026-04-18', daysStudiedCount: 10 },
                now,
                'Asia/Tokyo'
            );
            expect(decisionDay30.type).toBe(null);
        });

        it('New user registered TODAY should receive NO notification (onboarding handles day-0 UX)', () => {
            const decision = StreakReminderEngine.getReminderDecision(
                { lastPostDate: null, daysStudiedCount: 0, joinedAt: '2026-05-18T08:00:00Z' },
                now,
                'Asia/Tokyo'
            );
            // Day 0: skip — the welcome/onboarding flow handles first-day UX
            expect(decision.type).toBe(null);
        });

        it('New user with joinedAt yesterday should receive daily reminder', () => {
            const decision = StreakReminderEngine.getReminderDecision(
                { lastPostDate: null, daysStudiedCount: 0, joinedAt: '2026-05-17T08:00:00Z' },
                now,
                'Asia/Tokyo'
            );
            expect(decision.type).toBe('daily');
            expect(decision.totalDaysToReach).toBe(1);
        });

        it('New user registered 3 days ago with no posts should receive comeback_3day', () => {
            const decision = StreakReminderEngine.getReminderDecision(
                { lastPostDate: null, daysStudiedCount: 0, joinedAt: '2026-05-15T08:00:00Z' },
                now,
                'Asia/Tokyo'
            );
            expect(decision.type).toBe('comeback_3day');
            expect(decision.totalDaysToReach).toBe(1);
        });

        it('New user registered 10 days ago with no posts should be completely paused (null)', () => {
            const decision = StreakReminderEngine.getReminderDecision(
                { lastPostDate: null, daysStudiedCount: 0, joinedAt: '2026-05-08T08:00:00Z' },
                now,
                'Asia/Tokyo'
            );
            expect(decision.type).toBe(null);
        });
    });

    describe('needsReminder (backward compatibility)', () => {
        const now = new Date('2026-05-18T11:30:00Z'); // 20:30 JST (May 18)

        it('should return false if user posted today', () => {
            const needs = StreakReminderEngine.needsReminder('2026-05-18', now, 'Asia/Tokyo');
            expect(needs).toBe(false);
        });

        it('should return true if user posted yesterday', () => {
            const needs = StreakReminderEngine.needsReminder('2026-05-17', now, 'Asia/Tokyo');
            expect(needs).toBe(true);
        });

        it('should return false if user posted 2 days ago (rest day)', () => {
            const needs = StreakReminderEngine.needsReminder('2026-05-16', now, 'Asia/Tokyo');
            expect(needs).toBe(false);
        });

        it('should return true if user posted 3 days ago (comeback)', () => {
            const needs = StreakReminderEngine.needsReminder('2026-05-15', now, 'Asia/Tokyo');
            expect(needs).toBe(true);
        });

        it('should return true if user posted 4 days ago (fadeout)', () => {
            const needs = StreakReminderEngine.needsReminder('2026-05-14', now, 'Asia/Tokyo');
            expect(needs).toBe(true);
        });

        it('should return false if user posted 5+ days ago (paused)', () => {
            const needs = StreakReminderEngine.needsReminder('2026-05-13', now, 'Asia/Tokyo');
            expect(needs).toBe(false);
        });
    });
});
