import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LOCALES_BY_CODE } from '../src/locales/scripture-metadata.js';
import { AI_DAILY_COMMENTS, AiDailyCommentData } from '../api_internal/data/ai-daily-comments-2026.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_FILE_PATH = path.resolve(__dirname, '../api_internal/data/ai-daily-comments-2026.ts');

const SUPPORTED_LANGUAGES = ['ja', 'en', 'ko', 'zho', 'es', 'pt', 'vi', 'tl', 'th', 'sw', 'it'] as const;

// Sort English book names by length descending for greedy prefix matching
const EN_BOOKS = Object.keys(LOCALES_BY_CODE['en'].books || {}).sort((a, b) => b.length - a.length);

// Also collect Japanese book names for reverse lookup if needed
const JA_BOOKS_MAP: Record<string, string> = {};
for (const [enBook, jaBook] of Object.entries(LOCALES_BY_CODE['ja'].books || {})) {
    JA_BOOKS_MAP[jaBook] = enBook;
}
const JA_BOOKS = Object.keys(JA_BOOKS_MAP).sort((a, b) => b.length - a.length);

// Category mapping from English & Japanese
const SCRIPTURE_KEY_MAP: Record<string, string> = {
    'Old Testament': 'oldTestament',
    '旧約聖書': 'oldTestament',
    'New Testament': 'newTestament',
    '新約聖書': 'newTestament',
    'Book of Mormon': 'bookOfMormon',
    'モルモン書': 'bookOfMormon',
    'Doctrine and Covenants': 'doctrineAndCovenants',
    '教義と聖約': 'doctrineAndCovenants',
    'Pearl of Great Price': 'pearlOfGreatPrice',
    '高価な真珠': 'pearlOfGreatPrice',
    'Other': 'other',
    'その他': 'other'
};

export interface DailyCommentEntry {
    date?: string;
    scripture: Record<string, string>;
    chapter: Record<string, string>;
    comment: Record<string, string>;
}

export function parseChapter(chapterStr: string): { bookKey: string; versePart: string } | null {
    const trimmed = chapterStr.trim();
    
    // Try English book match first
    for (const enBook of EN_BOOKS) {
        if (trimmed.startsWith(enBook)) {
            const versePart = trimmed.slice(enBook.length);
            return { bookKey: enBook, versePart };
        }
    }

    // Try Japanese book match
    for (const jaBook of JA_BOOKS) {
        if (trimmed.startsWith(jaBook)) {
            const versePart = trimmed.slice(jaBook.length);
            return { bookKey: JA_BOOKS_MAP[jaBook], versePart };
        }
    }

    return null;
}

export function localizeEntry(entry: DailyCommentEntry, fallbackDate?: string): AiDailyCommentData {
    const scriptureSource = entry.scripture.en || entry.scripture.ja || 'Old Testament';
    const categoryKey = SCRIPTURE_KEY_MAP[scriptureSource] || 'oldTestament';

    const chapterSource = entry.chapter.en || entry.chapter.ja || '';
    const parsed = parseChapter(chapterSource) || parseChapter(entry.chapter.ja || '');

    const localizedScripture: Record<string, string> = {};
    const localizedChapter: Record<string, string> = {};

    for (const lang of SUPPORTED_LANGUAGES) {
        const localeDef = LOCALES_BY_CODE[lang] || LOCALES_BY_CODE['en'];
        
        // Localize Scripture Category
        localizedScripture[lang] = localeDef.scriptures?.[categoryKey] || entry.scripture[lang] || entry.scripture.en || entry.scripture.ja;

        // Localize Chapter / Verse
        if (parsed) {
            const bookName = localeDef.books?.[parsed.bookKey] || parsed.bookKey;
            localizedChapter[lang] = `${bookName}${parsed.versePart}`;
        } else {
            localizedChapter[lang] = entry.chapter[lang] || chapterSource;
        }
    }

    return {
        date: entry.date || fallbackDate || '',
        scripture: localizedScripture,
        chapter: localizedChapter,
        comment: entry.comment
    };
}

export function syncAllDailyComments(): void {
    console.log('🔄 Localizing scripture and chapter metadata for all 364 days across 11 languages...');

    const sortedDates = Object.keys(AI_DAILY_COMMENTS).sort();
    let content = `export interface AiDailyCommentData {
    date: string; // YYYY-MM-DD
    scripture: Record<string, string>;
    chapter: Record<string, string>;
    comment: Record<string, string>;
}

export const AI_DAILY_COMMENTS: Record<string, AiDailyCommentData> = {\n`;

    for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const item = localizeEntry(AI_DAILY_COMMENTS[date], date);
        const isLast = i === sortedDates.length - 1;

        content += `    "${date}": {\n`;
        content += `        date: "${date}",\n`;
        
        // scripture
        content += `        scripture: ${JSON.stringify(item.scripture, null, 12).replace(/\n\s*}/, '\n        }')},\n`;
        
        // chapter
        content += `        chapter: ${JSON.stringify(item.chapter, null, 12).replace(/\n\s*}/, '\n        }')},\n`;
        
        // comment
        content += `        comment: ${JSON.stringify(item.comment, null, 12).replace(/\n\s*}/, '\n        }')}\n`;
        
        content += `    }${isLast ? '' : ','}\n`;
    }

    content += `};

/**
 * Helper function to retrieve daily comment or fallback
 */
export function getAiDailyComment(dateStr: string, lang: string = 'ja') {
    const item = AI_DAILY_COMMENTS[dateStr];
    if (item) {
        return {
            scripture: item.scripture[lang] || item.scripture['en'] || item.scripture['ja'],
            chapter: item.chapter[lang] || item.chapter['en'] || item.chapter['ja'],
            comment: item.comment[lang] || item.comment['en'] || item.comment['ja']
        };
    }

    const fallbacks: Record<string, { scripture: string; chapter: string; comment: string }> = {
        ja: {
            scripture: "聖典学習",
            chapter: "今日の聖句",
            comment: "毎日少しずつ聖典を読み進めるその一歩が、何より尊い習慣です。"
        },
        en: {
            scripture: "Scripture Study",
            chapter: "Today's Scripture",
            comment: "Taking one small step each day to open the scriptures is a habit worth keeping."
        },
        it: {
            scripture: "Studio delle Scritture",
            chapter: "Scrittura di oggi",
            comment: "Fare anche solo un piccolo passo ogni giorno per aprire le Scritture è un'abitudine preziosa da custodire."
        }
    };

    return fallbacks[lang] || fallbacks['en'];
}
`;

    fs.writeFileSync(TARGET_FILE_PATH, content, 'utf-8');
    console.log(`✅ Successfully localized ${sortedDates.length} dates across 11 languages in ${TARGET_FILE_PATH}`);
}

// Run directly if executed as a script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    syncAllDailyComments();
}
