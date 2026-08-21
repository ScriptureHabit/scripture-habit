import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';

type TranslationValue = string | string[] | { [key: string]: TranslationValue };
type TranslationBundle = { [key: string]: TranslationValue };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCALES_DIR = path.resolve(__dirname, '../src/locales');

function getKeys(obj: TranslationValue, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }

  let keys: string[] = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(getKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function checkLocales(locales: Record<string, TranslationBundle>, label: string) {
  console.log(`=== Checking ${label} ===`);
  
  const localeKeysMap: Record<string, string[]> = {};
  const allKeysSet = new Set<string>();
  
  for (const [lang, content] of Object.entries(locales)) {
    const keys = getKeys(content);
    localeKeysMap[lang] = keys;
    keys.forEach(k => allKeysSet.add(k));
  }
  
  const allKeys = Array.from(allKeysSet).sort();
  console.log(`Total unique keys in union: ${allKeys.length}`);
  
  let hasMissing = false;
  for (const [lang, keys] of Object.entries(localeKeysMap)) {
    const definedKeys = new Set(keys);
    const missingKeys = allKeys.filter(k => !definedKeys.has(k));
    
    if (missingKeys.length > 0) {
      hasMissing = true;
      console.log(`\nLanguage [${lang}] is missing ${missingKeys.length} keys:`);
      missingKeys.forEach(k => console.log(`  - ${k}`));
    }
  }
  
  if (!hasMissing) {
    console.log("✅ No missing keys found across all locales!");
  }
  console.log("\n");
  return !hasMissing;
}

async function run() {
  const files = fs.readdirSync(LOCALES_DIR).filter(f => (f.endsWith('.ts') || f.endsWith('.js')) && !f.includes('i18n') && !f.includes('registry'));
  const locales: Record<string, TranslationBundle> = {};

  for (const file of files) {
    const lang = path.basename(file, path.extname(file));
    const filePath = path.join(LOCALES_DIR, file);
    const mod = await import(pathToFileURL(filePath).href);
    locales[lang] = mod.default || mod;
  }

  const ok = checkLocales(locales, "All Locales");
  if (!ok) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Error checking translations:", err);
  process.exit(1);
});
