/**
 * Translation helpers and utilities for NoteDisplay and Gospel Library links.
 * Dynamically constructed from locale definitions (SSOT) adhering to DRY principles.
 */

import { SCRIPTURE_TRANSLATION_MAP } from '../../../data/data.js';
import { ALL_LOCALES, LOCALES_BY_CODE } from '../../../locales/registry.js';

/**
 * Returns localized label fallback from the locale registry if missing or defaulted.
 */
export const getNoteLabelFallback = (key: string, lang: string, originalVal: string): string => {
    const isEnglishKey = /Category|Chapter|Comment|Scripture|Talk|Speech|Title/.test(originalVal);
    
    // Only apply fallback if the value is missing or defaulted to English in a non-English context
    if (lang !== 'en' && (originalVal === key || isEnglishKey)) {
        const subKey = key.replace(/^noteLabels\./, '');
        const locale = LOCALES_BY_CODE[lang];
        const fallback = locale?.noteLabels?.[subKey];
        if (typeof fallback === 'string' && fallback.length > 0) {
            return fallback;
        }
    }
    return originalVal;
};

/**
 * Dynamically constructed reverse lookup map from localized scripture names to i18n keys (e.g. "旧約聖書" -> "scriptures.oldTestament").
 */
const SCRIPTURE_NAME_TO_I18N_KEY: Record<string, string> = {
    ...SCRIPTURE_TRANSLATION_MAP
};

for (const locale of ALL_LOCALES) {
    if (locale.scriptures && typeof locale.scriptures === 'object') {
        for (const [key, localizedName] of Object.entries(locale.scriptures)) {
            if (typeof localizedName === 'string' && localizedName.trim().length > 0) {
                SCRIPTURE_NAME_TO_I18N_KEY[localizedName.trim()] = `scriptures.${key}`;
            }
        }
    }
}

const ONE_TAP_STUDY_NAMES = new Set<string>([
    'onetap', 'one tap', 'one-tap', 'one_tap',
    'themestudy', 'theme study', 'theme_study', 'theme-study',
    ...ALL_LOCALES.map(l => l.oneTapStudy?.categoryOneTap?.toLowerCase().trim()).filter((v): v is string => Boolean(v))
]);

export const isOneTapCategory = (scriptureName?: string | null): boolean => {
    if (!scriptureName) return false;
    const lower = scriptureName.toLowerCase().trim();
    return ONE_TAP_STUDY_NAMES.has(lower);
};

export const isFamilyStudyCategory = isOneTapCategory;

const THEME_NAME_TO_ID: Record<string, string> = {};

for (const locale of ALL_LOCALES) {
    const themes = locale.oneTapStudy?.themes;
    if (themes && typeof themes === 'object') {
        for (const [id, localizedName] of Object.entries(themes)) {
            if (typeof localizedName === 'string' && localizedName.trim().length > 0) {
                THEME_NAME_TO_ID[localizedName.trim().toLowerCase()] = id;
                THEME_NAME_TO_ID[id.toLowerCase()] = id;
            }
        }
    }
}

export const resolveThemeId = (themeNameOrId?: string | null): string => {
    if (!themeNameOrId) return '';
    const trimmed = themeNameOrId.trim();
    const lower = trimmed.toLowerCase();
    return THEME_NAME_TO_ID[lower] || THEME_NAME_TO_ID[trimmed] || trimmed;
};

/**
 * Dynamically generated regex patterns from locale dictionaries (ALL_LOCALES) to detect
 * auto-generated one-tap study boilerplate comments without hardcoded language phrases.
 */
