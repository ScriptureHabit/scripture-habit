import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../../src/locales');

type TranslationValue = string | string[] | { [key: string]: TranslationValue };
type TranslationBundle = { [key: string]: TranslationValue };

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

async function loadLocales(): Promise<Record<string, TranslationBundle>> {
    const files = fs.readdirSync(LOCALES_DIR).filter(f => (f.endsWith('.ts') || f.endsWith('.js')) && !f.includes('i18n') && !f.includes('registry') && !f.includes('scripture-metadata'));
    const locales: Record<string, TranslationBundle> = {};

    for (const file of files) {
        const lang = path.basename(file, path.extname(file));
        const filePath = path.join(LOCALES_DIR, file);
        const module = await import(pathToFileURL(filePath).href);
        locales[lang] = module.default || module;
    }

    return locales;
}

async function checkTranslations() {
    console.log('🔍 Checking i18n translation coverage across all locales (src/locales)...\n');

    const locales = await loadLocales();
    const masterLang = 'en';
    const masterObj = locales[masterLang];

    if (!masterObj) {
        console.error(`❌ Master locale (${masterLang}.ts) not found in ${LOCALES_DIR}`);
        process.exit(1);
    }

    const masterKeys = getFlatKeys(masterObj);
    console.log(`📋 Master locale (${masterLang}.ts) has ${masterKeys.length} translation keys.`);
    console.log(`🌐 Found ${Object.keys(locales).length} locales: ${Object.keys(locales).join(', ')}\n`);

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

checkTranslations().catch(err => {
    console.error('Failed to run check-i18n:', err);
    process.exit(1);
});
