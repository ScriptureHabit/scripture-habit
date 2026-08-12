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

const locales: Record<string, TranslationBundle> = {
    en, ja, es, pt, zho, vi, th, ko, tl, sw
};

/**
 * Flattens a nested object into dot-notation keys.
 * Example: { a: { b: "hello" } } => { "a.b": "hello" }
 */
function getFlatKeys(obj: TranslationBundle, prefix = ''): string[] {
    let keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            keys = keys.concat(getFlatKeys(value as TranslationBundle, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

function checkTranslations() {
    console.log('🔍 Checking i18n translation coverage across all locales...\n');

    const masterLang = 'en';
    const masterObj = locales[masterLang];
    const masterKeys = getFlatKeys(masterObj);
    console.log(`📋 Master locale (${masterLang}.ts) has ${masterKeys.length} translation keys.\n`);

    let totalErrors = 0;
    const report: Record<string, string[]> = {};

    for (const [lang, bundle] of Object.entries(locales)) {
        if (lang === masterLang) continue;

        const targetKeys = new Set(getFlatKeys(bundle));
        const missingKeys = masterKeys.filter(k => !targetKeys.has(k));

        if (missingKeys.length > 0) {
            report[lang] = missingKeys;
            totalErrors += missingKeys.length;
        }
    }

    if (totalErrors === 0) {
        console.log('✅ ALL LOCALES ARE 100% COVERED! No missing translation keys found.\n');
        process.exit(0);
    } else {
        console.log(`❌ FOUND ${totalErrors} MISSING TRANSLATION KEYS ACROSS LOCALES:\n`);
        for (const [lang, missing] of Object.entries(report)) {
            console.log(`🌐 [${lang}.ts] Missing ${missing.length} keys:`);
            missing.forEach(key => console.log(`   - ${key}`));
            console.log('');
        }
        process.exit(1);
    }
}

checkTranslations();
