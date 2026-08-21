import ja from './src/locales/ja.ts';
import en from './src/locales/en.ts';
import es from './src/locales/es.ts';
import ko from './src/locales/ko.ts';
import pt from './src/locales/pt.ts';
import sw from './src/locales/sw.ts';
import tl from './src/locales/tl.ts';

function countKeys(obj) {
    let count = 0;
    for (const key in obj) {
        count++;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            count += countKeys(obj[key]);
        }
    }
    return count;
}

const locales = { ja, en, es, ko, pt, sw, tl };
const results = {};

for (const [name, content] of Object.entries(locales)) {
    results[name] = countKeys(content);
}

console.log(JSON.stringify(results, null, 2));
