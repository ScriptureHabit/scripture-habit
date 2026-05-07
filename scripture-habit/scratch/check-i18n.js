import ja from './src/locales/ja.js';
import en from './src/locales/en.js';
import pt from './src/locales/pt.js';
import sw from './src/locales/sw.js';
import th from './src/locales/th.js';
import vi from './src/locales/vi.js';
import zho from './src/locales/zho.js';
import ko from './src/locales/ko.js';
import es from './src/locales/es.js';

const locales = { en, pt, sw, th, vi, zho, ko, es };

function findMissingKeys(master, target, prefix = '') {
    let missing = [];
    for (const key in master) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (!(key in target)) {
            missing.push(fullKey);
        } else if (typeof master[key] === 'object' && master[key] !== null && !Array.isArray(master[key])) {
            missing = missing.concat(findMissingKeys(master[key], target[key], fullKey));
        }
    }
    return missing;
}

for (const [name, data] of Object.entries(locales)) {
    const missing = findMissingKeys(ja, data);
    if (missing.length > 0) {
        console.log(`Locale ${name} is missing ${missing.length} keys:`);
        console.log(missing.join(', '));
        console.log('---');
    } else {
        console.log(`Locale ${name} is fully in sync.`);
    }
}
