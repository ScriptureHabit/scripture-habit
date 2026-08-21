import { describe, it, expect } from 'vitest';
import { formatNoteText, getNoteValidationError } from './note-logic';

describe('note-logic', () => {
    describe('formatNoteText', () => {
        it('should format text correctly with scripture and chapter', () => {
            expect(formatNoteText('Book of Mormon', '1 Nephi 3:7', 'I will go and do')).toBe('**Book of Mormon 1 Nephi 3:7**\n\nI will go and do');
        });

        it('should format text correctly without scripture or chapter', () => {
            expect(formatNoteText('', '', 'Just a comment')).toBe('Just a comment');
        });
    });

    describe('getNoteValidationError', () => {
        it('should require scripture and chapter', () => {
            expect(getNoteValidationError('', '1 Nephi 3:7')).toBe('newNote.errorMissingFields');
            expect(getNoteValidationError('Book of Mormon', '')).toBe('newNote.errorMissingFields');
        });

        it('should require URL for General Conference', () => {
            expect(getNoteValidationError('General Conference', 'Not a URL')).toBe('newNote.urlRequiredForGC');
            expect(getNoteValidationError('General Conference', 'https://churchofjesuschrist.org')).toBeNull();
        });

        it('should require URL for BYU Speeches', () => {
            expect(getNoteValidationError('BYU Speeches', 'Not a URL')).toBe('newNote.urlRequiredForBYU');
            expect(getNoteValidationError('BYU Speeches', 'https://speeches.byu.edu')).toBeNull();
        });

        it('should require non-empty text for Other', () => {
            expect(getNoteValidationError('Other', '   ')).toBe('newNote.urlRequiredForOther');
            expect(getNoteValidationError('Other', 'Some note')).toBeNull();
        });

        it('should return null for valid inputs', () => {
            expect(getNoteValidationError('Book of Mormon', '1 Nephi 3:7')).toBeNull();
        });
    });
});
