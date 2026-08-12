import { describe, it, expect } from 'vitest';
import { identifyBookKey } from '../book-ref-mapper';
import enBooks from '../../locales/books/en';
import esBooks from '../../locales/books/es';
import ptBooks from '../../locales/books/pt';
import jaBooks from '../../locales/books/ja';
import zhoBooks from '../../locales/books/zho';
import koBooks from '../../locales/books/ko';
import thBooks from '../../locales/books/th';
import viBooks from '../../locales/books/vi';
import tlBooks from '../../locales/books/tl';
import swBooks from '../../locales/books/sw';

const allLocales = [
    { lang: 'en', books: enBooks },
    { lang: 'es', books: esBooks },
    { lang: 'pt', books: ptBooks },
    { lang: 'ja', books: jaBooks },
    { lang: 'zho', books: zhoBooks },
    { lang: 'ko', books: koBooks },
    { lang: 'th', books: thBooks },
    { lang: 'vi', books: viBooks },
    { lang: 'tl', books: tlBooks },
    { lang: 'sw', books: swBooks },
];

const validEnglishKeys = new Set(Object.keys(enBooks));

describe('Scripture Book Translation & Identification', () => {
    it('correctly maps Japanese book names to English keys', () => {
        expect(identifyBookKey('ヨブ記')).toBe('Job');
        expect(identifyBookKey('ヨブ')).toBe('Job');
        expect(identifyBookKey('創世記')).toBe('Genesis');
        expect(identifyBookKey('ニーファイ第一書')).toBe('1 Nephi');
        expect(identifyBookKey('マタイによる福音書')).toBe('Matthew');
        expect(identifyBookKey('教義と聖約')).toBe('Doctrine and Covenants');
    });

    it('covers 100% of book names across all 10 supported languages', () => {
        const unmapped: string[] = [];

        allLocales.forEach(({ lang, books }) => {
            Object.entries(books).forEach(([englishKey, localizedName]) => {
                const mappedKey = identifyBookKey(localizedName);
                if (!validEnglishKeys.has(mappedKey)) {
                    unmapped.push(`[${lang}] "${localizedName}" -> mapped to "${mappedKey}", expected "${englishKey}"`);
                }
            });
        });

        expect(unmapped).toEqual([]);
    });
});

