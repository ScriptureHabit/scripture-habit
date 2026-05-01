
import ja from '../src/locales/ja';
import en from '../src/locales/en';
import es from '../src/locales/es';
import ko from '../src/locales/ko';
import pt from '../src/locales/pt';
import sw from '../src/locales/sw';
import th from '../src/locales/th';
import tl from '../src/locales/tl';
import vi from '../src/locales/vi';
import zho from '../src/locales/zho';


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


const results = {};

for (const [lang, data] of Object.entries(locales)) {
    const langKeyList = getKeys(data);
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

import fs from 'fs';
fs.writeFileSync('scratch/locale_comparison.json', JSON.stringify(results, null, 2));
console.log('Results saved to scratch/locale_comparison.json');


