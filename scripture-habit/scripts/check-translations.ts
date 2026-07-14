import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// Relative path to locales from the scripts folder
const localesDir = path.join(import.meta.dirname, '../src/locales');
const booksDir = path.join(localesDir, 'books');
const srcDir = path.join(import.meta.dirname, '../src');

const LANGUAGES = ['en', 'ja', 'es', 'ko', 'pt', 'sw', 'th', 'tl', 'vi', 'zho'];

// Helper to flatten nested translation objects
function getFlatKeys(obj: unknown, prefix = ''): string[] {
  let keys: string[] = [];
  if (!obj || typeof obj !== 'object') return keys;
  
  const record = obj as Record<string, unknown>;
  for (const key in record) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof record[key] === 'object' && record[key] !== null && !Array.isArray(record[key])) {
      keys = keys.concat(getFlatKeys(record[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Helper to walk directory recursively, ignoring specified dirs
function walkDir(dir: string, callback: (filePath: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      // Ignore locales, mocks, test directories, and dot folders
      if (
        file !== 'node_modules' && 
        file !== '.git' && 
        file !== 'locales' && 
        file !== 'mocks' && 
        file !== '__tests__' && 
        file !== 'coverage' &&
        !file.startsWith('.')
      ) {
        walkDir(filePath, callback);
      }
    } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
      // Ignore spec and test files
      if (!/\.(spec|test)\.ts[x]?$/.test(file)) {
        callback(filePath);
      }
    }
  }
}

async function main() {
  console.log('==================================================');
  console.log('🔍 Starting Translation Key Verification Script...');
  console.log('==================================================\n');

  // 1. Load baseline (English)
  let enLocale: Record<string, unknown>;
  let enBooks: Record<string, unknown>;
  try {
    enLocale = (await import(pathToFileURL(path.join(localesDir, 'en.ts')).href)).default;
    enBooks = (await import(pathToFileURL(path.join(booksDir, 'en.ts')).href)).default;
  } catch (err) {
    console.error('❌ Failed to load baseline English locale files:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const enKeys = new Set(getFlatKeys(enLocale));
  const enBookKeys = new Set(getFlatKeys(enBooks));

  console.log(`Baseline Loaded (en):`);
  console.log(`- Main translation keys: ${enKeys.size}`);
  console.log(`- Book translation keys: ${enBookKeys.size}\n`);

  // 2. Compare other languages against baseline
  console.log('--- 1. Comparing Language Files (against English baseline) ---');
  for (const lang of LANGUAGES) {
    if (lang === 'en') continue;

    try {
      const locale = (await import(pathToFileURL(path.join(localesDir, `${lang}.ts`)).href)).default;
      const books = (await import(pathToFileURL(path.join(booksDir, `${lang}.ts`)).href)).default;

      const langKeys = new Set(getFlatKeys(locale));
      const langBookKeys = new Set(getFlatKeys(books));

      const missingMain: string[] = [];
      const extraMain: string[] = [];
      const missingBooks: string[] = [];
      const extraBooks: string[] = [];

      // Main translations check
      for (const key of enKeys) {
        if (!langKeys.has(key)) missingMain.push(key);
      }
      for (const key of langKeys) {
        if (!enKeys.has(key)) extraMain.push(key);
      }

      // Books check
      for (const key of enBookKeys) {
        if (!langBookKeys.has(key)) missingBooks.push(key);
      }
      for (const key of langBookKeys) {
        if (!enBookKeys.has(key)) extraBooks.push(key);
      }

      const totalIssues = missingMain.length + extraMain.length + missingBooks.length + extraBooks.length;
      if (totalIssues > 0) {
        console.log(`\n🌐 Language: [${lang.toUpperCase()}] - Found ${totalIssues} issue(s)`);
        if (missingMain.length > 0) {
          console.log(`  ❌ Missing Main Keys (${missingMain.length}):`);
          missingMain.forEach(k => console.log(`     - ${k}`));
        }
        if (extraMain.length > 0) {
          console.log(`  ⚠️ Extra Main Keys (${extraMain.length}):`);
          extraMain.forEach(k => console.log(`     - ${k}`));
        }
        if (missingBooks.length > 0) {
          console.log(`  ❌ Missing Book Keys (${missingBooks.length}):`);
          missingBooks.forEach(k => console.log(`     - ${k}`));
        }
        if (extraBooks.length > 0) {
          console.log(`  ⚠️ Extra Book Keys (${extraBooks.length}):`);
          extraBooks.forEach(k => console.log(`     - ${k}`));
        }
      } else {
        console.log(`🌐 Language: [${lang.toUpperCase()}] - Perfect match!`);
      }

    } catch (err) {
      console.error(`❌ Failed to load locale files for [${lang}]:`, err instanceof Error ? err.message : String(err));
    }
  }

  // 3. Scan codebase for translations usage
  console.log('\n--- 2. Scanning Codebase (src/ excluding locales, tests, mocks) ---');
  const staticKeys = new Set<string>();
  let allCodeText = '';
  let checkedFilesCount = 0;

  // Regular expression to catch t('key') or t("key") or t(`key`) without variables inside
  // Ensure the string ends with a closing paren or a comma to avoid catching dynamic concatenations like t('languages.' + lang)
  const tPattern = /\bt\(\s*['"`]([a-zA-Z0-9_\-?!.]+)['"`]\s*[),]/g;

  walkDir(srcDir, (filePath) => {
    checkedFilesCount++;
    const content = fs.readFileSync(filePath, 'utf-8');
    allCodeText += ' ' + content; // Combine all source code text for dynamic matching fallback

    let match;
    while ((match = tPattern.exec(content)) !== null) {
      staticKeys.add(match[1]);
    }
  });

  console.log(`Scanned ${checkedFilesCount} files. Found ${staticKeys.size} unique keys statically referenced via t().`);

  // 4. Match codebase keys against English baseline
  const missingInTranslations: string[] = [];
  const unusedInCode: string[] = [];
  const likelyDynamicKeys: string[] = [];

  // Find missing keys (used in code, but not in baseline)
  for (const key of staticKeys) {
    if (!enKeys.has(key)) {
      missingInTranslations.push(key);
    }
  }

  // Find unused keys (in baseline, but not statically used in code)
  for (const key of enKeys) {
    if (!staticKeys.has(key)) {
      // Fallback check to avoid false positives for dynamically constructed keys (e.g. apiErrors.* or dynamic config)
      // Check if the full key or the last segment appears somewhere in the codebase
      const parts = key.split('.');
      const lastSegment = parts[parts.length - 1];

      // Check if full key is in code, or if the last segment is in code
      // We only match lastSegment if it is long enough (>= 4 chars) or uppercase (often error codes/constants) to prevent false hits
      const isWordInCode = (word: string) => {
        // eslint-disable-next-line no-useless-escape
        const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`);
        return regex.test(allCodeText);
      };

      const hasFullKeyInCode = allCodeText.includes(key);
      const isLastSegmentSymbol = /^[A-Z0-9_-]+$/.test(lastSegment) || lastSegment.length >= 4;
      const hasLastSegmentInCode = isLastSegmentSymbol && isWordInCode(lastSegment);

      if (hasFullKeyInCode || hasLastSegmentInCode) {
        likelyDynamicKeys.push(key);
      } else {
        unusedInCode.push(key);
      }
    }
  }

  // Print results
  console.log('\n--- 3. Codebase vs Translation File Discrepancies ---');
  
  if (missingInTranslations.length > 0) {
    console.log(`\n❌ Keys used in code but MISSING in baseline en.ts (${missingInTranslations.length}):`);
    missingInTranslations.forEach(k => console.log(`   - ${k}`));
  } else {
    console.log('\n✅ No missing keys found in code! All static t() calls are defined in en.ts.');
  }

  if (unusedInCode.length > 0) {
    console.log(`\n⚠️ Keys defined in en.ts but UNUSED in code (${unusedInCode.length}):`);
    console.log('   (These keys do not appear as static t(\'key\') or as tokens anywhere in the codebase. Safe to delete?)');
    unusedInCode.forEach(k => console.log(`   - ${k}`));
  } else {
    console.log('\n✅ No completely unused keys found! All defined keys are used statically or dynamically.');
  }

  if (likelyDynamicKeys.length > 0) {
    console.log(`\nℹ️ Keys likely used DYNAMICALLY (${likelyDynamicKeys.length}):`);
    console.log('   (These are not statically called via t(\'key\'), but their key paths or symbols were found in the codebase.)');
    // Group by top-level category for readability
    const categories: Record<string, string[]> = {};
    likelyDynamicKeys.forEach(k => {
      const cat = k.split('.')[0];
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(k);
    });
    for (const [cat, keys] of Object.entries(categories)) {
      console.log(`   📂 ${cat} (${keys.length}):`);
      keys.forEach(k => console.log(`     - ${k}`));
    }
  }

  console.log('\n==================================================');
  console.log('🎉 Verification Complete!');
  console.log('==================================================');
}

main().catch(err => {
  console.error('❌ An unexpected error occurred:', err);
});
