export const NOTE_HEADER_REGEX = /^\*\*(.*?)\*\*(?:\n\n|\n|\s+|$)/;
export const removeNoteHeader = (text: string) => text.replace(NOTE_HEADER_REGEX, '');

/**
 * Checks if a string is a URL or a GC-style shortcode (e.g., 2024/10/talk-title).
 */
export const isGCUrl = (str: string | undefined): boolean => {
    if (!str) return false;
    const clean = str.trim();
    if (clean.toLowerCase().startsWith('http')) return true;
    return /^\d{4}\/\d{2}\/.+$/.test(clean);
};

/**
 * Extracts unique https URLs from text and cleans trailing punctuation.
 */
export const extractUrls = (text: string | undefined): string[] => {
    if (!text) return [];
    const urlPattern = /https?:\/\/[^\s"']+/gi;
    const matches = text.match(urlPattern);
    if (!matches) return [];

    const seen = new Set<string>();
    return matches.map(url => url.replace(/[.,:;"')\]*_]+$/, '')).filter(url => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
    });
};

/**
 * Calculates the new level and XP based on study time and bonuses.
 */
export const calculateNewLevelAndXP = (
    currentLevel: number,
    currentXP: number,
    studyTime: number,
    isFirstPostToday: boolean,
    streakCount: number
) => {
    let xpGain = Math.floor(studyTime * 1.5); // Base XP
    if (isFirstPostToday) {
        xpGain += 20; // Daily bonus
        if (streakCount > 0 && streakCount % 7 === 0) {
            xpGain += 50; // Weekly streak bonus
        }
    }

    let newXP = currentXP + xpGain;
    let newLevel = currentLevel;
    
    // Simple level up logic: each level requires level * 100 XP
    while (newXP >= newLevel * 100) {
        newXP -= newLevel * 100;
        newLevel++;
    }

    return { newLevel, newXP, xpGain };
};
