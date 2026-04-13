import { SupportedLanguage } from './schemas.js';

// Import translation files
import en from '../locales/en.js';
import ja from '../locales/ja.js';
import es from '../locales/es.js';
import pt from '../locales/pt.js';
import zho from '../locales/zho.js';
import vi from '../locales/vi.js';
import th from '../locales/th.js';
import ko from '../locales/ko.js';
import tl from '../locales/tl.js';
import sw from '../locales/sw.js';

type TranslationValue = string | string[] | { [key: string]: TranslationValue };
type TranslationBundle = { [key: string]: TranslationValue };

const translations: Record<string, TranslationBundle> = {
    en, ja, es, pt, zho, vi, th, ko, tl, sw
};

// Handle 'zh' vs 'zho' alias
translations.zh = translations.zho;

/**
 * Simple translate function for backend
 */
export function t(language: string | undefined | null, key: string, replacements: Record<string, string | number> = {}): string {
    const lang = (language || 'en').split('-')[0] as SupportedLanguage;
    const bundle = translations[lang] || translations.en;
    
    const keys = key.split('.');
    let value: TranslationValue | undefined = bundle;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, TranslationValue>)[k] !== undefined) {
            value = (value as Record<string, TranslationValue>)[k];
        } else {
            // Fallback to English if not found in current language
            if (lang !== 'en') {
                return t('en', key, replacements);
            }
            return key;
        }
    }
    
    if (typeof value !== 'string') return key;
    
    let result = value;
    Object.entries(replacements).forEach(([k, v]) => {
        result = result.split(`{${k}}`).join(String(v));
    });
    
    return result;
}

/**
 * Get an array of translations (for cheers etc)
 */
export function tArray(language: string | undefined | null, key: string): string[] {
    const lang = (language || 'en').split('-')[0] as SupportedLanguage;
    const bundle = translations[lang] || translations.en;
    
    const keys = key.split('.');
    let value: TranslationValue | undefined = bundle;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, TranslationValue>)[k] !== undefined) {
            value = (value as Record<string, TranslationValue>)[k];
        } else {
            if (lang !== 'en') {
                return tArray('en', key);
            }
            return [];
        }
    }
    
    return Array.isArray(value) ? value : [String(value)];
}
