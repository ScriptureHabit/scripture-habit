import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../hooks/use-language', () => ({
    useLanguage: vi.fn(),
}));

vi.mock('../../firebase', () => ({
    auth: {
        currentUser: {
            getIdToken: vi.fn().mockResolvedValue('test-token'),
        },
    },
    appCheck: {},
}));

vi.mock('firebase/app-check', () => ({
    getToken: vi.fn().mockResolvedValue({ token: 'app-check-token' }),
}));

vi.mock('react-toastify', () => ({
    toast: {
        info: vi.fn(),
        error: vi.fn(),
    },
}));

import GroupCard from '../group-card';
import { useLanguage } from '../../hooks/use-language';
import { auth } from '../../firebase';
import { getToken } from 'firebase/app-check';
import { toast } from 'react-toastify';

const mockUseLanguage = vi.mocked(useLanguage);
const mockGetToken = vi.mocked(getToken);
const mockToast = vi.mocked(toast);

const defaultLanguage = 'en';
const mockLanguageContext = {
    language: defaultLanguage,
    setLanguage: vi.fn(),
    t: (key: string) => key,
    tArray: () => [],
    isLoaded: true,
    translateBookName: (value: string | null | undefined) => value || '',
    translateChapterField: (value: string | null | undefined) => value || '',
    bookTranslations: {},
};

describe('GroupCard', () => {
    let dateNowSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-19T12:00:00Z').getTime());
        mockUseLanguage.mockReturnValue(mockLanguageContext);
        mockToast.info.mockReset();
        mockToast.error.mockReset();
        mockGetToken.mockResolvedValue({ token: 'app-check-token' });
        (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ translatedText: 'Translated Group' }) });
        window.sessionStorage.clear();
    });

    afterEach(() => {
        dateNowSpy.mockRestore();
    });

    const baseGroup: any = {
        id: 'group1',
        name: 'My Group',
        members: ['member1'],
        membersCount: 1,
        translations: {},
    };

    it('renders active status when a recent message exists', async () => {
        const activeGroup = {
            ...baseGroup,
            lastMessageAt: { seconds: Math.floor((new Date('2026-05-19T10:00:00Z').getTime()) / 1000) },
            createdAt: { seconds: Math.floor((new Date('2026-05-17T00:00:00Z').getTime()) / 1000) },
        };

        await act(async () => {
            render(<GroupCard group={activeGroup} currentUser={{ uid: 'user1' }} />);
        });

        expect(screen.getByText('groupCard.statusActive')).toBeDefined();
    });

    it('renders new status when created less than 48 hours ago and no recent activity', async () => {
        const newGroup = {
            ...baseGroup,
            lastMessageAt: null,
            lastNoteAt: null,
            createdAt: { seconds: Math.floor((new Date('2026-05-18T13:00:00Z').getTime()) / 1000) },
        };

        await act(async () => {
            render(<GroupCard group={newGroup} currentUser={{ uid: 'user1' }} />);
        });

        expect(screen.getByText('groupCard.statusNew')).toBeDefined();
    });

    it('renders relaxed status for old groups', async () => {
        const relaxedGroup = {
            ...baseGroup,
            lastMessageAt: { seconds: Math.floor((new Date('2026-05-16T10:00:00Z').getTime()) / 1000) },
            createdAt: { seconds: Math.floor((new Date('2026-05-01T00:00:00Z').getTime()) / 1000) },
        };

        await act(async () => {
            render(<GroupCard group={relaxedGroup} currentUser={{ uid: 'user1' }} />);
        });

        expect(screen.getByText('groupCard.statusRelaxed')).toBeDefined();
    });

    it('uses manual translation from group translations without calling fetch', async () => {
        const translatedGroup = {
            ...baseGroup,
            translations: { en: { name: 'Manual Name' } },
        };

        await act(async () => {
            render(<GroupCard group={translatedGroup} currentUser={{ uid: 'user1' }} />);
        });

        expect(await screen.findByText('Manual Name')).toBeDefined();
        expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it('uses cached translation from sessionStorage when available', async () => {
        window.sessionStorage.setItem('trans_name_group1_en', 'Cached Name');
        const cachedGroup = {
            ...baseGroup,
            id: 'group1',
        };

        await act(async () => {
            render(<GroupCard group={cachedGroup} currentUser={{ uid: 'user1' }} />);
        });

        expect(await screen.findByText('Cached Name')).toBeDefined();
        expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it('calls onOpen when current user is already a member', async () => {
        const memberGroup = {
            ...baseGroup,
            members: ['user1'],
        };
        const onOpen = vi.fn();

        await act(async () => {
            render(<GroupCard group={memberGroup} currentUser={{ uid: 'user1' }} onOpen={onOpen} />);
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button'));
        });

        await waitFor(() => expect(onOpen).toHaveBeenCalledWith(memberGroup));
    });

    it('calls onJoin when provided and user is not a member', async () => {
        const onJoin = vi.fn();

        await act(async () => {
            render(<GroupCard group={baseGroup} currentUser={{ uid: 'user1' }} onJoin={onJoin} />);
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button'));
        });

        await waitFor(() => expect(onJoin).toHaveBeenCalledWith('group1', baseGroup));
    });

    it('shows sign in prompt when not logged in and no onJoin handler', async () => {
        await act(async () => {
            render(<GroupCard group={baseGroup} currentUser={null} />);
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button'));
        });

        await waitFor(() => expect(mockToast.info).toHaveBeenCalledWith('groupCard.signInFirst'));
    });

    it('shows join failure toast when fetch returns a bad response', async () => {
        (global as any).fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Join failed' }) });

        await act(async () => {
            render(<GroupCard group={baseGroup} currentUser={{ uid: 'user1' }} />);
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button'));
        });

        await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('groupCard.unableToJoin'));
    });
});
