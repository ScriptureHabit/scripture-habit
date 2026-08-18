import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type TranslationValue = string | string[] | { [key: string]: TranslationValue };
type TranslationBundle = { [key: string]: TranslationValue };

const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const SRC_DIR = path.resolve(__dirname, '../src');
const API_DIR = path.resolve(__dirname, '../api_internal');

function getKeys(obj: TranslationValue, prefix = ''): Set<string> {
    const keys = new Set<string>();
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        if (prefix) keys.add(prefix);
        return keys;
    }

    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const nested = getKeys(value, fullKey);
            nested.forEach(k => keys.add(k));
        } else {
            keys.add(fullKey);
        }
    }
    return keys;
}

function getSourceFiles(dirs: string[]): string[] {
    let results: string[] = [];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) return;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'locales') {
                    results = results.concat(getSourceFiles([filePath]));
                }
            } else if (/\.(ts|tsx|js|jsx)$/.test(filePath) && !filePath.includes('.test.')) {
                results.push(filePath);
            }
        });
    });
    return results;
}

const KNOWN_DYNAMIC_DOMAINS = [
    '_meta',
    'books.',
    'scriptures.',
    'languages.',
    'apiErrors.',
    'noteLabels.',
    'placeholders.',
    'groupChat.typeMessage'
];

type TranslationTree = { [key: string]: TranslationValue };

function deleteKeyByPath(obj: TranslationTree, keyPath: string): boolean {
    const parts = keyPath.split('.');
    let current: TranslationTree = obj;
    const stack: { parent: TranslationTree; key: string }[] = [];

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const next = current[part];
        if (!next || typeof next !== 'object' || Array.isArray(next)) {
            return false;
        }
        stack.push({ parent: current, key: part });
        current = next as TranslationTree;
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart in current) {
        delete current[lastPart];

        // Clean up empty objects upwards
        for (let i = stack.length - 1; i >= 0; i--) {
            const { parent, key } = stack[i];
            const parentChild = parent[key];
            if (parentChild && typeof parentChild === 'object' && !Array.isArray(parentChild) && Object.keys(parentChild).length === 0) {
                delete parent[key];
            }
        }
        return true;
    }
    return false;
}

async function run() {
    const isDryRun = process.argv.includes('--dry-run');

    console.log(`🔍 Scanning codebase to identify unused translation keys...`);
    const codeFiles = getSourceFiles([SRC_DIR, API_DIR]);
    const fileContents = codeFiles.map(file => fs.readFileSync(file, 'utf-8'));

    // Scan dynamic template prefixes
    const dynamicPrefixRegex = /\bt(?:Array)?\(\s*`([^`\n\r]*?)\$\{/g;
    const autoDetectedDynamicPrefixes = new Set<string>();

    fileContents.forEach(content => {
        let match;
        dynamicPrefixRegex.lastIndex = 0;
        while ((match = dynamicPrefixRegex.exec(content)) !== null) {
            const prefix = match[1].trim();
            if (prefix) autoDetectedDynamicPrefixes.add(prefix);
        }
    });

    // Load en.ts to detect master unused keys
    const enModule = await import(pathToFileURL(path.join(LOCALES_DIR, 'en.ts')).href);
    const en = enModule.default || enModule;
    const allEnKeys = getKeys(en);

    const unusedKeys: string[] = [];

    for (const key of allEnKeys) {
        if (KNOWN_DYNAMIC_DOMAINS.some(domain => key.startsWith(domain) || key === domain)) {
            continue;
        }

        let found = false;
        for (const content of fileContents) {
            if (content.includes(`'${key}'`) || content.includes(`"${key}"`) || content.includes(`\`${key}\``)) {
                found = true;
                break;
            }
        }
        if (found) continue;

        if (Array.from(autoDetectedDynamicPrefixes).some(p => key.startsWith(p))) {
            continue;
        }

        unusedKeys.push(key);
    }

    console.log(`\n🚨 Found ${unusedKeys.length} unused keys to remove:\n`);
    unusedKeys.forEach(k => console.log(`  - ${k}`));

    if (unusedKeys.length === 0) {
        console.log(`\n✅ No unused keys to clean up.`);
        return;
    }

    if (isDryRun) {
        console.log(`\n[DRY RUN] No files modified. Run without --dry-run to apply removals.`);
        return;
    }

    console.log(`\n🧹 Cleaning unused keys from all locale files in src/locales/ ...`);

    const localeFiles = fs.readdirSync(LOCALES_DIR).filter(f => (f.endsWith('.ts') || f.endsWith('.js')) && !f.includes('i18n') && !f.includes('registry'));

    for (const file of localeFiles) {
        const filePath = path.join(LOCALES_DIR, file);
        const mod = await import(pathToFileURL(filePath).href);
        const bundle: TranslationBundle = JSON.parse(JSON.stringify(mod.default || mod));

        let removedCount = 0;
        for (const key of unusedKeys) {
            if (deleteKeyByPath(bundle as TranslationTree, key)) {
                removedCount++;
            }
        }

        const formatted = `export default ${JSON.stringify(bundle, null, 4)};\n`;
        fs.writeFileSync(filePath, formatted, 'utf-8');
        console.log(`  ✓ ${file}: removed ${removedCount} unused keys`);
    }

    console.log(`\n🎉 Successfully cleaned all unused translation keys across all locales!`);
}

run().catch(err => {
    console.error('Error during cleanup:', err);
    process.exit(1);
});
