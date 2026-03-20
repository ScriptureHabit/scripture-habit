export const NOTE_HEADER_REGEX = /^\*\*(.*?)\*\*\n\n/;
export const removeNoteHeader = (text: string) => text.replace(NOTE_HEADER_REGEX, '');

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

/**
 * Checks if a date is today relative to a timezone.
 */
export const isToday = (date: Date, timeZone: string = 'UTC') => {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone });
    const target = date.toLocaleDateString('sv-SE', { timeZone });
    return today === target;
};

/**
 * Checks if a date was yesterday relative to a timezone.
 */
export const isYesterday = (date: Date, timeZone: string = 'UTC') => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('sv-SE', { timeZone });
    const target = date.toLocaleDateString('sv-SE', { timeZone });
    return yesterdayStr === target;
};

/**
 * Determines category from scripture string (simplified).
 */
export const getCategoryFromScripture = (scripture: string): string => {
    const s = scripture.toLowerCase();
    if (s.includes('nephi') || s.includes('alma') || s.includes('mosiah') || s.includes('mormon') || s.includes('ether')) return 'bofm';
    if (s.includes('genesis') || s.includes('exodus') || s.includes('psalms') || s.includes('isaiah')) return 'ot';
    if (s.includes('matthew') || s.includes('mark') || s.includes('luke') || s.includes('john') || s.includes('acts') || s.includes('revelation')) return 'nt';
    if (s.includes('doctrine and covenants') || s.includes('d&c')) return 'dc';
    if (s.includes('moses') || s.includes('abraham')) return 'pgp';
    return 'other';
};
