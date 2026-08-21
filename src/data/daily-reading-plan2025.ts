import { ReadingPlanItem } from '../types/scriptures';

export const DailyReadingPlan2025: ReadingPlanItem[] = [
    // ... (January - November data will be populated here)

    // December (End of year data provided)
    { day: 348, scripts: ["Official Declarations 1:17-20"], date: "2025-12-12" },
    { day: 349, scripts: ["Official Declarations 2:1-8"], date: "2025-12-13" },
    { day: 350, scripts: ["Official Declarations 2:9-18"], date: "2025-12-14" },
    { day: 351, scripts: ["The Family: A Proclamation to the World 1:1"], date: "2025-12-15" },
    { day: 352, scripts: ["The Family: A Proclamation to the World 1:2"], date: "2025-12-16" },
    { day: 353, scripts: ["The Family: A Proclamation to the World 1:3"], date: "2025-12-17" },
    { day: 354, scripts: ["The Family: A Proclamation to the World 1:4-5"], date: "2025-12-18" },
    { day: 355, scripts: ["The Family: A Proclamation to the World 1:6"], date: "2025-12-19" },
    { day: 356, scripts: ["The Family: A Proclamation to the World 1:7"], date: "2025-12-20" },
    { day: 357, scripts: ["The Family: A Proclamation to the World 1:8-9"], date: "2025-12-21" },
    { day: 358, scripts: ["Doctrine and Covenants 93:21-24"], date: "2025-12-22" },
    { day: 359, scripts: ["Doctrine and Covenants 93:8-9"], date: "2025-12-23" },
    { day: 360, scripts: ["Doctrine and Covenants 45:7-8", "Doctrine and Covenants 19:23-24", "Doctrine and Covenants 93:11-14", "Doctrine and Covenants 93:1-5"], date: "2025-12-24" },
    { day: 361, scripts: ["Doctrine and Covenants 19:1", "Doctrine and Covenants 20:21-24"], date: "2025-12-25" },
    { day: 362, scripts: ["Doctrine and Covenants 76:40-41", "Doctrine and Covenants 18:10-13"], date: "2025-12-26" },
    { day: 363, scripts: ["Doctrine and Covenants 110:2-4"], date: "2025-12-27" },
    { day: 364, scripts: ["Doctrine and Covenants 33:17"], date: "2025-12-28" }
];

// Function to retrieve today's reading plan
export const getTodayReadingPlan = (): ReadingPlanItem | undefined => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
    const now = new Date();
    // Format to YYYY-MM-DD in local time
    const localDate = now.toLocaleDateString('sv-SE', { timeZone });

    // Find plan by matching date string
    return DailyReadingPlan2025.find(p => p.date === localDate);
};
