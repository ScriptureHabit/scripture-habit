export type Language = 'en' | 'ja' | 'pt' | 'zho' | 'es' | 'vi' | 'th' | 'ko' | 'tl' | 'sw';

export type TranslationValue = string | string[] | NestedTranslations;
export interface NestedTranslations {
    [key: string]: TranslationValue;
}

export const SUPPORTED_LANGUAGES: Language[] = ['en', 'ja', 'pt', 'zho', 'es', 'vi', 'th', 'ko', 'tl', 'sw'];
export const DEFAULT_LANGUAGE: Language = 'en';
