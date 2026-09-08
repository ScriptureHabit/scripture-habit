
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock LanguageContext
vi.mock('../../hooks/use-language', () => ({
    useLanguage: vi.fn(),
}));

import NoteDisplay from './note-display';
import { useLanguage } from '../../hooks/use-language';

const mockUseLanguage = vi.mocked(useLanguage);

// Mock ReactMarkdown since it can be problematic in JSDOM
vi.mock('react-markdown', () => ({
    default: ({ children, components }: { children: string, components?: any }) => {
        const content = String(children);
        const parts = content.split(/(\[.*?\]\(.*?\))/g).filter(Boolean);
        return (
            <div data-testid="markdown">
                {parts.map((part, index) => {
                    const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
                    if (match && components?.a) {
                        const [, text, href] = match;
                        const A = components.a;
                        return <A key={index} href={href}>{text}</A>;
                    }
                    if (components?.p) {
                        const P = components.p;
                        return <P key={index}>{part}</P>;
                    }
                    return <span key={index}>{part}</span>;
                })}
            </div>
        );
    },
}));

// Mock LinkPreview and GCNoteRenderer to isolate NoteDisplay
vi.mock('../linkpreview/link-preview', () => ({
    default: () => <div data-testid="link-preview">Link Preview</div>,
}));

vi.mock('./components/gc-note-renderer', () => ({
    default: ({ comment }: { comment: string }) => <div data-testid="gc-renderer">{comment}</div>,
}));

