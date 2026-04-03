/**
 * Streak Calculation Engine
 * Pure logic for calculating paper/habit streaks based on activity.
 */

export interface StreakState {
    streakCount: number;
    highestStreak: number;
    lastPostDate: string | null;
    lastPostAt: Date | null;
    timeZone: string;
}

export interface StreakResult {
    newStreak: number;
    currentHighest: number;
    today: string;
    streakUpdated: boolean;
    isConsecutive: boolean;
}

export class StreakEngine {
    /**
     * Calculates the new streak state after a successful post.
     * 
     * @param currentState - Current user streak status from DB
     * @param options - Contextual info like current time and client timezone
     */
    static calculateNextStreak(
        currentState: StreakState,
        options: { now: Date; clientTimeZone?: string | null }
    ): StreakResult {
        const { now, clientTimeZone } = options;
        let { streakCount, highestStreak, lastPostDate, lastPostAt, timeZone } = currentState;

        // Use client timezone if user has none, else fallback to UTC
        const effectiveTimeZone = timeZone || 'UTC';
        
        let today: string;
        let yesterday: string;

        try {
            today = now.toLocaleDateString('sv-SE', { timeZone: effectiveTimeZone });
            const yesterdayDate = new Date(now);
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            yesterday = yesterdayDate.toLocaleDateString('sv-SE', { timeZone: effectiveTimeZone });
        } catch {
            today = now.toLocaleDateString('sv-SE', { timeZone: 'UTC' });
            const yesterdayDate = new Date(now);
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            yesterday = yesterdayDate.toLocaleDateString('sv-SE', { timeZone: 'UTC' });
        }

        let newStreak = Number(streakCount || 0);
        let currentHighest = Number(highestStreak || newStreak);
        let streakUpdated = false;
        let isConsecutive = false;

        // Future date guard: If last post was "today" or in the future, don't increment streak
        if (lastPostDate === today) {
            return {
                newStreak,
                currentHighest,
                today,
                streakUpdated: false,
                isConsecutive: false
            };
        }

        // Logic for first post ever OR post on a new day
        if (!lastPostDate) {
            newStreak = (newStreak > 0) ? newStreak + 1 : 1;
            streakUpdated = true;
        } else {
            const isTargetDay = lastPostDate === yesterday;
            
            // Grace period: If user is traveling (tz mismatch) or just slightly late, 
            // allow a wider window (45 hours) instead of strict calendar day.
            const lastTime = lastPostAt ? new Date(lastPostAt) : new Date(0);
            const hoursSinceLastPost = (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60);
            
            const isTraveling = clientTimeZone && clientTimeZone !== effectiveTimeZone;
            const withinGracePeriod = isTraveling && hoursSinceLastPost < 45;

            if (isTargetDay || withinGracePeriod) {
                newStreak += 1;
                isConsecutive = true;
            } else {
                newStreak = 1; // Reset streak
            }
            streakUpdated = true;
        }

        if (newStreak > currentHighest) {
            currentHighest = newStreak;
        }

        return {
            newStreak,
            currentHighest,
            today,
            streakUpdated,
            isConsecutive
        };
    }
}
