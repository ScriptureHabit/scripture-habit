import { createElement, type ReactElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LanguageContext, LanguageContextType } from '../../context/language-context';
import UserProfileModal from './user-profile-modal';
import type { UserData } from '../../types/user';

const mockContext: LanguageContextType = {
    language: 'en',
    setLanguage: () => {},
    t: (key: string) => key,
    tArray: () => [],
    isLoaded: true,
    translateBookName: (value) => value || '',
    translateChapterField: (value) => value || '',
    bookTranslations: {}
};

const renderWithLanguageProvider = (ui: ReactElement) => {
    return render(createElement(LanguageContext.Provider, { value: mockContext }, ui));
};

describe('UserProfileModal', () => {
    it('renders nothing when no user is provided', () => {
        const onClose = vi.fn();
        const { container } = renderWithLanguageProvider(<UserProfileModal user={null} onClose={onClose} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('renders user details and toggles full image overlay when photoURL exists', () => {
        const onClose = vi.fn();
        const user: UserData = {
            uid: 'u1',
            nickname: 'TestUser',
            photoURL: 'https://example.com/avatar.png',
            stake: 'Test Stake',
            ward: 'Test Ward',
            bio: 'This is a bio.',
            streakCount: 9,
            daysStudiedCount: 18,
            totalNotes: 7
        };

        const { container } = renderWithLanguageProvider(<UserProfileModal user={user} onClose={onClose} />);

        expect(screen.getByText('TestUser')).toBeInTheDocument();
        expect(screen.getByText('Test Stake')).toBeInTheDocument();
        expect(screen.getByText('Test Ward')).toBeInTheDocument();
        expect(screen.getByText('This is a bio.')).toBeInTheDocument();
        expect(screen.getByText('profile.level')).toBeInTheDocument();
        expect(screen.getByText('dashboard.streak')).toBeInTheDocument();
        expect(screen.getByText('dashboard.totalNotes')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
        expect(screen.getByText('18')).toBeInTheDocument();
        expect(screen.getByText('7')).toBeInTheDocument();

        const closeButton = container.querySelector('.close-btn');
        expect(closeButton).toBeInstanceOf(HTMLButtonElement);
        fireEvent.click(closeButton!);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('opens and closes the full image overlay on photo click and overlay click', () => {
        const onClose = vi.fn();
        const user: UserData = {
            uid: 'u2',
            nickname: 'PhotoUser',
            photoURL: 'https://example.com/photo.png',
            streakCount: 3,
            daysStudiedCount: 0,
            totalNotes: 0
        };

        const { container } = renderWithLanguageProvider(<UserProfileModal user={user} onClose={onClose} />);

        const avatar = screen.getByRole('img', { name: 'PhotoUser' });
        fireEvent.click(avatar);

        expect(container.querySelector('.full-avatar-img')).toBeInTheDocument();

        const fullImageClose = container.querySelector('.full-image-close');
        expect(fullImageClose).toBeInstanceOf(HTMLElement);
        fireEvent.click(fullImageClose!);
        expect(container.querySelector('.full-avatar-img')).not.toBeInTheDocument();
    });

    it('renders initial fallback when photoURL is missing', () => {
        const onClose = vi.fn();
        const user: UserData = {
            uid: 'u3',
            nickname: 'Anon',
            streakCount: 1,
            daysStudiedCount: 3,
            totalNotes: 2
        };

        const { container } = renderWithLanguageProvider(<UserProfileModal user={user} onClose={onClose} />);

        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.queryByAltText('Anon')).not.toBeInTheDocument();
        const avatar = container.querySelector('.user-avatar-large');
        expect(avatar).toBeInstanceOf(HTMLElement);
        fireEvent.click(avatar!);
        expect(onClose).not.toHaveBeenCalled();
    });
});
