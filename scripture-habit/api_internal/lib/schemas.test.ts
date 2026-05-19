import { describe, it, expect } from 'vitest';
import { postNoteSchema } from './schemas.js';

describe('schemas core lib tests', () => {
    describe('noHtmlTags validation', () => {
        const commentSchema = postNoteSchema.shape.comment;

        it('should pass normal text', () => {
            const result = commentSchema.safeParse('This is a normal comment.');
            expect(result.success).toBe(true);
        });

        it('should fail text with HTML tags', () => {
            const result = commentSchema.safeParse('This has <script>alert(1)</script> tags.');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('HTML tags are not allowed');
            }
        });

        it('should pass empty string to trigger falsy fallback (line 12)', () => {
            const resultEmpty = commentSchema.safeParse('');
            expect(resultEmpty.success).toBe(true);
        });
    });
});
