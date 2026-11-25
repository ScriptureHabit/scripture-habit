import { ReadingPlanItem } from '../types/scriptures';
import { DailyReadingPlan2025 } from './daily-reading-plan2025';
import { DailyReadingPlan2026 } from './daily-reading-plan2026';
import { DailyReadingPlan2027 } from './daily-reading-plan2027';

// Function to retrieve today's reading plan
export const getTodayReadingPlan = (): ReadingPlanItem | undefined => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
    const now = new Date();
    // Format to YYYY-MM-DD in local time
    const localDate = now.toLocaleDateString('sv-SE', { timeZone });

    // Switch to 2027 plan starting from Dec 28, 2026
    if (localDate >= "2026-12-28") {
        return (DailyReadingPlan2027 as ReadingPlanItem[]).find(p => p.date === localDate);
    } else if (localDate >= "2025-12-29") {
        return (DailyReadingPlan2026 as ReadingPlanItem[]).find(p => p.date === localDate);
    } else {
        return (DailyReadingPlan2025 as ReadingPlanItem[]).find(p => p.date === localDate);
    }
};
