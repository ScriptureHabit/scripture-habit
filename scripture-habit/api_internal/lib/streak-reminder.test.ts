import { describe, it, expect } from 'vitest';
import { StreakReminderEngine } from './streak-reminder.js';

describe('StreakReminderEngine', () => {
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

    describe('needsReminder', () => {
        it('should return false if user posted today', () => {
            const now = new Date('2026-05-18T11:30:00Z'); // 20:30 JST (May 18)
            const needs = StreakReminderEngine.needsReminder('2026-05-18', now, 'Asia/Tokyo');
            expect(needs).toBe(false);
        });

        it('should return true if user posted yesterday', () => {
            const now = new Date('2026-05-18T11:30:00Z'); // 20:30 JST (May 18)
            const needs = StreakReminderEngine.needsReminder('2026-05-17', now, 'Asia/Tokyo');
            expect(needs).toBe(true);
        });

        it('should return true if user has no post history', () => {
            const now = new Date('2026-05-18T11:30:00Z'); 
            const needs = StreakReminderEngine.needsReminder(null, now, 'Asia/Tokyo');
            expect(needs).toBe(true);
        });
        
        it('should handle timezone edge cases correctly (Global day boundary)', () => {
            // In Japan, it is May 19th 08:00 AM
            // In New York, it is May 18th 19:00 PM (EDT, UTC-4)
            const now = new Date('2026-05-18T23:00:00Z'); 
            
            // NY user posted on May 18th (Today in NY) -> No reminder needed
            const needsNY_postedToday = StreakReminderEngine.needsReminder('2026-05-18', now, 'America/New_York');
            expect(needsNY_postedToday).toBe(false);

            // JST user posted on May 18th (Yesterday in JST) -> Needs reminder for May 19th
            const needsJST_postedYesterday = StreakReminderEngine.needsReminder('2026-05-18', now, 'Asia/Tokyo');
            expect(needsJST_postedYesterday).toBe(true);
        });
    });
});
