import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { SupportedLanguage } from './schemas.js';

type TranslationValue = string | string[] | { [key: string]: TranslationValue };
type TranslationBundle = { [key: string]: TranslationValue };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../../src/locales');

// Auto-discover and dynamically load all locales from single source of truth (src/locales)
const files = fs.readdirSync(LOCALES_DIR).filter(f => (f.endsWith('.ts') || f.endsWith('.js')) && !f.includes('i18n'));
const translations: Record<string, TranslationBundle> = {};

for (const file of files) {
    const lang = path.basename(file, path.extname(file));
    const filePath = path.join(LOCALES_DIR, file);
    const mod = await import(pathToFileURL(filePath).href);
    translations[lang] = mod.default || mod;
}

// Handle 'zh' vs 'zho' alias
if (translations.zho) {
    translations.zh = translations.zho;
}

/**
 * Simple translate function for backend
 */
export function t(language: string | undefined | null, key: string, replacements: Record<string, string | number> = {}): string {
    const lang = (language || 'en').split('-')[0] as SupportedLanguage;
    const bundle = translations[lang] || translations.en;
    
    const keys = key.split('.');
    let value: TranslationValue | undefined = bundle;
    
    for (const k of keys) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
            return key;
        }
        if (value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, k)) {
            value = (value as Record<string, TranslationValue>)[k]; // nosemgrep: javascript.lang.security.audit.prototype-pollution.prototype-pollution-loop.prototype-pollution-loop
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
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
            return [];
        }
        if (value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, k)) {
            value = (value as Record<string, TranslationValue>)[k]; // nosemgrep: javascript.lang.security.audit.prototype-pollution.prototype-pollution-loop.prototype-pollution-loop
        } else {
            if (lang !== 'en') {
                return tArray('en', key);
            }
            return [];
        }
    }
    
    if (Array.isArray(value)) {
        return value.map(v => String(v));
    }
    
    if (typeof value === 'string') {
        return [value];
    }

    return [];
}

/**
 * Generates pre-baked translations dictionary for the Demo Group from single source of truth (locales).
 * Defaults to the user's specific language to avoid storing massive 10-language dictionaries on Firestore documents.
 */
export function getDemoGroupTranslations(lang: string = 'ja'): Record<string, { name: string; description: string }> {
    return {
        [lang]: {
            name: t(lang, 'onboardingQuest.demoGroupName') || '日々の糧 📖',
            description: t(lang, 'onboardingQuest.demoGroupDesc') || '毎日一緒に聖典を読み合う、温かい学習グループです！✨'
        }
    };
}

/**
 * Generates pre-baked translations dictionary for the AI Group from single source of truth (locales).
 * Defaults to the user's specific language to avoid storing massive 10-language dictionaries on Firestore documents.
 */
export function getAiGroupTranslations(lang: string = 'ja'): Record<string, { name: string; description: string }> {
    return {
        [lang]: {
            name: t(lang, 'groupChat.aiGroupDefaultGroupName') || (lang === 'ja' ? 'スクハビAI' : 'Scripture Habit AI'),
            description: t(lang, 'groupChat.aiGroupDefaultGroupDesc') || '1-on-1 Scripture Study Group with Scripture Habit AI'
        }
    };
}


