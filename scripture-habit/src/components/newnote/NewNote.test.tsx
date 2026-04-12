import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import NewNote from './NewNote';
import { useLanguage } from '../../context/LanguageContext';

// Mock LanguageContext
vi.mock('../../context/LanguageContext', () => ({
    useLanguage: vi.fn(),
}));

// Mock modular hooks
vi.mock('./hooks/useUrlMetaFetcher', () => ({
    useUrlMetaFetcher: () => ({ urlMeta: null, urlLoading: false }),
}));
vi.mock('./hooks/useAIGenerator', () => ({
    useAIGenerator: () => ({ aiQuestion: '', aiLoading: false, handleGenerateQuestions: vi.fn() }),
}));
vi.mock('./hooks/useNoteSubmission', () => ({
    useNoteSubmission: () => ({ loading: false, handleSubmit: vi.fn() }),
}));
vi.mock('./hooks/useRandomNote', () => ({
    useRandomNote: () => ({
        showRandomMenu: false,
        showSelectionModal: false,
        handlePickRandomReadingPlan: vi.fn(),
    }),
}));

// Mock subcomponents
vi.mock('./subcomponents/NoteSharingOptions', () => ({
    default: () => <div data-testid="sharing-options">Sharing Options</div>,
}));

// Mock react-select to avoid testing its internals
vi.mock('react-select', () => ({
    default: ({ onChange, options, value }: any) => (
        <select 
            data-testid="scripture-select" 
            title="Scripture Select"
            value={value?.value || value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
        >
            {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    )
}));

describe('NewNote', () => {
    const mockUserData = { uid: 'user1', nickname: 'Tester' };

    it('does not render when closed', () => {
        (useLanguage as any).mockReturnValue({
            t: (k: string) => k,
            tArray: () => [],
        });

        const { container } = render(<NewNote isOpen={false} onClose={vi.fn()} userData={mockUserData as any} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders form elements when open', () => {
        (useLanguage as any).mockReturnValue({
            t: (k: string) => k,
            tArray: () => [],
            language: 'en',
            bookTranslations: {},
        });

        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as any} />);
        
        expect(screen.getByText('newNote.newTitle')).toBeDefined();
        expect(screen.getByText('newNote.chooseScriptureLabel')).toBeDefined();
        expect(screen.getByTestId('sharing-options')).toBeDefined();
    });

    it('calls onClose when clicking cancel while form is empty', () => {
        const onClose = vi.fn();
        (useLanguage as any).mockReturnValue({
            t: (k: string) => k,
            tArray: () => [],
        });

        render(<NewNote isOpen={true} onClose={onClose} userData={mockUserData as any} />);
        
        const cancelBtn = screen.getByText('newNote.cancel');
        fireEvent.click(cancelBtn);
        expect(onClose).toHaveBeenCalled();
    });

    it('populates fields in edit mode', () => {
        (useLanguage as any).mockReturnValue({
            t: (k: string) => k,
            tArray: () => [],
            language: 'en',
            bookTranslations: {},
        });

        const noteToEdit = {
            scripture: 'Book of Mormon',
            chapter: 'Alma 32',
            comment: 'Faith is like a seed',
            text: ''
        };

        render(
            <NewNote 
                isOpen={true} 
                onClose={vi.fn()} 
                userData={mockUserData as any} 
                noteToEdit={noteToEdit as any}
            />
        );

        expect(screen.getByTestId('scripture-select')).toHaveValue('Book of Mormon');
        expect(screen.getByDisplayValue('Alma 32')).toBeDefined();
        expect(screen.getByDisplayValue('Faith is like a seed')).toBeDefined();
    });
});
