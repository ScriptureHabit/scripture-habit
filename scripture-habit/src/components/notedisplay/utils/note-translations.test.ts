import { describe, it, expect } from 'vitest';
import { getNoteLabelFallback, translateScriptureName, isPlaceholderValue } from './note-translations';

describe('note-translations', () => {
    it('returns fallback labels for Japanese when original translation is missing', () => {
        expect(getNoteLabelFallback('noteLabels.scripture', 'ja', 'noteLabels.scripture')).toBe('カテゴリ');
        expect(getNoteLabelFallback('noteLabels.chapter', 'ja', 'noteLabels.chapter')).toBe('章');
        expect(getNoteLabelFallback('noteLabels.comment', 'ja', 'noteLabels.comment')).toBe('コメント');
    });

    it('returns original value when language is English or when fallback is unavailable', () => {
        expect(getNoteLabelFallback('noteLabels.scripture', 'en', 'noteLabels.scripture')).toBe('noteLabels.scripture');
        expect(getNoteLabelFallback('noteLabels.unknown', 'ja', 'noteLabels.unknown')).toBe('noteLabels.unknown');
    });

    it('translates scripture names using translation keys', () => {
        const t = (key: string) => key === 'scriptures.bookOfMormon' ? 'Book of Mormon' : key;
        expect(translateScriptureName('Book of Mormon', t)).toBe('Book of Mormon');
        expect(translateScriptureName('Unknown Book', t)).toBe('Unknown Book');
    });

    it('identifies placeholder values correctly', () => {
        expect(isPlaceholderValue('')).toBe(true);
        expect(isPlaceholderValue('none')).toBe(true);
        expect(isPlaceholderValue('(未分類)')).toBe(true);
        expect(isPlaceholderValue('Book of Mormon')).toBe(false);
    });
});
