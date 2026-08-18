import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import en from '../src/locales/en';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type TranslationValue = string | string[] | { [key: string]: TranslationValue };

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

const allEnKeys = getKeys(en);

// Hardcoded dynamic domains
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

const srcDir = path.resolve(__dirname, '../src');
const apiDir = path.resolve(__dirname, '../api_internal');
const codeFiles = getSourceFiles([srcDir, apiDir]);

console.log(`🔍 Scanning ${codeFiles.length} source code files across src/ and api_internal/...\n`);

const fileContents = codeFiles.map(file => ({
    file: path.relative(path.resolve(__dirname, '..'), file),
    content: fs.readFileSync(file, 'utf-8')
}));

// Auto-detect dynamic template literals (e.g. t(`browserWarning.howToOpen.${app}`))
const dynamicPrefixRegex = /\bt(?:Array)?\(\s*`([^`\n\r]*?)\$\{/g;
const autoDetectedDynamicPrefixes = new Set<string>();

fileContents.forEach(({ content }) => {
    let match;
    dynamicPrefixRegex.lastIndex = 0;
    while ((match = dynamicPrefixRegex.exec(content)) !== null) {
        const prefix = match[1].trim();
        if (prefix) {
            autoDetectedDynamicPrefixes.add(prefix);
        }
    }
});

const confirmedUnusedKeys: string[] = [];
const dynamicMatchedKeys: { key: string; matchedPrefix: string }[] = [];
const usedKeys = new Set<string>();

for (const key of allEnKeys) {
    if (KNOWN_DYNAMIC_DOMAINS.some(domain => key.startsWith(domain) || key === domain)) {
        continue;
    }

    // 1. Check exact literal occurrence in any file
    let foundLiteral = false;
    for (const { content } of fileContents) {
        if (content.includes(`'${key}'`) || content.includes(`"${key}"`) || content.includes(`\`${key}\``)) {
            foundLiteral = true;
            usedKeys.add(key);
            break;
        }
    }
    if (foundLiteral) continue;

    // 2. Check if matched by dynamic prefix (e.g. browserWarning.howToOpen.*)
    let matchedDynamicPrefix = '';
    for (const prefix of autoDetectedDynamicPrefixes) {
        if (key.startsWith(prefix)) {
            matchedDynamicPrefix = prefix;
            break;
        }
    }

    if (matchedDynamicPrefix) {
        dynamicMatchedKeys.push({ key, matchedPrefix: matchedDynamicPrefix });
    } else {
        confirmedUnusedKeys.push(key);
    }
}

console.log(`📊 Analysis Results:`);
console.log(`- Total Defined Keys: ${allEnKeys.size}`);
console.log(`- Statically Used Keys: ${usedKeys.size}`);
console.log(`- Dynamically Used Keys (via template literals): ${dynamicMatchedKeys.length}`);
console.log(`- 🚨 Confirmed Completely Unused Keys: ${confirmedUnusedKeys.length}\n`);

if (dynamicMatchedKeys.length > 0) {
    console.log(`🔄 === Dynamically Used Keys (Verified Active) ===`);
    dynamicMatchedKeys.forEach(({ key, matchedPrefix }) => {
        console.log(`  - ${key}  (matched: \`${matchedPrefix}\${...}\`)`);
    });
    console.log('');
}

if (confirmedUnusedKeys.length > 0) {
    console.log(`🚨 === Confirmed Unused Keys (No static nor dynamic references found) ===`);
    confirmedUnusedKeys.forEach(k => console.log(`  - ${k}`));
} else {
    console.log(`✅ Awesome! No unused translation keys found.`);
}
