import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const LOCALES_DIR = path.resolve(ROOT_DIR, 'src/locales');
const SRC_DIR = path.resolve(ROOT_DIR, 'src');

type TranslationValue = string | string[] | { [key: string]: TranslationValue };
type TranslationBundle = { [key: string]: TranslationValue };

function flatten(obj: TranslationBundle, prefix = ''): Record<string, TranslationValue> {
    const result: Record<string, TranslationValue> = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flatten(value as TranslationBundle, fullKey));
        } else {
            result[fullKey] = value;
        }
    }
    return result;
}

async function loadAllLocales() {
    const files = fs.readdirSync(LOCALES_DIR).filter(f => 
        (f.endsWith('.ts') || f.endsWith('.js')) && 
        !['i18n.ts', 'registry.ts', 'scripture-metadata.ts', 'initial-translations.ts'].includes(f)
    );
    const locales: Record<string, { flat: Record<string, TranslationValue>; raw: TranslationBundle }> = {};

    for (const file of files) {
        const lang = path.basename(file, path.extname(file));
        const filePath = path.join(LOCALES_DIR, file);
        const mod = await import(pathToFileURL(filePath).href);
        const raw = mod.default || mod;
        locales[lang] = {
            raw,
            flat: flatten(raw)
        };
    }
    return locales;
}

function extractPlaceholders(val: TranslationValue): string[] {
    const text = Array.isArray(val) ? val.join(' ') : String(val);
    const matches = text.match(/\{[a-zA-Z0-9_]+\}/g);
    return matches ? Array.from(new Set(matches)).sort() : [];
}

function extractTags(val: TranslationValue): string[] {
    const text = Array.isArray(val) ? val.join(' ') : String(val);
    const matches = text.match(/<\/?[a-zA-Z0-9]+[^>]*>/g);
    return matches ? Array.from(new Set(matches)).sort() : [];
}

const ALLOWED_IDENTICAL = new Set([
    'Scripture Habit', 'LINE', 'Discord', 'URL', 'Email', 'PWA', 'OK', 'ID', 'FAQ', 'JSON', 'CSV',
    'Google', 'Apple', 'Android', 'iOS', 'Web', 'X (Twitter)', 'Twitter', 'X', 'SMS', 'PRO',
    ':', '•', '/', '-', '—', '|', '...', 'VS', 'vs'
]);

function scanDir(dir: string, fileList: string[] = []): string[] {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (['node_modules', 'locales', 'dist', '.git', 'types'].includes(item)) continue;
            scanDir(fullPath, fileList);
        } else if (/\.(tsx|ts|jsx|js)$/.test(item) && !item.includes('.test.') && !item.includes('.spec.')) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

