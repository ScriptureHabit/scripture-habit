import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NewNote from './new-note';
import { useLanguage } from '../../hooks/use-language';
import { UserData } from '../../types/user';
import type { Note } from '../../types/note';
import type { ScriptureCategory } from '../../types/scripture';

// Mock LanguageContext
vi.mock('../../hooks/use-language', () => ({
    useLanguage: vi.fn(),
}));

// Dynamic mock variables
const mockUseUrlMetaFetcher = vi.fn();
const mockUseAIGenerator = vi.fn();
const mockUseNoteSubmission = vi.fn();
const mockUseRandomNote = vi.fn();

// Mock modular hooks
vi.mock('./hooks/use-url-meta-fetcher', () => ({
    useUrlMetaFetcher: (...args: any[]) => mockUseUrlMetaFetcher(...args),
}));
vi.mock('./hooks/use-ai-generator', () => ({
    useAIGenerator: (...args: any[]) => mockUseAIGenerator(...args),
}));
vi.mock('./hooks/use-note-submission', () => ({
    useNoteSubmission: (...args: any[]) => mockUseNoteSubmission(...args),
}));
vi.mock('./hooks/use-random-note', () => ({
    useRandomNote: (...args: any[]) => mockUseRandomNote(...args),
}));

// Mock subcomponents
vi.mock('./subcomponents/note-sharing-options', () => ({
    default: ({ handleGroupSelection }: any) => (
        <div data-testid="sharing-options">
            <button data-testid="toggle-group-1" onClick={() => handleGroupSelection('group1')}>
                Toggle Group 1
            </button>
        </div>
    ),
}));

vi.mock('./subcomponents/close-confirm-modal', () => ({
    default: ({ onClose, setShowCloseConfirm, handleSubmit }: any) => (
        <div data-testid="close-confirm-modal">
            <button data-testid="confirm-close" onClick={onClose}>Confirm Close</button>
            <button data-testid="cancel-close" onClick={() => setShowCloseConfirm(false)}>Cancel Close</button>
            <button data-testid="submit-close" onClick={handleSubmit}>Submit Close</button>
        </div>
    ),
}));

vi.mock('./subcomponents/random-scripture-menu', () => ({
    default: ({ setShowRandomMenu, handlePickRandomReadingPlan }: any) => (
        <div data-testid="random-scripture-menu">
            <button data-testid="close-random" onClick={() => setShowRandomMenu(false)}>Close Random</button>
            <button data-testid="pick-random-plan" onClick={handlePickRandomReadingPlan}>Pick Plan</button>
        </div>
    ),
}));

vi.mock('./subcomponents/scripture-selection-modal', () => ({
    default: ({ onClose, fillScriptureData }: any) => (
        <div data-testid="scripture-selection-modal">
            <button data-testid="close-selection" onClick={onClose}>Close Selection</button>
            <button data-testid="fill-scripture" onClick={() => fillScriptureData('1 Nephi 3')}>Fill Scripture (BoM)</button>
            <button data-testid="fill-other" onClick={() => fillScriptureData('Some Random Book 5')}>Fill Other</button>
        </div>
    ),
}));

interface MockSelectProps {
    onChange: (val: { value: string }) => void;
    options: Array<{ value: string; label: string }>;
    value: { value: string} | string | null;
    styles?: any;
}

vi.mock('react-select', () => ({
    default: ({ onChange, options, value }: MockSelectProps) => {
        return (
            <select 
                data-testid="scripture-select" 
                title="Scripture Select"
                value={typeof value === 'object' ? value?.value : value || ''}
                onChange={(e) => {
                    onChange({ value: e.target.value });
                }}
            >
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        );
    }
}));

