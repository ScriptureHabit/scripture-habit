/**
 * DEPRECATED: Book name translations have been split into language-specific files 
 * and are now dynamically loaded via LanguageContext.
 * 
 * Please use translateBookName or translateChapterField from the useLanguage hook instead.
 */

export const bookNameTranslations: Record<string, Record<string, string>> = {};

export const translateBookName = (bookName: string, _language: string): string => {
    console.warn('translateBookName is deprecated. Use useLanguage context instead. (Current language requested: ' + _language + ')');
    return bookName;
};

export const translateChapterField = (chapterText: string, _language: string): string => {
    console.warn('translateChapterField is deprecated. Use useLanguage context instead. (Current language requested: ' + _language + ')');
    return chapterText;
};
