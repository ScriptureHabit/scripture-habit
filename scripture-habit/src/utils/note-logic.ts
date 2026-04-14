/**
 * Centralized logic for formatting and validating notes.
 */

/**
 * Formats the final message text for a note.
 */
export const formatNoteText = (scripture: string, chapter: string, comment: string): string => {
    // Only add bold header if scripture and chapter are present
    const header = (scripture && chapter) ? `**${scripture} ${chapter}**\n\n` : '';
    return `${header}${comment}`;
};

/**
 * Validates note requirements based on category.
 * Returns an error key (for translation) or null if valid.
 */
export const getNoteValidationError = (scripture: string, chapter: string): string | null => {
    if (!scripture || !chapter) return 'newNote.errorMissingFields';
    
    const isUrl = typeof chapter === 'string' && chapter.startsWith('http');
    
    if (scripture === "General Conference" && !isUrl) {
        return 'newNote.urlRequiredForGC';
    }
    if (scripture === "BYU Speeches" && !isUrl) {
        return 'newNote.urlRequiredForBYU';
    }
    if (scripture === "Other" && !chapter.trim()) {
        return 'newNote.urlRequiredForOther';
    }
    
    return null;
};
