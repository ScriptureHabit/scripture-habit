import { describe, it, expect } from 'vitest';
import { getGospelLibraryUrl, getCategoryFromScripture, getScriptureInfoFromText } from './gospel-library-mapper';

describe('gospel-library-mapper', () => {
    describe('getGospelLibraryUrl', () => {
        it('should handle Book of Mormon scriptures', () => {
            expect(getGospelLibraryUrl(null, '1 Nephi 3:7')).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=eng&id=p7#p7');
            expect(getGospelLibraryUrl(null, '1ニーファイ 3:7', 'ja')).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=jpn&id=p7#p7');
            expect(getGospelLibraryUrl(null, 'Alma 32:21', 'es')).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/alma/32?lang=spa&id=p21#p21');
        });

        it('should handle New Testament scriptures', () => {
            expect(getGospelLibraryUrl(null, 'Matthew 5:1')).toBe('https://www.churchofjesuschrist.org/study/scriptures/nt/matt/5?lang=eng&id=p1#p1');
            expect(getGospelLibraryUrl(null, 'マタイによる福音書 5:1', 'ja')).toBe('https://www.churchofjesuschrist.org/study/scriptures/nt/matt/5?lang=jpn&id=p1#p1');
        });

        it('should handle Old Testament scriptures', () => {
            expect(getGospelLibraryUrl(null, 'Genesis 1:1')).toBe('https://www.churchofjesuschrist.org/study/scriptures/ot/gen/1?lang=eng&id=p1#p1');
        });

        it('should handle Doctrine and Covenants', () => {
            expect(getGospelLibraryUrl(null, 'Doctrine and Covenants 89:1')).toBe('https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/89?lang=eng&id=p1#p1');
            expect(getGospelLibraryUrl(null, '教義と聖約 89:1', 'ja')).toBe('https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/89?lang=jpn&id=p1#p1');
            expect(getGospelLibraryUrl(null, 'D&C 89:1')).toBe('https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/89?lang=eng&id=p1#p1');
        });

        it('should detect volume from explicit volume argument', () => {
            expect(getGospelLibraryUrl('Old Testament', 'Genesis 1:1')).toBe('https://www.churchofjesuschrist.org/study/scriptures/ot/gen/1?lang=eng&id=p1#p1');
            expect(getGospelLibraryUrl('New Testament', 'Matthew 1:1')).toBe('https://www.churchofjesuschrist.org/study/scriptures/nt/matt/1?lang=eng&id=p1#p1');
            expect(getGospelLibraryUrl('Doctrine and Covenants', 'D&C 1:1')).toBe('https://www.churchofjesuschrist.org/study/scriptures/dc-testament/dc/1?lang=eng&id=p1#p1');
            expect(getGospelLibraryUrl('Pearl of Great Price', 'Moses 1:1')).toBe('https://www.churchofjesuschrist.org/study/scriptures/pgp/moses/1?lang=eng&id=p1#p1');
            expect(getGospelLibraryUrl('BYU Speeches', 'https://speeches.byu.edu/talks/')).toBe('https://speeches.byu.edu/talks/');
        });

        it('should handle Pearl of Great Price', () => {
            expect(getGospelLibraryUrl(null, 'Moses 1:39')).toBe('https://www.churchofjesuschrist.org/study/scriptures/pgp/moses/1?lang=eng&id=p39#p39');
        });

        it('should handle General Conference', () => {
            expect(getGospelLibraryUrl('General Conference', '2023/10/12')).toBe('https://www.churchofjesuschrist.org/study/general-conference/2023/10/12?lang=eng');
            expect(getGospelLibraryUrl('General Conference', '2023/10')).toBe('https://www.churchofjesuschrist.org/study/general-conference/2023/10?lang=eng');
            // Testing when chapterInput is a church website URL
            expect(getGospelLibraryUrl('General Conference', 'https://www.churchofjesuschrist.org/study/general-conference/2023/10/12?lang=eng', 'ja')).toBe('https://www.churchofjesuschrist.org/study/general-conference/2023/10/12?lang=jpn');
            // Testing invalid URL in catch block
            expect(getGospelLibraryUrl('General Conference', 'https://churchofjesuschrist.org:invalidport')).toBe('https://churchofjesuschrist.org:invalidport');
        });

        it('should handle Ordinances and Proclamations', () => {
            expect(getGospelLibraryUrl('Ordinances and Proclamations', 'The Family: A Proclamation to the World')).toBe('https://www.churchofjesuschrist.org/study/scriptures/the-family-a-proclamation-to-the-world?lang=eng');
            expect(getGospelLibraryUrl(null, 'The Living Christ')).toBe('https://www.churchofjesuschrist.org/study/scriptures/the-living-christ-the-testimony-of-the-apostles?lang=eng');
            expect(getGospelLibraryUrl(null, 'Sacrament')).toBe('https://www.churchofjesuschrist.org/study/scriptures/sacrament?lang=eng');
            expect(getGospelLibraryUrl(null, 'Baptism')).toBe('https://www.churchofjesuschrist.org/study/scriptures/baptism?lang=eng');
            expect(getGospelLibraryUrl('Ordinances and Proclamations', 'Restoration')).toBe('https://www.churchofjesuschrist.org/study/scriptures/the-restoration-of-the-fulness-of-the-gospel-of-jesus-christ?lang=eng');
            expect(getGospelLibraryUrl('Ordinances and Proclamations', 'Other Proclamation')).toBe('https://www.churchofjesuschrist.org/study/scriptures/ordinances-and-proclamations?lang=eng');
        });

        it('should handle multiple verses or verse ranges', () => {
            expect(getGospelLibraryUrl(null, '1 Nephi 3:7-8')).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=eng&id=p7-p8#p7');
            expect(getGospelLibraryUrl(null, '1 Nephi 3:7,9')).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=eng&id=p7,p9#p7');
        });

        it('should return null for invalid input', () => {
            expect(getGospelLibraryUrl(null, null)).toBeNull();
            expect(getGospelLibraryUrl(null, '')).toBeNull();
            expect(getGospelLibraryUrl(null, 'Not a real book 1:1')).toBeNull();
        });
    });

    describe('getCategoryFromScripture', () => {
        it('should correctly identify categories', () => {
            expect(getCategoryFromScripture('1 Nephi 3:7')).toBe('Book of Mormon');
            expect(getCategoryFromScripture('Matthew 5:1')).toBe('New Testament');
            expect(getCategoryFromScripture('Genesis 1:1')).toBe('Old Testament');
            expect(getCategoryFromScripture('Doctrine and Covenants 89:1')).toBe('Doctrine and Covenants');
            expect(getCategoryFromScripture('Moses 1:39')).toBe('Pearl of Great Price');
            expect(getCategoryFromScripture('The Family: A Proclamation to the World')).toBe('Ordinances and Proclamations');
        });

        it('should fallback to Other for unknown inputs', () => {
            expect(getCategoryFromScripture('Unknown Book 1:1')).toBe('Other');
        });
    });

    describe('getScriptureInfoFromText', () => {
        it('should extract url from markdown formatted text', () => {
            const text = `**Scripture:** Book of Mormon\n**Chapter:** 1 Nephi 3:7`;
            expect(getScriptureInfoFromText(text)).toBe('https://www.churchofjesuschrist.org/study/scriptures/bofm/1-ne/3?lang=eng&id=p7#p7');
        });

        it('should return null if format does not match', () => {
            const text = `Just some regular text about 1 Nephi 3:7`;
            expect(getScriptureInfoFromText(text)).toBeNull();
            expect(getScriptureInfoFromText(null)).toBeNull();
        });
    });
});
