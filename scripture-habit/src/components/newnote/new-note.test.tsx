
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NewNote from './new-note';
import { useLanguage } from '../../hooks/useLanguage';
import { UserData } from '../../types/user';
import { Note } from '../../types/note';
import { ScriptureCategory } from '../../types/scripture';

// Mock LanguageContext
vi.mock('../../hooks/useLanguage', () => ({
    useLanguage: vi.fn(),
}));

// Mock modular hooks
vi.mock('./hooks/use-url-meta-fetcher', () => ({
    useUrlMetaFetcher: () => ({ urlMeta: null, urlLoading: false }),
}));
vi.mock('./hooks/use-ai-generator', () => ({
    useAIGenerator: () => ({ aiQuestion: '', aiLoading: false, handleGenerateQuestions: vi.fn() }),
}));
vi.mock('./hooks/use-note-submission', () => ({
    useNoteSubmission: () => ({ loading: false, handleSubmit: vi.fn() }),
}));
vi.mock('./hooks/use-random-note', () => ({
    useRandomNote: () => ({
        showRandomMenu: false,
        showSelectionModal: false,
        handlePickRandomReadingPlan: vi.fn(),
    }),
}));

// Mock subcomponents
vi.mock('./subcomponents/note-sharing-options', () => ({
    default: () => <div data-testid="sharing-options">Sharing Options</div>,
}));

interface MockSelectProps {
    onChange: (val: { value: string }) => void;
    options: Array<{ value: string; label: string }>;
    value: { value: string } | string | null;
}

vi.mock('react-select', () => ({
    default: ({ onChange, options, value }: MockSelectProps) => (
        <select 
            data-testid="scripture-select" 
            title="Scripture Select"
            value={typeof value === 'object' ? value?.value : value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
        >
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    )
}));

describe('new-note', () => {
    const mockUserData = { uid: 'user1', nickname: 'Tester' };

    const mockLanguageContext = {
        language: 'en' as const,
        setLanguage: vi.fn(),
        t: (k: string) => k,
        tArray: () => [],
        isLoaded: true,
        translateBookName: (b: string | null | undefined) => b || '',
        translateChapterField: (c: string | null | undefined) => c || '',
        bookTranslations: {},
    };

    it('does not render when closed', () => {
        vi.mocked(useLanguage).mockReturnValue(mockLanguageContext);

        const { container } = render(<NewNote isOpen={false} onClose={vi.fn()} userData={mockUserData as UserData} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders form elements when open', () => {
        vi.mocked(useLanguage).mockReturnValue(mockLanguageContext);

        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);
        
        expect(screen.getByText('newNote.newTitle')).toBeDefined();
        expect(screen.getByText('newNote.chooseScriptureLabel')).toBeDefined();
        expect(screen.getByTestId('sharing-options')).toBeDefined();
    });

    it('calls onClose when clicking cancel while form is empty', () => {
        const onClose = vi.fn();
        vi.mocked(useLanguage).mockReturnValue(mockLanguageContext);

        render(<NewNote isOpen={true} onClose={onClose} userData={mockUserData as UserData} />);
        
        const cancelBtn = screen.getByText('newNote.cancel');
        fireEvent.click(cancelBtn);
        expect(onClose).toHaveBeenCalled();
    });

    it('populates fields in edit mode', () => {
        vi.mocked(useLanguage).mockReturnValue(mockLanguageContext);

        const noteToEdit: Partial<Note> = {
            scripture: 'Book of Mormon' as ScriptureCategory,
            chapter: 'Alma 32',
            comment: 'Faith is like a seed',
            text: ''
        };
        
        render(
            <NewNote 
                isOpen={true} 
                onClose={vi.fn()} 
                userData={mockUserData as UserData} 
                noteToEdit={noteToEdit as Note}
            />
        );

        expect(screen.getByTestId('scripture-select')).toHaveValue('Book of Mormon');
        expect(screen.getByDisplayValue('Alma 32')).toBeDefined();
        expect(screen.getByDisplayValue('Faith is like a seed')).toBeDefined();
    });
});


