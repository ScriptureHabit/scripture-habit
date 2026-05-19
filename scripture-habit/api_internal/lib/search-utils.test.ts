import { describe, it, expect } from 'vitest';
import { normalizeSearchText, createSearchTokens, buildNoteSearchTokens } from './search-utils';

describe('search-utils', () => {
  describe('normalizeSearchText', () => {
    it('should lowercase and trim', () => {
      expect(normalizeSearchText('  Hello WORLD  ')).toBe('hello world');
    });

    it('should replace punctuation with space', () => {
      expect(normalizeSearchText('hello,world! (test)')).toBe('hello world test');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeSearchText('hello    world')).toBe('hello world');
    });
  });

  describe('createSearchTokens', () => {
    it('should return unique tokens', () => {
      const tokens = createSearchTokens('hello world hello');
      expect(tokens).toEqual(['hello', 'world']);
    });

    it('should filter out empty strings', () => {
      const tokens = createSearchTokens('hello  world !');
      // '!' is punctuation, so it becomes a space, then filtered.
      expect(tokens).toEqual(['hello', 'world']);
    });
  });

  describe('buildNoteSearchTokens', () => {
    it('should combine all fields into unique tokens', () => {
      const note = {
        scripture: 'Genesis 1:1',
        chapter: '1',
        comment: 'Creation story',
        title: 'In the beginning',
        speaker: 'Moses'
      };
      const tokens = buildNoteSearchTokens(note);
      
      // genesis, 1, creation, story, in, the, beginning, moses
      expect(tokens).toContain('genesis');
      expect(tokens).toContain('1');
      expect(tokens).toContain('creation');
      expect(tokens).toContain('moses');
      expect(new Set(tokens).size).toBe(tokens.length);
    });

    it('should handle null/missing fields', () => {
      const note = {
        scripture: 'Psalm 23',
        comment: null
      };
      const tokens = buildNoteSearchTokens(note);
      expect(tokens).toEqual(['psalm', '23']);
    });

    it('should handle all fields being null or empty (line 23 branch fallback)', () => {
      const note = {
        scripture: null,
        chapter: undefined,
        comment: '',
        title: null,
        speaker: undefined
      };
      const tokens = buildNoteSearchTokens(note);
      expect(tokens).toEqual([]);
    });
  });
});
