import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NoteCard from './note-card';
import { Note } from '../../types/note';

vi.mock('../../hooks/use-language', () => ({
    useLanguage: () => ({
        language: 'ja',
        t: (key: string) => {
            const translations: Record<string, string> = {
                'myNotes.readStudyMaterial': '学習資料を読む',
                'myNotes.readInGospelLibrary': '福音ライブラリーで読む',
                'myNotes.goToByuSpeech': 'BYUスピーチへ',
                'oneTapStudy.categoryOneTap': 'ワンタップ',
                'oneTapStudy.themeLabel': 'テーマ',
                'noteLabels.scripture': 'カテゴリ',

                'noteLabels.chapter': 'テーマ',
                'noteLabels.comment': 'コメント',
            };
            return translations[key] || key;
        },
        translateChapterField: (v: string) => v,
        bookTranslations: {},
    }),
}));

vi.mock('../common/lazy-markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

describe('NoteCard', () => {
    it('does NOT generate any link when scripture is familyStudy', () => {
        const familyNote: Note = {
            id: 'note-1',
            scripture: 'familyStudy',
            chapter: 'charity',
            comment: '家族といっしょに「慈愛」について話し合い、聖典を学びました。',
            text: '**家族学習 慈愛**\n\n家族といっしょに「慈愛」について話し合い、聖典を学びました。',
        };

        render(<NoteCard note={familyNote} />);
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByText(/学習資料を読む/)).toBeNull();
        expect(screen.queryByText(/福音ライブラリー/)).toBeNull();
    });

    it('does NOT generate any link when note text has family study category even if scripture is Other', () => {
        const legacyFamilyNote: Note = {
            id: 'note-2',
            scripture: 'Other',
            chapter: 'charity',
            comment: '家族といっしょに「慈愛」について話し合い、聖典を学びました。',
            text: '**カテゴリ: 家族学習**\n**テーマ: 慈愛**\n\n**コメント:**\n家族といっしょに「慈愛」について話し合い、聖典を学びました。',
        };

        render(<NoteCard note={legacyFamilyNote} />);
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByText(/学習資料を読む/)).toBeNull();
    });

    it('does NOT generate any link for Other category when chapter is not a valid URL', () => {
        const textNote: Note = {
            id: 'note-3',
            scripture: 'Other',
            chapter: 'Prayer & Fasting Topic',
            comment: 'Personal thoughts on prayer',
            text: '**Other Prayer & Fasting Topic**\n\nPersonal thoughts on prayer',
        };

        render(<NoteCard note={textNote} />);
        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByText(/学習資料を読む/)).toBeNull();
    });

    it('generates study material link for Other category when chapter is a valid URL', () => {
        const urlNote: Note = {
            id: 'note-4',
            scripture: 'Other',
            chapter: 'https://www.churchofjesuschrist.org/study/article/1',
            comment: 'Great article',
            text: '**Other Article**\n\nGreat article',
        };

        render(<NoteCard note={urlNote} />);
        const link = screen.getByRole('link');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://www.churchofjesuschrist.org/study/article/1');
        expect(link).toHaveTextContent('学習資料を読む');
    });

    it('generates Gospel Library link for standard scriptures', () => {
        const scriptureNote: Note = {
            id: 'note-5',
            scripture: 'Book of Mormon',
            chapter: '1 Nephi 3:7',
            comment: 'I will go and do',
            text: '**Book of Mormon 1 Nephi 3:7**\n\nI will go and do',
        };

        render(<NoteCard note={scriptureNote} />);
        const link = screen.getByRole('link');
        expect(link).toBeInTheDocument();
        expect(link).toHaveTextContent('福音ライブラリーで読む');
    });
});
