import en from '../src/locales/en';
import ja from '../src/locales/ja';
import es from '../src/locales/es';
import ko from '../src/locales/ko';
import pt from '../src/locales/pt';
import sw from '../src/locales/sw';
import th from '../src/locales/th';
import tl from '../src/locales/tl';
import vi from '../src/locales/vi';
import zho from '../src/locales/zho';

import enBooks from '../src/locales/books/en';
import jaBooks from '../src/locales/books/ja';
import esBooks from '../src/locales/books/es';
import koBooks from '../src/locales/books/ko';
import ptBooks from '../src/locales/books/pt';
import swBooks from '../src/locales/books/sw';
import thBooks from '../src/locales/books/th';
import tlBooks from '../src/locales/books/tl';
import viBooks from '../src/locales/books/vi';
import zhoBooks from '../src/locales/books/zho';

const uiLocales: Record<string, any> = { en, ja, es, ko, pt, sw, th, tl, vi, zho };
const bookLocales: Record<string, any> = { en: enBooks, ja: jaBooks, es: esBooks, ko: koBooks, pt: ptBooks, sw: swBooks, th: thBooks, tl: tlBooks, vi: viBooks, zho: zhoBooks };

function getKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function checkLocales(locales: Record<string, any>, label: string) {
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
}

checkLocales(uiLocales, "UI Locales");
checkLocales(bookLocales, "Book Locales");
