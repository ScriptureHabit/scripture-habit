import { ReadingPlanItem } from '../types/scriptures';
import { DailyReadingPlan2025 } from './daily-reading-plan2025';
import { DailyReadingPlan2026 } from './daily-reading-plan2026';

// Function to retrieve today's reading plan
export const getTodayReadingPlan = (): ReadingPlanItem | undefined => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
    const now = new Date();
    // Format to YYYY-MM-DD in local time
    const localDate = now.toLocaleDateString('sv-SE', { timeZone });

    // Switch to 2026 plan starting from Dec 29, 2025
    if (localDate >= "2025-12-29") {
        return (DailyReadingPlan2026 as ReadingPlanItem[]).find(p => p.date === localDate);
    } else {
        return (DailyReadingPlan2025 as ReadingPlanItem[]).find(p => p.date === localDate);
    }
};
