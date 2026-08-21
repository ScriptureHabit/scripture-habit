import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../../src/locales');

type NestedRecord = Record<string, unknown>;

function reorderKeys(target: unknown, template: unknown): unknown {
    if (typeof target !== 'object' || target === null || Array.isArray(target)) {
        return target;
    }
    const targetObj = target as NestedRecord;
    const templateObj = (typeof template === 'object' && template !== null && !Array.isArray(template))
        ? (template as NestedRecord)
        : {};

    const result: NestedRecord = {};

    // 1. Follow exact template key ordering
    for (const key of Object.keys(templateObj)) {
        if (key in targetObj) {
            result[key] = reorderKeys(targetObj[key], templateObj[key]);
        }
    }

    // 2. Append any extra keys
    for (const key of Object.keys(targetObj)) {
        if (!(key in result)) {
            result[key] = targetObj[key];
        }
    }

    return result;
}

async function sortAllLocales() {
    const enPath = path.join(LOCALES_DIR, 'en.ts');
    const enModule = await import(pathToFileURL(enPath).href);
    const en = enModule.default || enModule;

    const files = fs.readdirSync(LOCALES_DIR).filter(f => (f.endsWith('.ts') || f.endsWith('.js')) && !f.includes('i18n') && !f.includes('registry') && !f.includes('scripture-metadata'));

    for (const file of files) {
        const filePath = path.join(LOCALES_DIR, file);
        const mod = await import(pathToFileURL(filePath).href);
        const data = mod.default || mod;

        const sorted = reorderKeys(data, en);
        const content = `export default ${JSON.stringify(sorted, null, 4)};\n`;
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Sorted and formatted ${file}`);
    }
}

sortAllLocales().catch(console.error);
