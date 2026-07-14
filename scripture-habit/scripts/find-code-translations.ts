import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import en from '../src/locales/en';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to flatten translation keys
function getKeys(obj: any, prefix = ''): Set<string> {
  let keys = new Set<string>();
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      const nested = getKeys(obj[key], fullKey);
      nested.forEach(k => keys.add(k));
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

const enKeys = getKeys(en);

// Recursively find files
function getFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        results = results.concat(getFiles(filePath));
      }
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      // Exclude test files if we only want production code, or keep them. Let's keep everything for completeness.
      results.push(filePath);
    }
  });
  return results;
}

const srcDir = path.resolve(__dirname, '../src');
const files = getFiles(srcDir);

const staticKeyRegex = /\bt(?:Array)?\(\s*(['"])([^'"\n\r]+?)\1/g;
const dynamicKeyRegex = /\bt(?:Array)?\(\s*`([^`\n\r]*?(\${.*?})[^`\n\r]*?)`/g;

console.log(`Scanning ${files.length} TypeScript files for translation keys...\n`);

const usedStaticKeys = new Map<string, string[]>(); // key -> files where used
const dynamicCalls: { file: string; line: number; match: string }[] = [];

files.forEach(file => {
  const relativePath = path.relative(path.resolve(__dirname, '..'), file);
  const content = fs.readFileSync(file, 'utf-8');
  
  // Find static keys
  let match;
  staticKeyRegex.lastIndex = 0;
  while ((match = staticKeyRegex.exec(content)) !== null) {
    const key = match[2];
    // Exclude dummy or test keys that are local variables or not actual translation calls
    if (key.includes('.') || key === 'loading' || key === 'cancel' || key === 'close') {
      if (!usedStaticKeys.has(key)) {
        usedStaticKeys.set(key, []);
      }
      usedStaticKeys.get(key)!.push(relativePath);
    }
  }
  
  // Find dynamic keys (template strings with variables)
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    let dynMatch;
    dynamicKeyRegex.lastIndex = 0;
    while ((dynMatch = dynamicKeyRegex.exec(line)) !== null) {
      dynamicCalls.push({
        file: relativePath,
        line: index + 1,
        match: dynMatch[0]
      });
    }
  });
});

console.log("=== DYNAMIC TRANSLATION CALLS (Check Manually) ===");
dynamicCalls.forEach(call => {
  console.log(`${call.file}:${call.line} - ${call.match}`);
});
console.log("\n");

console.log("=== MISSING STATIC TRANSLATION KEYS ===");
let missingCount = 0;

usedStaticKeys.forEach((files, key) => {
  if (!enKeys.has(key)) {
    missingCount++;
    console.log(`Key: "${key}" (used in: ${files.join(', ')})`);
  }
});

if (missingCount === 0) {
  console.log("No missing static translation keys found!");
}
console.log("\n");
