import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// Import all locales dynamically in node/tsx
async function generate() {
    const localeDir = path.resolve('./src/locales');
    const langCodes = ['en', 'ja', 'es', 'pt', 'ko', 'zho', 'vi', 'tl', 'sw', 'th', 'it'];

    interface ExtractedMetadata {
        scriptures: Record<string, string>;
        books: Record<string, string>;
        noteLabels: Record<string, string>;
        placeholders: Record<string, string>;
        groupChat: {
            category?: string;
            chapter?: string;
            comment?: string;
        };
    }

    const metadataByCode: Record<string, ExtractedMetadata> = {};

    for (const code of langCodes) {
        const filePath = path.join(localeDir, `${code}.ts`);
        const mod = await import(pathToFileURL(filePath).href);
        const data = mod.default as Record<string, unknown>;

        const scriptures = (data.scriptures && typeof data.scriptures === 'object' ? data.scriptures : {}) as Record<string, string>;
        const books = (data.books && typeof data.books === 'object' ? data.books : {}) as Record<string, string>;
        const noteLabels = (data.noteLabels && typeof data.noteLabels === 'object' ? data.noteLabels : {}) as Record<string, string>;
        const placeholders = (data.placeholders && typeof data.placeholders === 'object' ? data.placeholders : {}) as Record<string, string>;
        const groupChat = (data.groupChat && typeof data.groupChat === 'object' ? data.groupChat : {}) as Record<string, unknown>;

        metadataByCode[code] = {
            scriptures,
            books,
            noteLabels,
            placeholders,
            groupChat: {
                category: typeof groupChat.category === 'string' ? groupChat.category : undefined,
                chapter: typeof groupChat.chapter === 'string' ? groupChat.chapter : undefined,
                comment: typeof groupChat.comment === 'string' ? groupChat.comment : undefined,
            }
        };
    }

    const fileContent = `/**
 * Standalone Scripture & Book Metadata Registry.
 * Extracted from full locale dictionaries to allow dynamic loading of language files
 * without bloating the initial entry bundle.
 */

export interface LocaleDefinition {
    scriptures?: Record<string, string>;
    noteLabels?: Record<string, string>;
    placeholders?: Record<string, string>;
    groupChat?: {
        category?: string;
        chapter?: string;
        comment?: string;
        [key: string]: unknown;
    };
    books?: Record<string, string>;
}

export const LOCALES_BY_CODE: Record<string, LocaleDefinition> = ${JSON.stringify(metadataByCode, null, 4)};

export const ALL_LOCALES: LocaleDefinition[] = Object.values(LOCALES_BY_CODE);
`;

    fs.writeFileSync(path.join(localeDir, 'scripture-metadata.ts'), fileContent, 'utf-8');
    console.log('Successfully generated scripture-metadata.ts');
}

generate().catch(console.error);
