/**
 * Streak Reminder Engine
 * Pure logic for calculating timezones and eligibility for streak / habit reminders.
 */

// Cache Intl.DateTimeFormat instances to avoid high creation overhead in loops.
// Note: These are module-level singletons. Safe for long-running server processes.
// Tests run in isolated worker threads (vitest default), so no cross-test contamination.
const hourFormatterCache = new Map<string, Intl.DateTimeFormat>();
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getCachedHourFormatter(tz: string): Intl.DateTimeFormat {
    let formatter = hourFormatterCache.get(tz);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            hour12: false, // 24-hour format
        });
        hourFormatterCache.set(tz, formatter);
    }
    return formatter;
}

function getCachedDateFormatter(tz: string): Intl.DateTimeFormat {
    let formatter = dateFormatterCache.get(tz);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('sv-SE', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        dateFormatterCache.set(tz, formatter);
    }
    return formatter;
}

/**
 * Calculates calendar day difference between two YYYY-MM-DD strings (date2 - date1).
 */
export function getCalendarDaysDiff(date1Str: string, date2Str: string): number {
    const d1 = new Date(date1Str + 'T00:00:00Z');
    const d2 = new Date(date2Str + 'T00:00:00Z');
    const diffMs = d2.getTime() - d1.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export type ReminderType = 'daily' | 'comeback_3day' | 'fadeout_4day' | null;

export interface ReminderDecision {
    type: ReminderType;
    totalDaysToReach: number;
}

export interface UserReminderData {
    lastPostDate?: string | null;
    daysStudiedCount?: number;
    createdAt?: { toDate?: () => Date } | Date | string | number | null;
    joinedAt?: { toDate?: () => Date } | Date | string | number | null;
}

export class StreakReminderEngine {
    /**
     * Returns a list of timezones where the current local hour matches the target hour.
     * @param now The current Date (UTC)
     * @param targetHour The local hour we want to target (e.g., 20 for 8 PM)
     */
    static getTargetTimezones(now: Date, targetHour: number): string[] {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allTimezones = (Intl as any).supportedValuesOf('timeZone') as string[];
        const targetZones: string[] = [];

        for (const tz of allTimezones) {
            try {
                const formatter = getCachedHourFormatter(tz);
                const hourStr = formatter.format(now);
                let hour = parseInt(hourStr, 10);
                
                // Intl API sometimes returns 24 for midnight, normalize to 0
                if (hour === 24) hour = 0; 

                if (hour === targetHour) {
                    targetZones.push(tz);
                }
            } catch {
                // Ignore invalid timezones if any
            }
        }
        return targetZones;
    }

    /**
     * Formats a Date object to YYYY-MM-DD in the given timezone.
     */
    static getLocalDateString(date: Date, timeZone: string): string {
        try {
            const formatter = getCachedDateFormatter(timeZone);
            return formatter.format(date);
        } catch {
            return date.toISOString().split('T')[0];
        }
    }

    /**
     * Determines what type of reminder (if any) should be sent to the user.
     * 
     * - Day 0 (Posted today): null (no reminder)
     * - Day 1 (Posted yesterday / Active): 'daily' (Goal: totalDays + 1)
     * - Day 2 (2 days inactive): null (rest day / skip)
     * - Day 3 (3 days inactive): 'comeback_3day' (Gentle re-engagement)
     * - Day 4 (4 days inactive): 'fadeout_4day' (Final pause notice)
     * - Day 5+ (5+ days inactive): null (Permanently paused to prevent spam)
     */
    static getReminderDecision(
        userData: UserReminderData | null | undefined,
        now: Date,
        timeZone: string
    ): ReminderDecision {
        // Guard early: no user data = no notification
        if (!userData) {
            return { type: null, totalDaysToReach: 1 };
        }

        const today = this.getLocalDateString(now, timeZone);
        const totalDaysToReach = (userData.daysStudiedCount ?? 0) + 1;

        const lastPostDate = userData.lastPostDate;

        // If user already completed today's study, no reminder needed.
        if (lastPostDate === today) {
            return { type: null, totalDaysToReach };
        }

        let daysDiff: number;

        if (lastPostDate) {
            // Math.max(0, ...) guards against future-dated lastPostDate (clock skew / bad client data)
            daysDiff = Math.max(0, getCalendarDaysDiff(lastPostDate, today));
        } else {
            // User has never posted. Check registration date (joinedAt / createdAt)
            const rawJoined = userData.joinedAt || userData.createdAt;
            let joinDate: Date | null = null;

            if (rawJoined) {
                if (typeof (rawJoined as { toDate?: () => Date }).toDate === 'function') {
                    joinDate = (rawJoined as { toDate: () => Date }).toDate();
                } else if (rawJoined instanceof Date) {
                    joinDate = rawJoined;
                } else {
                    joinDate = new Date(rawJoined as string | number);
                }
            }

            if (joinDate && !isNaN(joinDate.getTime())) {
                const joinDateStr = this.getLocalDateString(joinDate, timeZone);
                const diffFromJoin = getCalendarDaysDiff(joinDateStr, today);
                // Day 0 (registered today): skip — onboarding flow handles first-day UX
                // Day 1 (registered yesterday): treat as daily reminder
                // Day 2+: pass through the real diff so switch() can handle it
                daysDiff = diffFromJoin === 0 ? 0 : (diffFromJoin === 1 ? 1 : diffFromJoin);
            } else {
                // Fallback for users with no registration date: send daily
                daysDiff = 1;
            }
        }

        switch (daysDiff) {
            case 1:
                return { type: 'daily', totalDaysToReach };
            case 3:
                return { type: 'comeback_3day', totalDaysToReach };
            case 4:
                return { type: 'fadeout_4day', totalDaysToReach };
            default:
                // 0 (today/future date/clock skew), 2 (skip day), or 5+ (complete pause)
                return { type: null, totalDaysToReach };
        }
    }

    /**
     * Simple boolean eligibility check (backward compatibility shim).
     * @deprecated Use getReminderDecision() instead — it provides full notification type
     * and totalDaysToReach. This shim will be removed in the next cleanup cycle.
     */
    static needsReminder(lastPostDate: string | null | undefined, now: Date, timeZone: string): boolean {
        const decision = this.getReminderDecision({ lastPostDate }, now, timeZone);
        return decision.type !== null;
    }
}
