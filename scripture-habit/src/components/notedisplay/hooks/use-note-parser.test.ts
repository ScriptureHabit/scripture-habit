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

    it('parses structured notes and extracts scripture, chapter, and comments', () => {
        const structuredText = `Scripture: Book of Mormon\nChapter: Alma 32\nComment: Seek and ye shall find.`;
        const { result } = renderHook(() => useNoteParser(structuredText, undefined, false));

        expect(result.current.isOriginalStructured).toBe(true);
        expect(result.current.scriptureValue).toBe('Book of Mormon');
        expect(result.current.chapterValue).toBe('Alma 32');
        expect(result.current.comment).toBe('Seek and ye shall find.');
        expect(result.current.primaryUrl).toBeNull();
    });

    it('handles translated structured notes using translatedText when isTranslated is true', () => {
        const originalText = `Scripture: Old Testament\nChapter: Genesis 1\nComment: Original comment.`;
        const translatedText = `Scripture: Old Testament\nChapter: Genesis 1\nComment: Translated comment.`;
        const { result } = renderHook(() => useNoteParser(originalText, translatedText, true));

        expect(result.current.isOriginalStructured).toBe(true);
        expect(result.current.comment).toBe('Translated comment.');
    });
});
