import { describe, it, expect } from 'vitest';
import { StreakEngine, StreakState } from './lib/streak-engine.js';

describe('StreakEngine Reliability (Timezone & Boundary Tests)', () => {
    
    it('should increment streak when posting just after midnight (Calendar Day change)', () => {
        const lastPostAt = new Date('2024-05-01T23:55:00Z'); // 11:55 PM
        const now = new Date('2024-05-02T00:05:00Z');        // 12:05 AM (10 mins later)
        
        const state: StreakState = {
            streakCount: 5,
            highestStreak: 10,
            lastPostDate: '2024-05-01',
            lastPostAt: lastPostAt,
            timeZone: 'UTC'
        };

        const result = StreakEngine.calculateNextStreak(state, { now });
        
        expect(result.newStreak).toBe(6);
        expect(result.streakUpdated).toBe(true);
        expect(result.isConsecutive).toBe(true);
    });

    it('should maintain streak within 36-hour grace period even if a calendar day is skipped', () => {
        // Monday 08:00 AM post
        const lastPostAt = new Date('2024-05-06T08:00:00Z');
        // Wednesday 07:00 PM post (35 hours later) -> Tuesday was skipped
        const now = new Date('2024-05-07T19:00:00Z'); 
        
        const state: StreakState = {
            streakCount: 5,
            highestStreak: 10,
            lastPostDate: '2024-05-06',
            lastPostAt: lastPostAt,
            timeZone: 'UTC'
        };

        const result = StreakEngine.calculateNextStreak(state, { now });
        
        // Should increment because it's within 36 hours
        expect(result.newStreak).toBe(6);
        expect(result.isConsecutive).toBe(true);
    });

    it('should reset streak after 36 hours and when it is no longer "yesterday"', () => {
        const lastPostAt = new Date('2024-05-06T08:00:00Z'); // Monday 08:00 AM
        const now = new Date('2024-05-08T00:01:00Z');        // Wednesday 12:01 AM (40 hours later)
        
        const state: StreakState = {
            streakCount: 5,
            highestStreak: 10,
            lastPostDate: '2024-05-06',
            lastPostAt: lastPostAt,
            timeZone: 'UTC'
        };

        const result = StreakEngine.calculateNextStreak(state, { now });
        
        expect(result.newStreak).toBe(1); // Reset!
        expect(result.isConsecutive).toBe(false);
    });

    it('should handle timezone shifts correctly (London to Tokyo)', () => {
        // User in London (UTC) posts at 11 PM
        const londonLastPost = new Date('2024-05-01T23:00:00Z'); 
        
        // User moves to Tokyo (JST, +9) and posts 5 hours later
        // In London it's 4 AM May 2nd. In Tokyo it's 1 PM May 2nd.
        const now = new Date('2024-05-02T04:00:00Z'); 

        const state: StreakState = {
            streakCount: 1,
            highestStreak: 1,
            lastPostDate: '2024-05-01',
            lastPostAt: londonLastPost,
            timeZone: 'Asia/Tokyo' // User updated their TZ to Tokyo
        };

        const result = StreakEngine.calculateNextStreak(state, { now });
        
        expect(result.today).toBe('2024-05-02');
        expect(result.newStreak).toBe(2);
        expect(result.isConsecutive).toBe(true);
    });

    it('should NOT increment streak if posting twice on the same day in the same timezone', () => {
        const lastPostAt = new Date('2024-05-01T08:00:00Z');
        const now = new Date('2024-05-01T20:00:00Z'); // Same day
        
        const state: StreakState = {
            streakCount: 5,
            highestStreak: 10,
            lastPostDate: '2024-05-01',
            lastPostAt: lastPostAt,
            timeZone: 'UTC'
        };

        const result = StreakEngine.calculateNextStreak(state, { now });
        
        expect(result.newStreak).toBe(5); // No change
        expect(result.streakUpdated).toBe(false);
    });
});
