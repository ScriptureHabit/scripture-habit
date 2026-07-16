/**
 * Streak Reminder Engine
 * Pure logic for calculating timezones and eligibility for streak warnings.
 */

// Cache Intl.DateTimeFormat instances to avoid high creation overhead in loops.
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
                // Get the hour in that timezone using cached formatter
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
     * Checks if a user needs a streak reminder today.
     * @param lastPostDate User's lastPostDate (YYYY-MM-DD) or null/undefined
     * @param now The current Date (UTC)
     * @param timeZone The user's timezone (e.g., 'Asia/Tokyo')
     * @returns true if the user has NOT posted today in their local timezone
     */
    static needsReminder(lastPostDate: string | null | undefined, now: Date, timeZone: string): boolean {
        let today: string;
        try {
            // Get the date formatter using cache to avoid recreation in loops
            const formatter = getCachedDateFormatter(timeZone);
            today = formatter.format(now);
        } catch {
            // Fallback to UTC if timezone is invalid
            today = now.toISOString().split('T')[0];
        }

        // If lastPostDate matches today, they already completed it! No reminder needed.
        if (lastPostDate === today) {
            return false;
        }

        // If they haven't posted today (null, or an older date), they need a reminder.
        return true;
    }
}
