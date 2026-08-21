import { describe, it, expect } from 'vitest';
import { identifyBookKey } from '../book-ref-mapper';
import enLocale from '../../locales/en';

const localeModules = import.meta.glob<Record<string, unknown>>(['../../locales/*.ts', '!../../locales/i18n.ts'], { eager: true, import: 'default' });

const validEnglishKeys = new Set(Object.keys(enLocale.books || {}));

describe('Scripture Book Translation & Identification', () => {
    it('correctly maps Japanese book names to English keys', () => {
        expect(identifyBookKey('ヨブ記')).toBe('Job');
        expect(identifyBookKey('ヨブ')).toBe('Job');
        expect(identifyBookKey('創世記')).toBe('Genesis');
        expect(identifyBookKey('ニーファイ第一書')).toBe('1 Nephi');
        expect(identifyBookKey('マタイによる福音書')).toBe('Matthew');
        expect(identifyBookKey('教義と聖約')).toBe('Doctrine and Covenants');
    });

    it('covers 100% of book names across all supported languages', () => {
        const unmapped: string[] = [];

        for (const [filePath, locale] of Object.entries(localeModules)) {
            const books = (locale?.books || {}) as Record<string, string>;
            const lang = filePath.match(/\/([^/]+)\.ts$/)?.[1] || filePath;

            Object.entries(books).forEach(([englishKey, localizedName]) => {
                const mappedKey = identifyBookKey(localizedName);
                if (!validEnglishKeys.has(mappedKey)) {
                    unmapped.push(`[${lang}] "${localizedName}" -> mapped to "${mappedKey}", expected "${englishKey}"`);
                }
            });
        }

        expect(unmapped).toEqual([]);
    });
});