const ONE_TAP_COMMENT_PATTERNS: RegExp[] = ALL_LOCALES.map(locale => {
    const template = locale.oneTapStudy?.noteBody;
    if (!template || !template.includes('{theme}')) return null;
    const parts = template
        .split('{theme}')
        .map((p: string) => p.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .filter(Boolean);
    return new RegExp(parts.join('.*'), 'i');
}).filter((re): re is RegExp => re !== null);

export const isOneTapComment = (comment: string): boolean => {
    if (!comment) return true;
    const c = comment.trim();
    return ONE_TAP_COMMENT_PATTERNS.some(pattern => pattern.test(c));
};

export const isFamilyStudyComment = isOneTapComment;


/**
 * Translates a localized or English scripture category name into current user language using t().
 */
export const translateScriptureName = (name: string, t: (key: string) => string): string => {
    if (!name) return '';
    if (isOneTapCategory(name)) {
        return t('oneTapStudy.categoryOneTap') || name;
    }
    const key = SCRIPTURE_NAME_TO_I18N_KEY[name.trim()];
    return key ? t(key) : name;
};


// Sets of keywords for category type detection across all supported languages
const OTHER_SCRIPTURE_NAMES = new Set<string>([
    'other', '(other)', 'others', '(others)',
    ...ALL_LOCALES.flatMap(l => {
        const o = l.scriptures?.other?.toLowerCase().trim();
        return o ? [o, `(${o})`] : [];
    })
]);

const GENERAL_CONFERENCE_NAMES = new Set<string>([
    'general conference', 'general', 'conference', 'gc',
    ...ALL_LOCALES.map(l => l.scriptures?.generalConference?.toLowerCase().trim()).filter((v): v is string => Boolean(v))
]);

const BYU_SPEECHES_NAMES = new Set<string>([
    'byu speeches', 'byu', 'speeches',
    ...ALL_LOCALES.map(l => l.scriptures?.byuSpeeches?.toLowerCase().trim()).filter((v): v is string => Boolean(v))
]);

/**
 * Checks if a scripture category string represents "Other" / "Uncategorized".
 */
export const isOtherCategory = (scriptureName?: string | null): boolean => {
    if (!scriptureName) return true;
    const lower = scriptureName.toLowerCase().trim();
    if (!lower) return true;
    return OTHER_SCRIPTURE_NAMES.has(lower) || Array.from(OTHER_SCRIPTURE_NAMES).some(name => lower.includes(name));
};

/**
 * Checks if a scripture category string represents General Conference.
 */
const isGeneralConference = (scriptureName?: string | null): boolean => {
    if (!scriptureName) return false;
    const lower = scriptureName.toLowerCase().trim();
    return Array.from(GENERAL_CONFERENCE_NAMES).some(name => lower.includes(name));
};

/**
 * Checks if a scripture category string represents BYU Speeches.
 */
export const isByuSpeeches = (scriptureName?: string | null): boolean => {
    if (!scriptureName) return false;
    const lower = scriptureName.toLowerCase().trim();
    return Array.from(BYU_SPEECHES_NAMES).some(name => lower.includes(name));
};

/**
 * Checks if a note source is a special talk source (General Conference, BYU Speeches, or Other).
 */
export const isSpecialTalkSource = (scriptureName?: string | null): boolean => {
    if (!scriptureName) return true;
    return isGeneralConference(scriptureName) || isByuSpeeches(scriptureName) || isOtherCategory(scriptureName);
};

// Common symbol/punctuation placeholders
const SYMBOL_PLACEHOLDERS = ['-', 'ー', '–', '—', 'none', 'n/a', 'unknown', 'uncategorized'];

// Dynamically collected from all locale files (including parenthesized variants)
const BASE_PLACEHOLDERS = new Set<string>([
    ...SYMBOL_PLACEHOLDERS,
    ...ALL_LOCALES.flatMap(locale => {
        const words = [
            ...(locale.placeholders ? Object.values(locale.placeholders) : []),
            locale.scriptures?.other
        ].filter((w): w is string => typeof w === 'string' && w.trim().length > 0);

        return words.flatMap(w => {
            const lower = w.toLowerCase().trim();
            return [lower, `(${lower})`];
        });
    })
]);

/**
 * Checks if a value is a placeholder that should be hidden (e.g., "(未分類)", "-", "Unclassified", "Other").
 */
export const isPlaceholderValue = (value: string | undefined): boolean => {
    if (!value) return true;
    const v = value.trim().toLowerCase();
    if (!v || BASE_PLACEHOLDERS.has(v) || OTHER_SCRIPTURE_NAMES.has(v)) {
        return true;
    }
    return false;
};