describe('new-note component suite', () => {
    const mockUserData = { uid: 'user1', nickname: 'Tester' };
    const mockSubmitFn = vi.fn();
    const mockGenerateQuestions = vi.fn();

    const mockLanguageContext = {
        language: 'en' as const,
        setLanguage: vi.fn(),
        t: (k: string) => k,
        tArray: (k: string) => {
            if (k === 'newNote.chapterPlaceholder') return ['Read Alma 32', 'Read 1 Nephi 3'];
            if (k === 'newNote.commentPlaceholder') return ['What did you learn today?'];
            return [];
        },
        isLoaded: true,
        translateBookName: (b: string | null | undefined) => b || '',
        translateChapterField: (c: string | null | undefined) => c || '',
        bookTranslations: {
            '1 Nephi': '1 Nephi',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useLanguage).mockReturnValue(mockLanguageContext);

        mockUseUrlMetaFetcher.mockReturnValue({ urlMeta: null, urlLoading: false });
        mockUseAIGenerator.mockReturnValue({
            aiQuestion: '',
            aiLoading: false,
            handleGenerateQuestions: mockGenerateQuestions,
        });
        mockUseNoteSubmission.mockReturnValue({
            loading: false,
            handleSubmit: mockSubmitFn,
        });
        mockUseRandomNote.mockReturnValue({
            showRandomMenu: false,
            showSelectionModal: false,
            availableReadingPlanScripts: [],
            handlePickRandomReadingPlan: vi.fn(),
            setShowRandomMenu: vi.fn(),
            setShowSelectionModal: vi.fn(),
        });
    });

    it('does not render when closed', () => {
        const { container } = render(<NewNote isOpen={false} onClose={vi.fn()} userData={mockUserData as UserData} />);
        expect(container.firstChild).toBeNull();
    });

    it('calls onClose directly when cancel is clicked on an empty/clean form', () => {
        const onClose = vi.fn();
        render(<NewNote isOpen={true} onClose={onClose} userData={mockUserData as UserData} />);

        const cancelBtn = screen.getByText('newNote.cancel');
        fireEvent.click(cancelBtn);

        expect(onClose).toHaveBeenCalled();
        expect(screen.queryByTestId('close-confirm-modal')).toBeNull();
    });

    it('triggers the onSelect callback from useRandomNote and updates scripture/chapter state', () => {
        let capturedOnSelect: any = null;
        mockUseRandomNote.mockImplementation((_lang, _translateFn, onSelect) => {
            capturedOnSelect = onSelect;
            return {
                showRandomMenu: false,
                showSelectionModal: false,
                availableReadingPlanScripts: [],
                handlePickRandomReadingPlan: vi.fn(),
                setShowRandomMenu: vi.fn(),
                setShowSelectionModal: vi.fn(),
            };
        });

        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);
        
        expect(capturedOnSelect).toBeTypeOf('function');
        
        act(() => {
            capturedOnSelect('Book of Mormon', '1 Nephi 3');
        });

        const select = screen.getByTestId('scripture-select');
        expect(select).toHaveValue('Book of Mormon');

        const chapterInput = screen.getByTestId('new-note-chapter');
        expect(chapterInput).toHaveValue('1 Nephi 3');
    });

    it('renders form elements and triggers custom placeholders correctly', () => {
        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);
        expect(screen.getByText('newNote.newTitle')).toBeDefined();
        expect(screen.getByText('newNote.chooseScriptureLabel')).toBeDefined();
    });

    it('displays custom placeholders for General Conference, BYU Speeches, and Other scriptures', () => {
        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);
        
        // Select General Conference
        const select = screen.getByTestId('scripture-select');
        fireEvent.change(select, { target: { value: 'General Conference' } });
        expect(screen.getByPlaceholderText('newNote.urlPlaceholder')).toBeDefined();

        // Select BYU Speeches
        fireEvent.change(select, { target: { value: 'BYU Speeches' } });
        expect(screen.getByPlaceholderText('newNote.byuUrlPlaceholder')).toBeDefined();

        // Select Other
        fireEvent.change(select, { target: { value: 'Other' } });
        expect(screen.getByPlaceholderText('newNote.otherUrlPlaceholder')).toBeDefined();
    });

    it('shows url warning hints for General Conference and BYU Speeches if chapter is entered but not a URL', () => {
        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);

        // Set scripture to General Conference and input text that is not a URL
        const select = screen.getByTestId('scripture-select');
        fireEvent.change(select, { target: { value: 'General Conference' } });
        
        const chapterInput = screen.getByTestId('new-note-chapter');
        fireEvent.change(chapterInput, { target: { value: 'April 2026 Talk' } });

        expect(screen.getByText(/newNote.urlRequiredForGC/)).toBeDefined();

        // Set scripture to BYU Speeches
        fireEvent.change(select, { target: { value: 'BYU Speeches' } });
        expect(screen.getByText(/newNote.urlRequiredForBYU/)).toBeDefined();
    });

    it('shows suggestions list and clicks suggestion item, triggers blur timeout', async () => {
        vi.useFakeTimers();
        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);

        const select = screen.getByTestId('scripture-select');
        fireEvent.change(select, { target: { value: 'Book of Mormon' } });

        const chapterInput = screen.getByTestId('new-note-chapter');
        fireEvent.change(chapterInput, { target: { value: '1 Ne' } });

        // suggestions list should show '1 Nephi' since we mocked suggestions utility indirectly
        const suggestionItem = screen.getByText('1 Nephi');
        expect(suggestionItem).toBeDefined();

        // click item
        fireEvent.click(suggestionItem);
        expect(chapterInput).toHaveValue('1 Nephi ');

        // Test blur timeout
        fireEvent.change(chapterInput, { target: { value: '2 Ne' } });
        expect(screen.getByText('2 Nephi')).toBeDefined();
        fireEvent.blur(chapterInput);

        act(() => {
            vi.advanceTimersByTime(200);
        });

        expect(screen.queryByText('2 Nephi')).toBeNull();
        vi.useRealTimers();
    });

    it('toggles share group selection arrays', () => {
        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);

        const toggleBtn = screen.getByTestId('toggle-group-1');
        // click once to add
        fireEvent.click(toggleBtn);
        // click again to filter out
        fireEvent.click(toggleBtn);
    });

    it('renders RandomScriptureMenu subcomponent and allows interactions', () => {
        mockUseRandomNote.mockReturnValue({
            showRandomMenu: true,
            showSelectionModal: false,
            availableReadingPlanScripts: [],
            handlePickRandomReadingPlan: vi.fn(),
            setShowRandomMenu: vi.fn(),
            setShowSelectionModal: vi.fn(),
        });

        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);
        expect(screen.getByTestId('random-scripture-menu')).toBeDefined();
        
        fireEvent.click(screen.getByTestId('close-random'));
    });

    it('renders ScriptureSelectionModal subcomponent and allows category and other selections', () => {
        mockUseRandomNote.mockReturnValue({
            showRandomMenu: false,
            showSelectionModal: true,
            availableReadingPlanScripts: [],
            handlePickRandomReadingPlan: vi.fn(),
            setShowRandomMenu: vi.fn(),
            setShowSelectionModal: vi.fn(),
        });

        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);
        expect(screen.getByTestId('scripture-selection-modal')).toBeDefined();

        fireEvent.click(screen.getByTestId('fill-scripture'));
        fireEvent.click(screen.getByTestId('fill-other'));
        fireEvent.click(screen.getByTestId('close-selection'));
    });

    it('triggers CloseConfirmModal when closing a dirty form, and interacts with buttons', () => {
        const onClose = vi.fn();
        render(<NewNote isOpen={true} onClose={onClose} userData={mockUserData as UserData} />);

        const chapterInput = screen.getByTestId('new-note-chapter');
        fireEvent.change(chapterInput, { target: { value: 'Alma 32' } });

        const cancelBtn = screen.getByText('newNote.cancel');
        fireEvent.click(cancelBtn);

        // Close confirmation should show
        expect(screen.getByTestId('close-confirm-modal')).toBeDefined();

        // Click cancel close
        fireEvent.click(screen.getByTestId('cancel-close'));
        expect(screen.queryByTestId('close-confirm-modal')).toBeNull();

        // Trigger again and click confirm close
        fireEvent.click(cancelBtn);
        fireEvent.click(screen.getByTestId('confirm-close'));
        expect(onClose).toHaveBeenCalled();

        // Trigger again and click submit close
        onClose.mockClear();
        fireEvent.click(cancelBtn);
        fireEvent.click(screen.getByTestId('submit-close'));
        expect(mockSubmitFn).toHaveBeenCalled();
    });

    it('shows action buttons and handles Surprise Me click', () => {
        const setRandomMock = vi.fn();
        mockUseRandomNote.mockReturnValue({
            showRandomMenu: false,
            showSelectionModal: false,
            availableReadingPlanScripts: [],
            handlePickRandomReadingPlan: vi.fn(),
            setShowRandomMenu: setRandomMock,
        });

        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);
        
        const surpriseBtn = screen.getByText('newNote.surpriseMe');
        fireEvent.click(surpriseBtn);
        expect(setRandomMock).toHaveBeenCalledWith(true);
    });

    it('handles AI question generation and display, loader state, and close action', () => {
        const mockSetAiQuestion = vi.fn();
        mockUseAIGenerator.mockReturnValue({
            aiQuestion: 'What did faith mean to Alma?',
            aiLoading: false,
            handleGenerateQuestions: mockGenerateQuestions,
            setAiQuestion: mockSetAiQuestion,
        });

        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);
        
        // AI question should show
        expect(screen.getByText('What did faith mean to Alma?')).toBeDefined();

        const chapterInput = screen.getByTestId('new-note-chapter');
        fireEvent.change(chapterInput, { target: { value: 'Alma 32' } });

        const askAiBtn = screen.getByText('newNote.askAiQuestion');
        fireEvent.click(askAiBtn);
        expect(mockGenerateQuestions).toHaveBeenCalled();

        // Close AI question
        const closeAiBtn = screen.getByText('×');
        fireEvent.click(closeAiBtn);
        expect(mockSetAiQuestion).toHaveBeenCalledWith('');

        // Trigger comment input onChange
        const commentInput = screen.getByTestId('new-note-comment');
        fireEvent.change(commentInput, { target: { value: 'This was a wonderful chapter' } });

        // AI loader state check
        mockUseAIGenerator.mockReturnValue({
            aiQuestion: '',
            aiLoading: true,
            handleGenerateQuestions: mockGenerateQuestions,
        });
        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);
        expect(screen.getByText('...')).toBeDefined();
    });

    it('shows Gospel Library URL and handles URL Metadata Box loading state', () => {
        mockUseUrlMetaFetcher.mockReturnValue({
            urlMeta: null,
            urlLoading: true,
        });

        const noteToEdit: Partial<Note> = {
            scripture: 'General Conference' as ScriptureCategory,
            chapter: 'https://churchofjesuschrist.org/study/talk1',
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

        expect(screen.getByText('Fetching title...')).toBeDefined();
    });

    it('shows Gospel Library URL and handles URL Metadata Box layout completed', () => {
        mockUseUrlMetaFetcher.mockReturnValue({
            urlMeta: { title: 'Faith in Jesus Christ', speaker: 'Elder Andersen' },
            urlLoading: false,
        });

        const noteToEdit: Partial<Note> = {
            scripture: 'General Conference' as ScriptureCategory,
            chapter: 'https://churchofjesuschrist.org/study/talk1',
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

        expect(screen.getByText('Faith in Jesus Christ')).toBeDefined();
        expect(screen.getByText('Elder Andersen')).toBeDefined();
        expect(screen.getByText('dashboard.readInGospelLibrary')).toBeDefined();
    });

    it('shows saving loading status on submit button when loading is true', () => {
        mockUseNoteSubmission.mockReturnValue({
            loading: true,
            handleSubmit: mockSubmitFn,
        });

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

        expect(screen.getByText('newNote.saving')).toBeDefined();
    });

    it('triggers handleSubmit from post note button when form is valid and not loading', () => {
        mockUseNoteSubmission.mockReturnValue({
            loading: false,
            handleSubmit: mockSubmitFn,
        });

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

        const postBtn = screen.getByTestId('update-note-button');
        expect(postBtn).not.toBeDisabled();
        fireEvent.click(postBtn);
        expect(mockSubmitFn).toHaveBeenCalled();
    });

    it('shows English suggestion subtitles if language is not English', () => {
        vi.mocked(useLanguage).mockReturnValue({
            ...mockLanguageContext,
            language: 'ja',
            bookTranslations: {
                '1 Nephi': '第1ニーファイ',
            },
        });

        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);

        const select = screen.getByTestId('scripture-select');
        fireEvent.change(select, { target: { value: 'Book of Mormon' } });

        const chapterInput = screen.getByTestId('new-note-chapter');
        fireEvent.change(chapterInput, { target: { value: '1 Ne' } });

        expect(screen.getByText('1 Nephi')).toBeDefined();
    });

    it('handles noteToEdit fallback branches when fields are missing or empty', () => {
        const noteWithTextOnly: Partial<Note> = {
            text: '**Header**\n\nMy actual comment text'
        };

        render(
            <NewNote 
                isOpen={true} 
                onClose={vi.fn()} 
                userData={mockUserData as UserData} 
                noteToEdit={noteWithTextOnly as Note}
            />
        );

        const commentInput = screen.getByTestId('new-note-comment');
        expect(commentInput).toHaveValue('My actual comment text');

        const noteWithNoFields: Partial<Note> = {
            text: ''
        };

        render(
            <NewNote 
                isOpen={true} 
                onClose={vi.fn()} 
                userData={mockUserData as UserData} 
                noteToEdit={noteWithNoFields as Note}
            />
        );
    });

    it('handles falsy language and empty placeholder fallbacks', () => {
        vi.mocked(useLanguage).mockReturnValue({
            ...mockLanguageContext,
            language: '' as any,
            tArray: () => []
        });

        render(<NewNote isOpen={true} onClose={vi.fn()} userData={mockUserData as UserData} />);
    });
});
