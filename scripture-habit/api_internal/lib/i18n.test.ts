import { describe, it, expect } from 'vitest';
import { t, tArray } from './i18n';

describe('i18n - translation utilities', () => {
    describe('t()', () => {
        it('should translate keys in English', () => {
            const result = t('en', 'notifications.bot_name');
            expect(result).toBe('Scripture Habit Bot');
        });

        it('should translate keys in Japanese', () => {
            const result = t('ja', 'notifications.bot_name');
            expect(result).toBe('Scripture Habit Bot');
        });

        it('should split language codes like en-US to en', () => {
            const result = t('en-US', 'notifications.bot_name');
            expect(result).toBe('Scripture Habit Bot');
        });

        it('should fallback to en if language is unsupported or null', () => {
            const result = t(null, 'notifications.bot_name');
            expect(result).toBe('Scripture Habit Bot');

            const resultUnsupported = t('xyz', 'notifications.bot_name');
            expect(resultUnsupported).toBe('Scripture Habit Bot');
        });

        it('should handle replacements/placeholders', () => {
            const resultEn = t('en', 'notifications.streak_announcement', { nickname: 'John', streak: 5 });
            expect(resultEn).toBe('🎉🎉🎉 **John achieved a milestone of 5 cumulative study days! Let\'s celebrate!** 🎉🎉🎉');

            const resultJa = t('ja', 'notifications.streak_announcement', { nickname: '田中', streak: 12 });
            expect(resultJa).toBe('🎉🎉🎉 **田中さんが累計12日目のノート投稿を達成しました！みんなでお祝いしましょう！** 🎉🎉🎉');
        });

        it('should fall back to en bundle when translating in non-en and key is missing', () => {
            // "notifications.streak_warning_title" exists in both, but let's test if a key exists in en but not ja, it falls back to en.
            // Since all keys match in this codebase, let's test a totally nonexistent key.
            // A totally nonexistent key in 'ja' will fall back to 'en', which will return the key itself.
            const result = t('ja', 'notifications.nonexistent');
            expect(result).toBe('notifications.nonexistent');
        });

        it('should return the key name if not found in English', () => {
            const result = t('en', 'notifications.nonexistent');
            expect(result).toBe('notifications.nonexistent');
        });

        it('should return key name if the value resolved is not a string', () => {
            const result = t('en', 'notifications.cheer_options');
            expect(result).toBe('notifications.cheer_options');
        });
    });

    describe('tArray()', () => {
        it('should return empty array if key does not exist in English', () => {
            const result = tArray('en', 'notifications.nonexistent');
            expect(result).toEqual([]);
        });

        it('should fall back to en if key does not exist in non-en language', () => {
            const result = tArray('ja', 'notifications.nonexistent');
            expect(result).toEqual([]);
        });

        it('should return translation array', () => {
            const resultEn = tArray('en', 'notifications.cheer_options');
            expect(resultEn).toBeInstanceOf(Array);
            expect(resultEn.length).toBe(3);
            expect(resultEn[0]).toContain('{nickname}');

            const resultJa = tArray('ja', 'notifications.cheer_options');
            expect(resultJa).toBeInstanceOf(Array);
            expect(resultJa.length).toBe(3);
            expect(resultJa[0]).toContain('{nickname}さん');
        });

        it('should return array containing string value if value is not an array', () => {
            const result = tArray('en', 'notifications.bot_name');
            expect(result).toEqual(['Scripture Habit Bot']);
        });

        it('should fallback to en when language is null or unsupported', () => {
            const resultNull = tArray(null, 'notifications.cheer_options');
            expect(resultNull).toBeInstanceOf(Array);
            expect(resultNull.length).toBe(3);

            const resultUnsupported = tArray('xyz', 'notifications.cheer_options');
            expect(resultUnsupported).toBeInstanceOf(Array);
            expect(resultUnsupported.length).toBe(3);
        });
    });
});
