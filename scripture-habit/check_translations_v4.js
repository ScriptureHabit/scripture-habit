import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { translations } from './src/Data/Translations.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, 'translation_report.txt');

function log(message) {
    fs.appendFileSync(outputPath, message + '\n');
    console.log(message);
}

// Clear report file
fs.writeFileSync(outputPath, '');

try {
    const languages = Object.keys(translations);
    const baseLang = 'ja';

    if (!languages.includes(baseLang)) {
        log(`Error: Base language '${baseLang}' not found.`);
    } else {
        const targets = languages.filter(l => l !== baseLang);

        function getKeys(obj, prefix = '') {
            let keys = [];
            for (const key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    keys = keys.concat(getKeys(obj[key], prefix + key + '.'));
                } else {
                    keys.push(prefix + key);
                }
            }
            return keys;
        }

        const baseKeys = getKeys(translations[baseLang]);
        let missingCount = 0;

        log(`Checking against base language: ${baseLang}`);
        log(`Total base keys: ${baseKeys.length}`);

        targets.forEach(lang => {
            const missing = [];
            baseKeys.forEach(keyPath => {
                const parts = keyPath.split('.');
                let current = translations[lang];
                for (const part of parts) {
                    if (current === undefined || current === null) {
                        current = undefined;
                        break;
                    }
                    current = current[part];
                }
                if (current === undefined) {
                    missing.push(keyPath);
                }
            });

            if (missing.length > 0) {
                log(`\n[${lang}] Missing ${missing.length} keys:`);
                missing.forEach(k => log(`  - ${k}`));
                missingCount += missing.length;
            } else {
                log(`\n[${lang}] OK`);
            }
        });

        if (missingCount === 0) {
            log("\nSuccess: All languages match Japanese.");
        } else {
            log(`\nFound total ${missingCount} missing translations.`);
        }
    }

} catch (error) {
    log("An error occurred: " + error.message);
}
