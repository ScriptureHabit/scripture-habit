export type Language = 'en' | 'ja' | 'pt' | 'zho' | 'es' | 'vi' | 'th' | 'ko' | 'tl' | 'sw';

export type TranslationValue = string | string[] | NestedTranslations;
export interface NestedTranslations {
    [key: string]: TranslationValue;
}

export interface LanguageConfig {
    code: Language;
    name: string;
    translationKey: string;
    flag: string;
    ldsCode: string;
}

export const LANGUAGES: readonly LanguageConfig[] = [
    { code: 'en', name: 'English', translationKey: 'languages.english', flag: '🇺🇸', ldsCode: 'eng' },
    { code: 'ja', name: '日本語', translationKey: 'languages.japanese', flag: '🇯🇵', ldsCode: 'jpn' },
    { code: 'pt', name: 'Português', translationKey: 'languages.portuguese', flag: '🇧🇷', ldsCode: 'por' },
    { code: 'zho', name: '繁體中文', translationKey: 'languages.chinese', flag: '🇹🇼', ldsCode: 'zho' },
    { code: 'es', name: 'Español', translationKey: 'languages.spanish', flag: '🇪🇸', ldsCode: 'spa' },
    { code: 'vi', name: 'Tiếng Việt', translationKey: 'languages.vietnamese', flag: '🇻🇳', ldsCode: 'vie' },
    { code: 'th', name: 'ไทย', translationKey: 'languages.thai', flag: '🇹🇭', ldsCode: 'tha' },
    { code: 'ko', name: '한국어', translationKey: 'languages.korean', flag: '🇰🇷', ldsCode: 'kor' },
    { code: 'tl', name: 'Tagalog', translationKey: 'languages.tagalog', flag: '🇵🇭', ldsCode: 'tgl' },
    { code: 'sw', name: 'Kiswahili', translationKey: 'languages.swahili', flag: '🇰🇪', ldsCode: 'swa' },
] as const;

export const SUPPORTED_LANGUAGES: Language[] = LANGUAGES.map(lang => lang.code);
export const DEFAULT_LANGUAGE: Language = 'en';

export function getLanguageConfig(code: string): LanguageConfig | undefined {
    return LANGUAGES.find(lang => lang.code === code);
}

export function getLdsLanguageCode(code: string): string {
    const config = getLanguageConfig(code);
    return config ? config.ldsCode : 'eng';
}
