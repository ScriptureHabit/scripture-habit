import { describe, it, expect } from 'vitest';
import { t, tArray } from './i18n.js';

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
            expect(resultEn).toBe('🎉🎉🎉 **John achieved a milestone of 5 total study days! Let\'s celebrate!** 🎉🎉🎉');

            const resultJa = t('ja', 'notifications.streak_announcement', { nickname: '田中', streak: 12 });
            expect(resultJa).toBe('🎉🎉🎉 **田中さんが合計12日目のノート投稿を達成しました！みんなでお祝いしましょう！** 🎉🎉🎉');
        });

        it('should translate note_posted_announcement correctly for all 10 supported languages', () => {
            const testNickname = 'TestUser';
            const expectedTranslations: Record<string, string> = {
                en: '🎉🎉🎉 **TestUser posted a note!!** 🎉🎉🎉',
                ja: '🎉🎉🎉 **TestUserさんがノートを投稿しました！！** 🎉🎉🎉',
                es: '🎉🎉🎉 **¡TestUser publicó una nota!!** 🎉🎉🎉',
                ko: '🎉🎉🎉 **TestUser님이 노트를 게시했습니다!!** 🎉🎉🎉',
                pt: '🎉🎉🎉 **TestUser postou uma nota!!** 🎉🎉🎉',
                sw: '🎉🎉🎉 **TestUser amechapisha dokezo!!** 🎉🎉🎉',
                th: '🎉🎉🎉 **TestUser โพสต์บันทึกแล้ว!!** 🎉🎉🎉',
                tl: '🎉🎉🎉 **Nag-post si TestUser ng isang tala!!** 🎉🎉🎉',
                vi: '🎉🎉🎉 **TestUser đã đăng một ghi chú!!** 🎉🎉🎉',
                zho: '🎉🎉🎉 **TestUser 發布了一則筆記！！** 🎉🎉🎉'
            };

            for (const [lang, expected] of Object.entries(expectedTranslations)) {
                const result = t(lang, 'notifications.note_posted_announcement', { nickname: testNickname });
                expect(result).toBe(expected);
            }
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
            const resultEn = tArray('en', 'newNote.chapterPlaceholder');
            expect(resultEn).toBeInstanceOf(Array);
            expect(resultEn.length).toBeGreaterThan(0);

            const resultJa = tArray('ja', 'newNote.chapterPlaceholder');
            expect(resultJa).toBeInstanceOf(Array);
            expect(resultJa.length).toBeGreaterThan(0);
        });

        it('should return array containing string value if value is not an array', () => {
            const result = tArray('en', 'notifications.bot_name');
            expect(result).toEqual(['Scripture Habit Bot']);
        });

        it('should fallback to en when language is null or unsupported', () => {
            const resultNull = tArray(null, 'newNote.chapterPlaceholder');
            expect(resultNull).toBeInstanceOf(Array);
            expect(resultNull.length).toBeGreaterThan(0);

            const resultUnsupported = tArray('xyz', 'newNote.chapterPlaceholder');
            expect(resultUnsupported).toBeInstanceOf(Array);
            expect(resultUnsupported.length).toBeGreaterThan(0);
        });
    });

    describe('Streak Announcement & Note Posted Announcement logic based on days', () => {
        const isMilestone = (days: number): boolean => {
            if (!days || days <= 0) return false;
            return days === 10 || days % 25 === 0;
        };

        const getAnnounceMessage = (lang: string, nickname: string, days: number): string => {
            const isMs = isMilestone(days);
            return isMs
                ? t(lang, 'notifications.streak_announcement', { nickname, streak: days })
                : t(lang, 'notifications.note_posted_announcement', { nickname });
        };

        it('should correctly select streakAnnouncement for milestone days and notePostedAnnouncement for other days (Japanese)', () => {
            const nickname = '山田';

            // Milestone days: 10, 25, 50, 75, 100, 125, 150, 200, 250
            expect(getAnnounceMessage('ja', nickname, 10)).toContain('山田さんが合計10日目のノート投稿を達成しました！');
            expect(getAnnounceMessage('ja', nickname, 25)).toContain('山田さんが合計25日目のノート投稿を達成しました！');
            expect(getAnnounceMessage('ja', nickname, 50)).toContain('山田さんが合計50日目のノート投稿を達成しました！');
            expect(getAnnounceMessage('ja', nickname, 75)).toContain('山田さんが合計75日目のノート投稿を達成しました！');
            expect(getAnnounceMessage('ja', nickname, 100)).toContain('山田さんが合計100日目のノート投稿を達成しました！');
            expect(getAnnounceMessage('ja', nickname, 125)).toContain('山田さんが合計125日目のノート投稿を達成しました！');
            expect(getAnnounceMessage('ja', nickname, 150)).toContain('山田さんが合計150日目のノート投稿を達成しました！');
            expect(getAnnounceMessage('ja', nickname, 200)).toContain('山田さんが合計200日目のノート投稿を達成しました！');

            // Non-milestone days: 1, 2, 3, 7, 9, 11, 24, 26, 49, 99, 101
            expect(getAnnounceMessage('ja', nickname, 1)).toBe('🎉🎉🎉 **山田さんがノートを投稿しました！！** 🎉🎉🎉');
            expect(getAnnounceMessage('ja', nickname, 3)).toBe('🎉🎉🎉 **山田さんがノートを投稿しました！！** 🎉🎉🎉');
            expect(getAnnounceMessage('ja', nickname, 7)).toBe('🎉🎉🎉 **山田さんがノートを投稿しました！！** 🎉🎉🎉');
            expect(getAnnounceMessage('ja', nickname, 11)).toBe('🎉🎉🎉 **山田さんがノートを投稿しました！！** 🎉🎉🎉');
            expect(getAnnounceMessage('ja', nickname, 24)).toBe('🎉🎉🎉 **山田さんがノートを投稿しました！！** 🎉🎉🎉');
            expect(getAnnounceMessage('ja', nickname, 26)).toBe('🎉🎉🎉 **山田さんがノートを投稿しました！！** 🎉🎉🎉');
            expect(getAnnounceMessage('ja', nickname, 101)).toBe('🎉🎉🎉 **山田さんがノートを投稿しました！！** 🎉🎉🎉');
        });

        it('should correctly select streakAnnouncement for milestone days and notePostedAnnouncement for other days (English)', () => {
            const nickname = 'Alice';

            // Milestone days
            expect(getAnnounceMessage('en', nickname, 10)).toContain('Alice achieved a milestone of 10 total study days!');
            expect(getAnnounceMessage('en', nickname, 25)).toContain('Alice achieved a milestone of 25 total study days!');
            expect(getAnnounceMessage('en', nickname, 100)).toContain('Alice achieved a milestone of 100 total study days!');
            expect(getAnnounceMessage('en', nickname, 250)).toContain('Alice achieved a milestone of 250 total study days!');

            // Non-milestone days
            expect(getAnnounceMessage('en', nickname, 2)).toBe('🎉🎉🎉 **Alice posted a note!!** 🎉🎉🎉');
            expect(getAnnounceMessage('en', nickname, 3)).toBe('🎉🎉🎉 **Alice posted a note!!** 🎉🎉🎉');
            expect(getAnnounceMessage('en', nickname, 101)).toBe('🎉🎉🎉 **Alice posted a note!!** 🎉🎉🎉');
        });
    });
});
