import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NoteDisplay from './NoteDisplay';
import { useLanguage } from '../../context/LanguageContext';

// Mock LanguageContext
vi.mock('../../context/LanguageContext', () => ({
    useLanguage: vi.fn(),
}));

// Mock ReactMarkdown since it can be problematic in JSDOM
vi.mock('react-markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// Mock LinkPreview and GCNoteRenderer to isolate NoteDisplay
vi.mock('../linkpreview/LinkPreview', () => ({
    default: () => <div data-testid="link-preview">Link Preview</div>,
}));

vi.mock('./components/GCNoteRenderer', () => ({
    default: ({ comment }: { comment: string }) => <div data-testid="gc-renderer">{comment}</div>,
}));

describe('NoteDisplay', () => {
    const mockLanguageContext = {
        language: 'en' as const,
        setLanguage: vi.fn(),
        t: (k: string) => k,
        tArray: () => [],
        isLoaded: true,
        translateBookName: (b: string | null | undefined) => b || '',
        translateChapterField: (v: string | null | undefined) => v || '',
        bookTranslations: {},
    };

    it('renders simple text correctly', () => {
        vi.mocked(useLanguage).mockReturnValue(mockLanguageContext);

        render(<NoteDisplay text="Hello world" isSent={true} />);
        expect(screen.getByText('Hello world')).toBeDefined();
    });

    it('renders structured notes with labels', () => {
        vi.mocked(useLanguage).mockReturnValue({
            ...mockLanguageContext,
            t: (key: string) => {
                if (key === 'noteLabels.scripture') return 'Scripture';
                if (key === 'noteLabels.comment') return 'Comment';
                return key;
            },
        });

        const structuredText = `Scripture: Genesis 1:1\nComment: In the beginning`;
        render(<NoteDisplay text={structuredText} isSent={false} />);
        
        const markdown = screen.getByTestId('markdown').textContent || '';
        expect(markdown).toContain('Scripture:');
        expect(markdown).toContain('Genesis 1:1');
        expect(markdown).toContain('Comment:');
        expect(markdown).toContain('In the beginning');
    });

    it('shows AI translation header when translatedText is provided', () => {
        vi.mocked(useLanguage).mockReturnValue({
            ...mockLanguageContext,
            language: 'ja',
            t: (key: string) => key === 'groupChat.translated' ? '翻訳済み' : key,
        });

        render(
            <NoteDisplay 
                text="Original" 
                translatedText="Translated" 
                isSent={false} 
            />
        );

        expect(screen.getByText(/AI 翻訳済み/)).toBeDefined();
        expect(screen.getByText('Translated')).toBeDefined();
    });

    it('uses GCNoteRenderer for General Conference notes', () => {
        vi.mocked(useLanguage).mockReturnValue(mockLanguageContext);

        const gcNote = `Scripture: General Conference\nChapter: https://www.churchofjesuschrist.org/study/general-conference/2024/04/11nelson\nComment: Great talk`;
        render(<NoteDisplay text={gcNote} isSent={false} />);

        expect(screen.getByTestId('gc-renderer')).toBeDefined();
        expect(screen.getByText('Great talk')).toBeDefined();
    });
});
