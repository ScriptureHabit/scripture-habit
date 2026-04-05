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
        const { now } = options;
        let { streakCount, highestStreak, lastPostDate, lastPostAt, timeZone } = currentState;

        // Use client timezone if user has none, else fallback to UTC
        const effectiveTimeZone = timeZone || 'UTC';
        
        let today: string;
        let yesterday: string;

        // TRUTH: Calculate today and yesterday correctly within the target timezone
        // This avoids bugs where 'now - 1 day' calculation happens in server local time.
        try {
            const formatter = new Intl.DateTimeFormat('sv-SE', { 
                timeZone: effectiveTimeZone, 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
            });
            today = formatter.format(now);
            
            // Subtracting 24 hours from 'now' and formatting it in TZ 
            // is the most robust way to get 'yesterday' in that specific timezone.
            const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            yesterday = formatter.format(yesterdayDate);
        } catch {
            today = now.toISOString().split('T')[0];
            const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            yesterday = yesterdayDate.toISOString().split('T')[0];
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
            // Truthful: If we don't know the last post date, we can't confirm continuity.
            // Reset to 1 to start a new verifiable streak.
            newStreak = 1;
            streakUpdated = true;
        } else {
            const isTargetDay = lastPostDate === yesterday;
            
            // Grace period: allows a wider window (36 hours) instead of strict calendar day.
            
            interface MinimalTimestamp { 
                toMillis?: () => number; 
                seconds?: number; 
            }

            const getMillisSafely = (ts: MinimalTimestamp | Date | number | null | undefined): number => {
                if (!ts) return 0;
                if (typeof ts === 'object') {
                    if (ts instanceof Date) return ts.getTime();
                    if ('toMillis' in ts && typeof ts.toMillis === 'function') return ts.toMillis();
                    if ('seconds' in ts && ts.seconds !== undefined) return ts.seconds * 1000;
                }
                if (typeof ts === 'number') return ts;
                return 0;
            };

            const lastTimeMillis = getMillisSafely(lastPostAt as MinimalTimestamp | Date | number | null | undefined);
            const hoursSinceLastPost = (now.getTime() - lastTimeMillis) / (1000 * 60 * 60);
            
            // TRUTH: A universal 36-hour window (1.5 days) is fairer and more accurate 
            // than a strict calendar day which varies by TZ. This allows for life's delays.
            const withinGracePeriod = lastTimeMillis > 0 && hoursSinceLastPost <= 36;

            if (isTargetDay || withinGracePeriod) {
                newStreak += 1;
                isConsecutive = true;
                streakUpdated = true;
            } else {
                newStreak = 1; // Reset streak
                streakUpdated = true;
            }
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
