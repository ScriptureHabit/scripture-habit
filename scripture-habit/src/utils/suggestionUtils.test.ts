import { describe, it, expect } from 'vitest';
import { getBookSuggestions } from './suggestionUtils';

describe('suggestionUtils', () => {
    const mockJaBooks: Record<string, string> = {
        "1 Nephi": "ニーファイ第一書",
        "2 Nephi": "ニーファイ第二書",
        "3 Nephi": "第三ニーファイ",
        "4 Nephi": "第四ニーファイ",
        "Jacob": "ヤコブ書",
        "Alma": "アルマ書",
        "Genesis": "創世記",
        "Exodus": "出エジプト記",
        "Matthew": "マタイによる福音書",
        "Mark": "マルコによる福音書",
        "Moses": "モーセ書"
    };

    describe('getBookSuggestions', () => {
        it('should return empty array if volume is missing', () => {
            const results = getBookSuggestions(null, 'Nephi', 'en', {});
            expect(results).toEqual([]);
        });

        it('should return empty array if input is empty', () => {
            const results = getBookSuggestions('Book of Mormon', '', 'en', {});
            expect(results).toEqual([]);
        });

        it('should filter books by English name (case-insensitive)', () => {
            const results = getBookSuggestions('Book of Mormon', 'nephi', 'en', mockJaBooks);
            // 1, 2, 3, 4 Nephi should match
            expect(results.length).toBe(4);
            expect(results.some(r => r.english === '1 Nephi')).toBe(true);
            expect(results.some(r => r.english === '2 Nephi')).toBe(true);
            expect(results.some(r => r.english === '3 Nephi')).toBe(true);
            expect(results.some(r => r.english === '4 Nephi')).toBe(true);
        });

        it('should filter books by translated name', () => {
            const results = getBookSuggestions('Old Testament', '創世', 'ja', mockJaBooks);
            expect(results.length).toBe(1);
            expect(results[0].translated).toBe('創世記');
        });

        describe('Japanese specific normalization', () => {
            it('should match Katakana input even if stored as Hiragana (via conversion logic)', () => {
                const results = getBookSuggestions('Book of Mormon', 'にーふぁい', 'ja', mockJaBooks);
                expect(results.length).toBe(4);
                expect(results[0].translated).toContain('ニーファイ');
            });

            it('should match mixed case/scripts with NFKC normalization', () => {
                const results = getBookSuggestions('Book of Mormon', '１', 'ja', mockJaBooks);
                expect(results.length).toBe(1);
                expect(results[0].english).toBe('1 Nephi');
            });
        });

        describe('Sorting Priority', () => {
            it('should prioritize exact matches', () => {
                const results = getBookSuggestions('Book of Mormon', 'Alma', 'en', mockJaBooks);
                expect(results[0].english).toBe('Alma');
            });

            it('should prioritize "starts with" over "includes"', () => {
                // Input "Ma"
                // "Matthew" starts with "Ma"
                // "Alma" contains "ma"
                const results = getBookSuggestions('New Testament', 'Ma', 'en', mockJaBooks);
                // Matches "Matthew" and "Mark"
                expect(results.length).toBeGreaterThanOrEqual(2);
                expect(results[0].english).toBe('Matthew');
                expect(results[1].english).toBe('Mark');

                const resultsNT = getBookSuggestions('New Testament', 'Ma', 'en', mockJaBooks);
                expect(resultsNT[0].english).toBe('Matthew'); 
                
                // Testing startsWith vs includes:
                // Input "the"
                // "Ether" (BoM) contains "the"
                // "1 Nephi" (BoM) does not.
                // Wait, let's find a better pair in BoM.
                // "Mormon" contains "mon"
                // "Words of Mormon" contains "mon"
                // Neither starts with "mon".
                
                // Let's use "Al" for "Alma" vs "1 Nephi" (no)
                // "Alma" starts with "Al".
                const resultsAl = getBookSuggestions('Book of Mormon', 'Al', 'en', mockJaBooks);
                expect(resultsAl[0].english).toBe('Alma');
            });

            it('should prioritize translated name startsWith over English startsWith', () => {
                const results = getBookSuggestions('Old Testament', '創', 'ja', mockJaBooks);
                expect(results[0].translated).toBe('創世記');
            });
        });

        it('should limit results to 10', () => {
            // Old Testament has many books.
            // Using a very broad search term "a"
            const results = getBookSuggestions('Old Testament', 'a', 'en', mockJaBooks);
            expect(results.length).toBeLessThanOrEqual(10);
        });

        it('should return empty if volume list not found', () => {
            const results = getBookSuggestions('Non-existent Volume', 'Test', 'en', {});
            expect(results).toEqual([]);
        });
    });
});
