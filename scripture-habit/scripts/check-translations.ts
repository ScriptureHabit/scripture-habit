import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';
import { LANGUAGES } from '../src/config/languages';

type TranslationValue = string | string[] | { [key: string]: TranslationValue };
type TranslationBundle = { [key: string]: TranslationValue };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCALES_DIR = path.resolve(__dirname, '../src/locales');
const BOOKS_DIR = path.resolve(__dirname, '../src/locales/books');

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
  
  // 1. Gather all keys from all locales
  const localeKeysMap: Record<string, string[]> = {};
  const allKeysSet = new Set<string>();
  
  for (const [lang, content] of Object.entries(locales)) {
    const keys = getKeys(content);
    localeKeysMap[lang] = keys;
    keys.forEach(k => allKeysSet.add(k));
  }
  
  const allKeys = Array.from(allKeysSet).sort();
  console.log(`Total unique keys in union: ${allKeys.length}`);
  
  // 2. Find missing keys in each locale
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
    console.log("No missing keys found across all locales!");
  }
  console.log("\n");
  return !hasMissing;
}

async function run() {
  const uiLocales: Record<string, TranslationBundle> = {};
  const bookLocales: Record<string, TranslationBundle> = {};

  for (const langConfig of LANGUAGES) {
    const lang = langConfig.code;
    const uiPath = path.join(LOCALES_DIR, `${lang}.ts`);
    const bookPath = path.join(BOOKS_DIR, `${lang}.ts`);

    if (fs.existsSync(uiPath)) {
      const mod = await import(pathToFileURL(uiPath).href);
      uiLocales[lang] = mod.default;
    }

    if (fs.existsSync(bookPath)) {
      const mod = await import(pathToFileURL(bookPath).href);
      bookLocales[lang] = mod.default;
    }
  }

  const uiOk = checkLocales(uiLocales, "UI Locales");
  const bookOk = checkLocales(bookLocales, "Book Locales");

  if (!uiOk || !bookOk) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Error checking translations:", err);
  process.exit(1);
});
