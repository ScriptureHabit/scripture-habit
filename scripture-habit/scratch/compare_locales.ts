import fs from 'fs';
import ja from '../src/locales/ja.ts';
import en from '../src/locales/en.ts';
import es from '../src/locales/es.ts';
import ko from '../src/locales/ko.ts';
import pt from '../src/locales/pt.ts';
import sw from '../src/locales/sw.ts';
import th from '../src/locales/th.ts';
import tl from '../src/locales/tl.ts';
import vi from '../src/locales/vi.ts';
import zho from '../src/locales/zho.ts';


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

const locales = { ja, en, es, ko, pt, sw, th, tl, vi, zho };
const jaKeyList = getKeys(ja);
const jaKeySet = new Set(jaKeyList);

console.log('| Language | Key Count | Diff from JA | Missing Keys (from JA) | Extra Keys (not in JA) |');
console.log('|----------|-----------|--------------|------------------------|------------------------|');


const results: Record<string, any> = {};

for (const [lang, data] of Object.entries(locales)) {
    const langKeyList = getKeys(data as any);
    const langKeySet = new Set(langKeyList);
    
    const missing = jaKeyList.filter(k => !langKeySet.has(k));
    const extra = langKeyList.filter(k => !jaKeySet.has(k));
    
    results[lang] = {
        count: langKeyList.length,
        diff: langKeyList.length - jaKeyList.length,
        missing,
        extra
    };
}

fs.writeFileSync('scratch/locale_comparison.json', JSON.stringify(results, null, 2));
console.log('Results saved to scratch/locale_comparison.json');
