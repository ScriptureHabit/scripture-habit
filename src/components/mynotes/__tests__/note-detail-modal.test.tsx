import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NoteDetailModal from '../note-detail-modal';
import { Note } from '../../../types/note';
import { Group } from '../../../types/chat';
import { UserData } from '../../../types/user';

vi.mock('../../../hooks/use-language', () => ({
    useLanguage: () => ({
        t: (key: string) => key,
        language: 'en'
    })
}));

vi.mock('../../notedisplay/note-display', () => ({
    default: ({ text }: { text: string }) => <div data-testid="mock-note-display">{text}</div>
}));

vi.mock('../../../firebase', () => ({
    db: {}
}));

vi.mock('firebase/firestore', () => ({
    doc: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    onSnapshot: vi.fn(() => () => {})
}));

describe('NoteDetailModal', () => {
    const mockOnClose = vi.fn();
    const mockOnEdit = vi.fn();
    const mockOnDelete = vi.fn();

    const mockNote: Note = {
        id: 'note-1',
        text: 'This is my test scripture note',
        scripture: 'Book of Mormon',
        chapter: '32',
        createdAt: new Date('2024-05-18T00:00:00Z'),
        sharedMessageIds: {
            'group-1': 'msg-1'
        }
    };

    const mockUserGroups: Group[] = [
        {
            id: 'group-1',
            name: 'Study Group Alpha',
            ownerUserId: 'user-1',
            members: ['user-1'],
            membersCount: 1
        }
    ];

    const mockUserData = {
        uid: 'user-1',
        email: 'test@example.com',
        nickname: 'TestUser',
    } as UserData;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not render when isOpen is false', () => {
        render(
            <NoteDetailModal
                isOpen={false}
                onClose={mockOnClose}
                note={mockNote}
                userGroups={mockUserGroups}
                userData={mockUserData}
                onEdit={mockOnEdit}
                onDelete={mockOnDelete}
            />
        );

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders with dialog role and displays note content when open', () => {
        render(
            <NoteDetailModal
                isOpen={true}
                onClose={mockOnClose}
                note={mockNote}
                userGroups={mockUserGroups}
                userData={mockUserData}
                onEdit={mockOnEdit}
                onDelete={mockOnDelete}
            />
        );

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(screen.getByTestId('mock-note-display')).toHaveTextContent('This is my test scripture note');
        expect(screen.getByText('Study Group Alpha')).toBeInTheDocument();
    });

    it('calls onClose when Escape key is pressed', () => {
        render(
            <NoteDetailModal
                isOpen={true}
                onClose={mockOnClose}
                note={mockNote}
                userGroups={mockUserGroups}
                userData={mockUserData}
                onEdit={mockOnEdit}
                onDelete={mockOnDelete}
            />
        );

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onEdit when edit button is clicked', () => {
        render(
            <NoteDetailModal
                isOpen={true}
                onClose={mockOnClose}
                note={mockNote}
                userGroups={mockUserGroups}
                userData={mockUserData}
                onEdit={mockOnEdit}
                onDelete={mockOnDelete}
            />
        );

        fireEvent.click(screen.getByTestId('edit-note-btn'));
        expect(mockOnEdit).toHaveBeenCalledWith(mockNote);
    });

    it('calls onDelete when delete button is clicked', () => {
        render(
            <NoteDetailModal
                isOpen={true}
                onClose={mockOnClose}
                note={mockNote}
                userGroups={mockUserGroups}
                userData={mockUserData}
                onEdit={mockOnEdit}
                onDelete={mockOnDelete}
            />
        );

        fireEvent.click(screen.getByTestId('delete-note-btn'));
        expect(mockOnDelete).toHaveBeenCalledWith(mockNote);
    });
});
