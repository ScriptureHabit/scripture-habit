import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useNoteParser } from './use-note-parser';

describe('useNoteParser', () => {
    it('parses simple text with a URL and translated text correctly', () => {
        const { result } = renderHook(() => useNoteParser('Visit https://example.com for more', '訪問 https://example.com', true));

        expect(result.current.isOriginalStructured).toBe(false);
        expect(result.current.simpleUrls).toEqual(['https://example.com']);
        expect(result.current.finalSimpleContent).toContain('[https://example.com](https://example.com)');
        expect(result.current.primaryUrl).toBe('https://example.com');
    });

    it('parses realistic Japanese AI/Structured notes (カテゴリ / 章 / コメント)', () => {
        const structuredText = `カテゴリ: 旧約聖書\n章: ヨブ記 39:1-30\n\nコメント:\nヨブ記 1-30\n神様がヨブに問いかけた自然界の精緻な仕組みは、私たちの理解を超えた神の広大な摂理と愛を示しています。`;
        const { result } = renderHook(() => useNoteParser(structuredText, undefined, false));

        expect(result.current.isOriginalStructured).toBe(true);
        expect(result.current.scriptureValue).toBe('旧約聖書');
        expect(result.current.chapterValue).toBe('ヨブ記 39:1-30');
        expect(result.current.comment).toContain('ヨブ記 1-30');
        expect(result.current.comment).toContain('神様がヨブに問いかけた自然界の精緻な仕組み');
        expect(result.current.primaryUrl).toBeNull();
    });

    it('parses realistic English Structured notes (Category / Chapter / Comment)', () => {
        const structuredText = `Category: Book of Mormon\nChapter: Alma 32\n\nComment:\nSeek and ye shall find.`;
        const { result } = renderHook(() => useNoteParser(structuredText, undefined, false));

        expect(result.current.isOriginalStructured).toBe(true);
        expect(result.current.scriptureValue).toBe('Book of Mormon');
        expect(result.current.chapterValue).toBe('Alma 32');
        expect(result.current.comment).toBe('Seek and ye shall find.');
        expect(result.current.primaryUrl).toBeNull();
    });

    it('parses standard user markdown notes (**Header** + Comment)', () => {
        const markdownNote = `**モルモン書 1ニーファイ 3:7**\n\n私は行って、主が命じられたことを行います。`;
        const { result } = renderHook(() => useNoteParser(markdownNote, undefined, false));

        expect(result.current.isOriginalStructured).toBe(true);
        expect(result.current.comment).toBe('私は行って、主が命じられたことを行います。');
    });

    it('preserves comments with colons (e.g. ID: 1234, Note: etc.) in standard markdown notes', () => {
        const markdownNote = `**Book of Mormon 1 Nephi 1 (Test 12345)**\n\nLearning about faith and obedience. ID: 12345-abcd`;
        const { result } = renderHook(() => useNoteParser(markdownNote, undefined, false));

        expect(result.current.isOriginalStructured).toBe(true);
        expect(result.current.comment).toBe('Learning about faith and obedience. ID: 12345-abcd');
    });

    it('handles translated structured notes using translatedText when isTranslated is true', () => {
        const originalText = `カテゴリ: 旧約聖書\n章: 創世記 1:1\n\nコメント:\n初めに神は天と地を創造された。`;
        const translatedText = `Category: Old Testament\nChapter: Genesis 1:1\n\nComment:\nIn the beginning God created the heavens and the earth.`;
        const { result } = renderHook(() => useNoteParser(originalText, translatedText, true));

        expect(result.current.isOriginalStructured).toBe(true);
        expect(result.current.comment).toBe('In the beginning God created the heavens and the earth.');
    });

    it('parses space-separated markdown header without newlines correctly', () => {
        const spaceHeaderText = `**Old Testament ヨブ記 16：5** 良い友人とはどんな人でしょう。 同じ境遇にいない人からの助言は逆に苦しめることにもなることがあります。`;
        const { result } = renderHook(() => useNoteParser(spaceHeaderText, undefined, false));

        expect(result.current.isOriginalStructured).toBe(true);
        expect(result.current.scriptureValue).toBe('Old Testament');
        expect(result.current.chapterValue).toBe('ヨブ記 16：5');
        expect(result.current.comment).toBe('良い友人とはどんな人でしょう。 同じ境遇にいない人からの助言は逆に苦しめることにもなることがあります。');
    });

    it('parses single newline markdown header containing colons in chapter correctly without misinterpreting as category', () => {
        const singleNewlineText = `**Old Testament ヨブ記 13:13)**\nヨブの人生は私達の人生にどう当てはめられるでしょう。ヨブのように罪悪を犯さない正しい人でも苦難にあいます。`;
        const { result } = renderHook(() => useNoteParser(singleNewlineText, undefined, false));

        expect(result.current.isOriginalStructured).toBe(true);
        expect(result.current.scriptureValue).toBe('Old Testament');
        expect(result.current.chapterValue).toBe('ヨブ記 13:13)');
        expect(result.current.comment).toBe('ヨブの人生は私達の人生にどう当てはめられるでしょう。ヨブのように罪悪を犯さない正しい人でも苦難にあいます。');
    });

    it('does NOT misclassify normal chat messages with colons as structured notes', () => {
        const normalChatText = `明日の予定: 10:00に教会集合です。よろしくお願いします！`;
        const { result } = renderHook(() => useNoteParser(normalChatText, undefined, false));

        expect(result.current.isOriginalStructured).toBe(false);
        expect(result.current.finalSimpleContent).toBe('明日の予定: 10:00に教会集合です。よろしくお願いします！');
    });
});