async function runAnalysis() {
    console.log('====================================================');
    console.log('📊 COMPREHENSIVE I18N AUDIT & MISMATCH CHECK');
    console.log('====================================================\n');

    const locales = await loadAllLocales();
    const langCodes = Object.keys(locales);
    const en = locales['en'];
    const enFlat = en.flat;

    const reportData = {
        reverseMissing: {} as Record<string, string[]>,
        forwardMissing: {} as Record<string, string[]>,
        placeholderMismatches: [] as Array<{
            key: string;
            lang: string;
            enVal: unknown;
            targetVal: unknown;
            enVars: string[];
            targetVars: string[];
            missingInTarget: string[];
            extraInTarget: string[];
        }>,
        tagMismatches: [] as Array<{
            key: string;
            lang: string;
            enTags: string[];
            targetTags: string[];
            missingInTarget: string[];
            extraInTarget: string[];
        }>,
        typeMismatches: [] as Array<{
            key: string;
            lang: string;
            enType: string;
            targetType: string;
            enLength?: number;
            targetLength?: number;
        }>,
        identicalToEn: {} as Record<string, Array<{ key: string; val: string }>>,
        hardcodedJapanese: [] as Array<{ file: string; line: number; text: string }>
    };

    // 1. Reverse missing
    for (const lang of langCodes) {
        if (lang === 'en') continue;
        const missingInEn = Object.keys(locales[lang].flat).filter(k => !(k in enFlat));
        if (missingInEn.length > 0) reportData.reverseMissing[lang] = missingInEn;
    }

    // 2. Forward missing
    for (const lang of langCodes) {
        if (lang === 'en') continue;
        const missing = Object.keys(enFlat).filter(k => !(k in locales[lang].flat));
        if (missing.length > 0) reportData.forwardMissing[lang] = missing;
    }

    // 3. Placeholders & Tags
    for (const [key, enVal] of Object.entries(enFlat)) {
        if (key.startsWith('_meta')) continue;
        const enPlaceholders = extractPlaceholders(enVal);
        const enTags = extractTags(enVal);

        for (const lang of langCodes) {
            if (lang === 'en') continue;
            const targetVal = locales[lang].flat[key];
            if (targetVal === undefined) continue;

            const targetPlaceholders = extractPlaceholders(targetVal);
            const missingInTarget = enPlaceholders.filter(p => !targetPlaceholders.includes(p));
            const extraInTarget = targetPlaceholders.filter(p => !enPlaceholders.includes(p));

            if (missingInTarget.length > 0 || extraInTarget.length > 0) {
                reportData.placeholderMismatches.push({
                    key,
                    lang,
                    enVal,
                    targetVal,
                    enVars: enPlaceholders,
                    targetVars: targetPlaceholders,
                    missingInTarget,
                    extraInTarget
                });
            }

            const targetTags = extractTags(targetVal);
            const missingTags = enTags.filter(t => !targetTags.includes(t));
            const extraTags = targetTags.filter(t => !enTags.includes(t));
            if (missingTags.length > 0 || extraTags.length > 0) {
                reportData.tagMismatches.push({
                    key,
                    lang,
                    enTags,
                    targetTags,
                    missingInTarget: missingTags,
                    extraInTarget: extraTags
                });
            }
        }
    }

    // 4. Type & length
    for (const [key, enVal] of Object.entries(enFlat)) {
        const isEnArray = Array.isArray(enVal);
        for (const lang of langCodes) {
            if (lang === 'en') continue;
            const targetVal = locales[lang].flat[key];
            if (targetVal === undefined) continue;
            const isTargetArray = Array.isArray(targetVal);

            if (isEnArray !== isTargetArray) {
                reportData.typeMismatches.push({
                    key,
                    lang,
                    enType: isEnArray ? 'array' : typeof enVal,
                    targetType: isTargetArray ? 'array' : typeof targetVal
                });
            } else if (isEnArray && isTargetArray) {
                if ((enVal as string[]).length !== (targetVal as string[]).length) {
                    reportData.typeMismatches.push({
                        key,
                        lang,
                        enType: 'array',
                        targetType: 'array',
                        enLength: (enVal as string[]).length,
                        targetLength: (targetVal as string[]).length
                    });
                }
            }
        }
    }

    // 5. Identical to English
    for (const lang of langCodes) {
        if (lang === 'en') continue;
        const untranslated: { key: string; val: string }[] = [];
        for (const [key, enVal] of Object.entries(enFlat)) {
            if (key.startsWith('_meta') || key.startsWith('languages.') || key.startsWith('scriptures.')) continue;
            const targetVal = locales[lang].flat[key];
            if (typeof enVal === 'string' && typeof targetVal === 'string') {
                const trimmed = enVal.trim();
                if (trimmed === targetVal.trim() && trimmed.length > 3 && !ALLOWED_IDENTICAL.has(trimmed) && /[a-zA-Z]{3,}/.test(trimmed)) {
                    if (!trimmed.startsWith('http') && !trimmed.includes('@') && !trimmed.startsWith('https:')) {
                        untranslated.push({ key, val: trimmed });
                    }
                }
            }
        }
        if (untranslated.length > 0) {
            reportData.identicalToEn[lang] = untranslated;
        }
    }

    // 6. Hardcoded Japanese
    const srcFiles = scanDir(SRC_DIR);
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
    for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
            if (trimmed.includes('console.log') || trimmed.includes('console.warn') || trimmed.includes('console.error')) return;
            if (japaneseRegex.test(line)) {
                reportData.hardcodedJapanese.push({
                    file: path.relative(ROOT_DIR, file),
                    line: idx + 1,
                    text: trimmed.length > 100 ? trimmed.substring(0, 100) + '...' : trimmed
                });
            }
        });
    }

    if (!fs.existsSync(path.resolve(ROOT_DIR, 'scratch'))) {
        fs.mkdirSync(path.resolve(ROOT_DIR, 'scratch'), { recursive: true });
    }
    const reportPath = path.resolve(ROOT_DIR, 'scratch/i18n-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf-8');
    console.log(`📄 Detailed report saved to ${path.relative(ROOT_DIR, reportPath)}`);

    console.log('\n--- AUDIT SUMMARY ---');
    console.log(`1. Reverse Missing Keys (in other locales, not in en): ${Object.keys(reportData.reverseMissing).length === 0 ? '✅ 0 (Clean)' : JSON.stringify(reportData.reverseMissing, null, 2)}`);
    console.log(`2. Forward Missing Keys (in en, not in other locales): ${Object.keys(reportData.forwardMissing).length === 0 ? '✅ 0 (Clean)' : JSON.stringify(reportData.forwardMissing, null, 2)}`);
    console.log(`3. Placeholder Mismatches: ${reportData.placeholderMismatches.length === 0 ? '✅ 0' : `⚠️ ${reportData.placeholderMismatches.length}`}`);
    console.log(`4. Tag Mismatches: ${reportData.tagMismatches.length === 0 ? '✅ 0' : `⚠️ ${reportData.tagMismatches.length}`}`);
    console.log(`5. Type / Length Mismatches: ${reportData.typeMismatches.length === 0 ? '✅ 0' : `⚠️ ${reportData.typeMismatches.length}`}`);
    console.log(`6. Potential Untranslated English in Locales:`);
    for (const [lang, items] of Object.entries(reportData.identicalToEn)) {
        console.log(`   - [${lang}]: ${items.length} items`);
    }
    console.log(`7. Hardcoded Japanese text lines in src/: ⚠️ ${reportData.hardcodedJapanese.length}`);
}

runAnalysis().catch(err => {
    console.error('Audit failed:', err);
});