describe('note-display', () => {
    const mockLanguageContext = {
        language: 'en' as const,
        setLanguage: () => {},
        t: (k: string) => k,
        tArray: () => [],
        isLoaded: true,
        translateBookName: (b: string | null | undefined) => b || '',
        translateChapterField: (v: string | null | undefined) => v || '',
        bookTranslations: {},
    };

    it('renders simple text correctly', () => {
        mockUseLanguage.mockReturnValue(mockLanguageContext);

        render(<NoteDisplay text="Hello world" isSent={true} />);
        expect(screen.getByText('Hello world')).toBeDefined();
    });

    it('renders structured notes with labels', () => {
        mockUseLanguage.mockReturnValue({
            ...mockLanguageContext,
            t: (key: string) => {
                if (key === 'noteLabels.scripture') return 'Category';
                if (key === 'noteLabels.chapter') return 'Chapter';
                if (key === 'noteLabels.comment') return 'Comment';
                return key;
            },
        });

        const structuredText = `Category: Genesis\nChapter: 1:1\nComment: In the beginning`;
        render(<NoteDisplay text={structuredText} isSent={false} />);
        
        const markdown = screen.getByTestId('markdown').textContent || '';
        expect(markdown).toContain('Category:');
        expect(markdown).toContain('Genesis');
        expect(markdown).toContain('1:1');
        expect(markdown).toContain('Comment:');
        expect(markdown).toContain('In the beginning');
    });

    it('converts comment URLs while preserving trailing punctuation', () => {
        mockUseLanguage.mockReturnValue({
            ...mockLanguageContext,
            t: (key: string) => {
                if (key === 'noteLabels.scripture') return 'Category';
                if (key === 'noteLabels.chapter') return 'Chapter';
                if (key === 'noteLabels.comment') return 'Comment';
                return key;
            },
        });

        const structuredText = `Category: Genesis\nChapter: 1:1\nComment: See https://example.com.`;
        render(<NoteDisplay text={structuredText} isSent={false} />);

        const link = screen.getByRole('link', { name: 'https://example.com' });
        expect(link).toBeDefined();
        expect(link).toHaveAttribute('href', 'https://example.com');
        expect(screen.getByTestId('markdown').textContent).toContain('.');
    });

    it('calls onRetranslate when the retranslate button is clicked', () => {
        const onRetranslate = vi.fn();
        mockUseLanguage.mockReturnValue({
            ...mockLanguageContext,
            language: 'en',
            t: (key: string) => {
                if (key === 'groupChat.translated') return 'Translated';
                if (key === 'groupChat.showOriginal') return 'See original';
                if (key === 'groupChat.showTranslation') return 'Translate';
                if (key === 'groupChat.reTranslate') return 'Retranslate';
                return key;
            },
        });

        render(
            <NoteDisplay
                text="Great scripture reading today!"
                translatedText="今日の聖典学習はとても素晴らしかったです！"
                isSent={false}
                isTranslating={false}
                onRetranslate={onRetranslate}
            />
        );

        fireEvent.click(screen.getByTitle('Retranslate'));
        expect(onRetranslate).toHaveBeenCalledTimes(1);
    });

    it('shows AI translation header when translatedText is provided', () => {
        mockUseLanguage.mockReturnValue({
            ...mockLanguageContext,
            language: 'ja',
            t: (key: string) => key === 'groupChat.translated' ? '翻訳済み' : key,
        });

        render(
            <NoteDisplay 
                text="Daily scripture study brings peace to my heart." 
                translatedText="毎日の聖典学習は私の心に平安をもたらします。" 
                isSent={false} 
            />
        );

        expect(screen.getByText(/AI 翻訳済み/)).toBeDefined();
        expect(screen.getByText('毎日の聖典学習は私の心に平安をもたらします。')).toBeDefined();
    });

    it('uses GCNoteRenderer for General Conference notes', () => {
        mockUseLanguage.mockReturnValue(mockLanguageContext);

        const gcNote = `Category: General Conference\nTitle: https://www.churchofjesuschrist.org/study/general-conference/2024/04/11nelson\nComment: Great talk`;
        render(<NoteDisplay text={gcNote} isSent={false} />);

        expect(screen.getByTestId('gc-renderer')).toBeDefined();
        expect(screen.getByText('Great talk')).toBeDefined();
    });

    it('shows original text toggle and link preview container for translated simple notes', () => {
        mockUseLanguage.mockReturnValue({
            ...mockLanguageContext,
            t: (key: string) => {
                if (key === 'groupChat.translated') return 'Translated';
                if (key === 'groupChat.showOriginal') return 'See original';
                if (key === 'groupChat.showTranslation') return 'Translate';
                if (key === 'groupChat.reTranslate') return 'Retranslate';
                return key;
            }
        });

        render(
            <NoteDisplay
                text="Check this out https://example.com"
                translatedText="これを見てみてください https://example.com"
                isSent={false}
                isTranslating={false}
                onRetranslate={vi.fn()}
            />
        );

        expect(screen.getByText(/AI Translated/)).toBeDefined();
        expect(screen.getByText('See original')).toBeDefined();
        expect(screen.getByTestId('link-preview')).toBeDefined();

        fireEvent.click(screen.getByText('See original'));
        expect(screen.getByText('Translate')).toBeDefined();
    });

    it('renders family study note with correct category, theme label and comment in Japanese', () => {
        mockUseLanguage.mockReturnValue({
            ...mockLanguageContext,
            language: 'ja',
            t: (key: string, replacements?: Record<string, string | number>) => {
                if (key === 'noteLabels.scripture') return 'カテゴリ';
                if (key === 'noteLabels.comment') return 'コメント';
                if (key === 'familyTheme.categoryFamilyStudy') return '家族学習';
                if (key === 'familyTheme.themeLabel') return 'テーマ';
                if (key === 'familyTheme.themes.charity') return '慈愛';
                if (key === 'familyTheme.familyStudyNoteBody') return `家族といっしょに「${replacements?.theme}」について話し合い、聖典を学びました。`;
                return key;
            },
            translateChapterField: (val?: string | null) => val || '',
        });

        const text = `**カテゴリ:** 家族学習\n**テーマ:** 慈愛\n\n**コメント:**\n家族といっしょに「慈愛」について話し合い、聖典を学びました。`;
        render(
            <NoteDisplay
                text={text}
                isSent={false}
                scripture="familyStudy"
                chapter="charity"
            />
        );

        const markdown = screen.getByTestId('markdown').textContent || '';
        expect(markdown).toContain('カテゴリ:');
        expect(markdown).toContain('家族学習');
        expect(markdown).toContain('テーマ:');
        expect(markdown).toContain('慈愛');
        expect(markdown).toContain('コメント:');
        expect(markdown).toContain('家族といっしょに「慈愛」について話し合い、聖典を学びました。');
    });

    it('translates family study note properly when viewed in English', () => {
        mockUseLanguage.mockReturnValue({
            ...mockLanguageContext,
            language: 'en',
            t: (key: string, replacements?: Record<string, string | number>) => {
                if (key === 'noteLabels.scripture') return 'Category';
                if (key === 'noteLabels.comment') return 'Comment';
                if (key === 'familyTheme.categoryFamilyStudy') return 'Family Study';
                if (key === 'familyTheme.themeLabel') return 'Theme';
                if (key === 'familyTheme.themes.charity') return 'Charity';
                if (key === 'familyTheme.familyStudyNoteBody') return `We discussed "${replacements?.theme}" together as a family and studied the scriptures.`;
                return key;
            },
            translateChapterField: (val?: string | null) => val || '',
        });

        const text = `**カテゴリ:** 家族学習\n**テーマ:** 慈愛\n\n**コメント:**\n家族といっしょに「慈愛」について話し合い、聖典を学びました。`;
        render(
            <NoteDisplay
                text={text}
                isSent={false}
                scripture="familyStudy"
                chapter="charity"
            />
        );

        const markdown = screen.getByTestId('markdown').textContent || '';
        expect(markdown).toContain('Category:');
        expect(markdown).toContain('Family Study');
        expect(markdown).toContain('Theme:');
        expect(markdown).toContain('Charity');
        expect(markdown).toContain('Comment:');
        expect(markdown).toContain('We discussed "Charity" together as a family and studied the scriptures.');
    });
});


