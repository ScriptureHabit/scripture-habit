import { describe, it, expect } from 'vitest';
import { normalizeScriptureCategory, buildNoteSearchTokens, createSearchTokens, normalizeSearchText } from './search-token-utils';

describe('search-token-utils', () => {
    describe('normalizeScriptureCategory', () => {
        it('should return the category if it is valid', () => {
            expect(normalizeScriptureCategory('Book of Mormon')).toBe('Book of Mormon');
            expect(normalizeScriptureCategory('New Testament')).toBe('New Testament');
        });

        it('should return DEFAULT_SCRIPTURE_CATEGORY if invalid or not string', () => {
            expect(normalizeScriptureCategory('Invalid Category')).toBe('Other');
            expect(normalizeScriptureCategory(null)).toBe('Other');
            expect(normalizeScriptureCategory(123)).toBe('Other');
            expect(normalizeScriptureCategory(undefined)).toBe('Other');
        });
    });

    describe('createSearchTokens', () => {
        it('should split words correctly', () => {
            const tokens = createSearchTokens('hello world');
            expect(tokens).toContain('hello');
            expect(tokens).toContain('world');
        });
    });

    describe('normalizeSearchText', () => {
        it('should remove punctuation', () => {
            expect(normalizeSearchText('hello, world! #test')).toBe('hello world test');
        });
    });

    describe('buildNoteSearchTokens', () => {
        it('should build tokens from note fields', () => {
            const note = {
                scripture: '1 Nephi',
                chapter: '3:7',
                comment: 'I will go and do',
                title: 'Obedience',
                speaker: 'Nephi'
            };
            const tokens = buildNoteSearchTokens(note);
            expect(tokens).toContain('nephi');
            expect(tokens).toContain('go');
            expect(tokens).toContain('obedience');
        });

        it('should truncate comment to 500 characters', () => {
            const longComment = 'a'.repeat(600);
            const note = {
                comment: longComment
            };
            const tokens = buildNoteSearchTokens(note);
            // Verify that we don't have the full 600 'a's but rather 500 'a's
            expect(tokens).toContain('a'.repeat(500));
            expect(tokens).not.toContain('a'.repeat(600));
        });
    });
});
