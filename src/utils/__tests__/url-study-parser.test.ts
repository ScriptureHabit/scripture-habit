import { describe, it, expect } from 'vitest';
import { parseStudyUrl, generateUrlStudyComment } from '../url-study-parser';

describe('url-study-parser', () => {
    describe('parseStudyUrl', () => {
        it('correctly parses Old Testament Proverbs 22 URL', () => {
            const url = 'https://www.churchofjesuschrist.org/study/scriptures/ot/prov/22?lang=jpn';
            const parsed = parseStudyUrl(url, 'ja');

            expect(parsed.type).toBe('scripture');
            expect(parsed.category).toBe('Old Testament');
            expect(parsed.categoryLabel).toBe('旧約聖書');
            expect(parsed.bookName).toBe('箴言');
            expect(parsed.chapter).toBe('22');
            expect(parsed.verses).toBeUndefined();
        });

        it('correctly parses scripture URL with verse ranges (id=p1-p5)', () => {
            const url = 'https://www.churchofjesuschrist.org/study/scriptures/ot/prov/22?lang=jpn&id=p1-p5#p1';
            const parsed = parseStudyUrl(url, 'ja');

            expect(parsed.type).toBe('scripture');
            expect(parsed.bookName).toBe('箴言');
            expect(parsed.chapter).toBe('22');
            expect(parsed.verses).toBe('1-5');
        });

        it('correctly parses Book of Mormon URL (1 Nephi 3)', () => {
            const url = 'https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn';
            const parsed = parseStudyUrl(url, 'ja');

            expect(parsed.type).toBe('scripture');
            expect(parsed.category).toBe('Book of Mormon');
            expect(parsed.categoryLabel).toBe('モルモン書');
            expect(parsed.bookName).toBe('ニーファイ第一書');
            expect(parsed.chapter).toBe('3');
        });

        it('correctly parses Doctrine and Covenants Section 4', () => {
            const url = 'https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/4?lang=jpn';
            const parsed = parseStudyUrl(url, 'ja');

            expect(parsed.type).toBe('scripture');
            expect(parsed.category).toBe('Doctrine and Covenants');
            expect(parsed.categoryLabel).toBe('教義と聖約');
            expect(parsed.chapter).toBe('4');
        });

        it('correctly parses General Conference October 2022', () => {
            const url = 'https://www.churchofjesuschrist.org/study/general-conference/2022/10/47nelson?lang=jpn';
            const parsed = parseStudyUrl(url, 'ja');

            expect(parsed.type).toBe('general-conference');
            expect(parsed.category).toBe('General Conference');
            expect(parsed.categoryLabel).toBe('総大会');
            expect(parsed.sessionLabel).toBe('2022年10月総大会');
        });

        it('correctly parses General Conference April 2024 in English', () => {
            const url = 'https://www.churchofjesuschrist.org/study/general-conference/2024/04/11oaks?lang=eng';
            const parsed = parseStudyUrl(url, 'en');

            expect(parsed.type).toBe('general-conference');
            expect(parsed.category).toBe('General Conference');
            expect(parsed.categoryLabel).toBe('General Conference');
            expect(parsed.sessionLabel).toBe('April 2024 General Conference');
        });

        it('correctly handles external or non-church URLs', () => {
            const url = 'https://example.com/articles/faith';
            const parsed = parseStudyUrl(url, 'ja');

            expect(parsed.type).toBe('other');
            expect(parsed.category).toBe('Other');
            expect(parsed.categoryLabel).toBe('その他');
        });
    });

    describe('generateUrlStudyComment', () => {
        it('generates the exact requested comment for Proverbs 22', () => {
            const parsed = parseStudyUrl('https://www.churchofjesuschrist.org/study/scriptures/ot/prov/22?lang=jpn', 'ja');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                category: parsed.category,
                bookName: parsed.bookName,
                chapter: parsed.chapter,
                verses: parsed.verses,
                language: 'ja'
            });

            expect(comment).toBe('今日は旧約聖書の箴言22章について学びを深めました。');
        });

        it('generates comment with verses for Proverbs 22:1-5', () => {
            const parsed = parseStudyUrl('https://www.churchofjesuschrist.org/study/scriptures/ot/prov/22?lang=jpn&id=p1-p5#p1', 'ja');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                category: parsed.category,
                bookName: parsed.bookName,
                chapter: parsed.chapter,
                verses: parsed.verses,
                language: 'ja'
            });

            expect(comment).toBe('今日は旧約聖書の箴言22章1-5節について学びを深めました。');
        });

        it('generates the exact requested comment for General Conference talk with speaker and title', () => {
            const parsed = parseStudyUrl('https://www.churchofjesuschrist.org/study/general-conference/2022/10/47nelson?lang=jpn', 'ja');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                sessionLabel: parsed.sessionLabel,
                speaker: 'ラッセル・M・ネルソン大管長',
                title: '世に打ち勝ちなさい。そうすれば休みが与えられるであろう',
                language: 'ja'
            });

            expect(comment).toBe('今日は2022年10月総大会のラッセル・M・ネルソン大管長の説教「世に打ち勝ちなさい。そうすれば休みが与えられるであろう」について学びを深めました。');
        });

        it('generates General Conference comment without speaker when speaker is missing', () => {
            const parsed = parseStudyUrl('https://www.churchofjesuschrist.org/study/general-conference/2022/10/47nelson?lang=jpn', 'ja');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                sessionLabel: parsed.sessionLabel,
                title: '世に打ち勝ちなさい。そうすれば休みが与えられるであろう',
                language: 'ja'
            });

            expect(comment).toBe('今日は2022年10月総大会の説教「世に打ち勝ちなさい。そうすれば休みが与えられるであろう」について学びを深めました。');
        });

        it('generates D&C comment with "編"', () => {
            const parsed = parseStudyUrl('https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/4?lang=jpn', 'ja');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                category: parsed.category,
                bookName: parsed.bookName,
                chapter: parsed.chapter,
                language: 'ja'
            });

            expect(comment).toBe('今日は教義と聖約の4編について学びを深めました。');
        });

        it('generates other external URL comment with title', () => {
            const parsed = parseStudyUrl('https://example.com/great-article', 'ja');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                title: '素晴らしい信仰の記事',
                language: 'ja'
            });

            expect(comment).toBe('今日は「素晴らしい信仰の記事」について学びを深めました。');
        });

        it('generates English comments properly', () => {
            const parsed = parseStudyUrl('https://www.churchofjesuschrist.org/study/scriptures/ot/prov/22?lang=eng', 'en');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                category: parsed.category,
                bookName: parsed.bookName,
                chapter: parsed.chapter,
                language: 'en'
            });

            expect(comment).toBe('Today I deepened my learning on Proverbs 22 from the Old Testament.');
        });

        it('generates Spanish comments properly', () => {
            const parsed = parseStudyUrl('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=spa', 'es');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                category: parsed.category,
                bookName: parsed.bookName,
                chapter: parsed.chapter,
                language: 'es'
            });

            expect(comment).toBe('Hoy profundicé mi aprendizaje sobre 1 Nefi 3 de El Libro de Mormón.');
        });

        it('generates Korean comments properly with units', () => {
            const parsed = parseStudyUrl('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=kor', 'ko');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                category: parsed.category,
                bookName: parsed.bookName,
                chapter: parsed.chapter,
                verses: '7',
                language: 'ko'
            });

            expect(comment).toBe('오늘은 몰몬경의 니파이전서 3장 7절에 대해 깊이 있게 공부했습니다.');
        });

        it('generates Traditional Chinese comments properly with units', () => {
            const parsed = parseStudyUrl('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=zho', 'zho');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                category: parsed.category,
                bookName: parsed.bookName,
                chapter: parsed.chapter,
                verses: '7',
                language: 'zho'
            });

            expect(comment).toBe('今天我深入研讀了《摩爾門經》中的尼腓一書第3章第7節。');
        });

        it('generates Tagalog comments properly', () => {
            const parsed = parseStudyUrl('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=tgl', 'tl');
            const comment = generateUrlStudyComment({
                type: parsed.type,
                categoryLabel: parsed.categoryLabel,
                category: parsed.category,
                bookName: parsed.bookName,
                chapter: parsed.chapter,
                language: 'tl'
            });

            expect(comment).toBe('Ngayong araw ay pinalalim ko ang aking pag-aaral tungkol sa 1 Nephi 3 mula sa Aklat ni Mormon.');
        });
    });
});

