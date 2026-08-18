import { ALL_LOCALES } from '../locales/registry.js';

const CANONICAL_KEYS: Record<string, string> = {
    "D&C": "Doctrine and Covenants",
    "d&c": "Doctrine and Covenants",
    "dc": "Doctrine and Covenants",
    "d.&c.": "Doctrine and Covenants",
    "d. & c.": "Doctrine and Covenants",
    "d and c": "Doctrine and Covenants",
    "1ne": "1 Nephi",
    "2ne": "2 Nephi",
    "3ne": "3 Nephi",
    "4ne": "4 Nephi",
    "bom": "Book of Mormon",
    "od": "Official Declaration",
    "psalm": "Psalms"
};

export const BOOK_IDENTITY_MAP: Record<string, string> = { ...CANONICAL_KEYS };

for (const locale of ALL_LOCALES) {
    const bundle = locale?.books as Record<string, string> | undefined;
    if (!bundle || typeof bundle !== 'object') continue;
    for (const [englishKey, localizedName] of Object.entries(bundle)) {
        if (typeof localizedName !== 'string') continue;
        const trimmedLoc = localizedName.trim();
        const trimmedEng = englishKey.trim();
        const canonicalEng = CANONICAL_KEYS[trimmedEng] || trimmedEng;

        BOOK_IDENTITY_MAP[trimmedLoc] = canonicalEng;
        BOOK_IDENTITY_MAP[trimmedEng] = canonicalEng;

        // Auto-generate aliases (e.g. "Job" from localized book names)
        BOOK_IDENTITY_MAP[trimmedLoc.replace(/記$/, '')] = canonicalEng;
        BOOK_IDENTITY_MAP[trimmedLoc.replace(/書$/, '')] = canonicalEng;
        BOOK_IDENTITY_MAP[trimmedLoc.replace(/による福音書$/, '')] = canonicalEng;
        BOOK_IDENTITY_MAP[trimmedLoc.replace(/の手紙$/, '')] = canonicalEng;
        BOOK_IDENTITY_MAP[trimmedLoc.replace(/^第(?=\d)/, '')] = canonicalEng;

        // Numbered books variations (e.g. "1 Nephi", "1 <BookName>")
        const numMatch = canonicalEng.match(/^(\d)\s+(.+)$/);
        if (numMatch) {
            const digit = numMatch[1];
            const baseEng = numMatch[2];
            BOOK_IDENTITY_MAP[`${digit} ${baseEng}`] = canonicalEng;
            BOOK_IDENTITY_MAP[`${digit}${baseEng}`] = canonicalEng;

            const localizedBase = trimmedLoc.replace(/^(第一|第二|第三|第四|第1|第2|第3|第4|1|2|3|4)\s*/, '').replace(/(第一書|第二書|第三書|第四書|第一の書|第二の書|第三の書|第四の書|の書|書)$/, '');
            BOOK_IDENTITY_MAP[`${digit}${localizedBase}`] = canonicalEng;
            BOOK_IDENTITY_MAP[`${digit} ${localizedBase}`] = canonicalEng;
            BOOK_IDENTITY_MAP[`第${digit}${localizedBase}`] = canonicalEng;
            BOOK_IDENTITY_MAP[`第${digit} ${localizedBase}`] = canonicalEng;
            BOOK_IDENTITY_MAP[`第１${localizedBase}`] = canonicalEng;
            BOOK_IDENTITY_MAP[`第２${localizedBase}`] = canonicalEng;
            BOOK_IDENTITY_MAP[`第３${localizedBase}`] = canonicalEng;
            BOOK_IDENTITY_MAP[`第４${localizedBase}`] = canonicalEng;
        }
    }
}

/**
 * Normalizes any book name to its English key if possible.
 */
export const identifyBookKey = (bookName: string): string => {
    // 1. Try common identity map (with trimming)
    const cleanName = bookName.trim();
    const mapped = BOOK_IDENTITY_MAP[cleanName];
    if (mapped) return mapped;

    // 2. Try case-insensitive comparison
    const lower = cleanName.toLowerCase();
    for (const [key, value] of Object.entries(BOOK_IDENTITY_MAP)) {
        if (key.toLowerCase() === lower) return value;
    }

    return cleanName;
};
