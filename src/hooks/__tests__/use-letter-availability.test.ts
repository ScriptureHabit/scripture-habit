import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLetterAvailability } from '../use-letter-availability';
import * as audioFeedback from '../../utils/audio-feedback';
import { UserData } from '../../types/user';
import { onSnapshot } from 'firebase/firestore';

vi.mock('../../utils/audio-feedback', () => ({
    playUnreadNotificationSound: vi.fn(),
    isSoundEnabled: vi.fn(() => true),
}));

vi.mock('../../firebase', () => ({
    db: {},
}));

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    onSnapshot: vi.fn((_q, cb) => {
        cb({ size: 0, docs: [] });
        return () => {};
    }),
}));

describe('useLetterAvailability', () => {
    const mockUserData: UserData = {
        uid: 'user-123',
        email: 'test@example.com',
        nickname: 'Tester',
        createdAt: new Date().toISOString(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        vi.mocked(audioFeedback.isSoundEnabled).mockReturnValue(true);
    });

    it('returns false and 0 counts if userData is null/undefined', () => {
        const { result } = renderHook(() => useLetterAvailability(null));
        expect(result.current.isLetterAvailable).toBe(false);
        expect(result.current.newNotesCount).toBe(0);
        expect(result.current.hasUnreadDeveloperLetter).toBe(false);
        expect(result.current.unreadLettersCount).toBe(0);
    });

    it('returns isLetterAvailable: true when notes count >= 2 and plays notification sound', () => {
        vi.mocked(onSnapshot).mockImplementation((_q: any, cb: any) => {
            // If it's notes subscription (limit query)
            cb({ size: 2, docs: [{ id: '1', data: () => ({}) }, { id: '2', data: () => ({}) }] });
            return () => {};
        });

        const { result } = renderHook(() => useLetterAvailability(mockUserData));

        expect(result.current.isLetterAvailable).toBe(true);
        expect(result.current.newNotesCount).toBe(2);
        expect(audioFeedback.playUnreadNotificationSound).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem('sh_letter_audio_alerted_session')).toBe('true');
    });

    it('returns isLetterAvailable: true and hasUnreadDeveloperLetter: true when unread developer letter exists', () => {
        vi.mocked(onSnapshot).mockImplementation((_q: any, cb: any) => {
            cb({
                size: 1,
                docs: [
                    {
                        id: 'dev-welcome',
                        data: () => ({ type: 'developer_welcome', read: false })
                    }
                ]
            });
            return () => {};
        });

        const { result } = renderHook(() => useLetterAvailability(mockUserData));

        expect(result.current.isLetterAvailable).toBe(true);
        expect(result.current.hasUnreadDeveloperLetter).toBe(true);
        expect(result.current.unreadLettersCount).toBe(1);
        expect(audioFeedback.playUnreadNotificationSound).toHaveBeenCalledTimes(1);
    });

    it('returns isLetterAvailable: false when notes count < 2 and no unread letters', () => {
        vi.mocked(onSnapshot).mockImplementation((_q: any, cb: any) => {
            cb({ size: 0, docs: [] });
            return () => {};
        });

        const { result } = renderHook(() => useLetterAvailability(mockUserData));

        expect(result.current.isLetterAvailable).toBe(false);
        expect(result.current.newNotesCount).toBe(0);
        expect(result.current.hasUnreadDeveloperLetter).toBe(false);
        expect(result.current.unreadLettersCount).toBe(0);
        expect(audioFeedback.playUnreadNotificationSound).not.toHaveBeenCalled();
    });

    it('does NOT play sound if already alerted in this session', () => {
        sessionStorage.setItem('sh_letter_audio_alerted_session', 'true');
        vi.mocked(onSnapshot).mockImplementation((_q: any, cb: any) => {
            cb({ size: 2, docs: [{ id: '1', data: () => ({}) }, { id: '2', data: () => ({}) }] });
            return () => {};
        });

        const { result } = renderHook(() => useLetterAvailability(mockUserData));

        expect(result.current.isLetterAvailable).toBe(true);
        expect(audioFeedback.playUnreadNotificationSound).not.toHaveBeenCalled();
    });

    it('does NOT play sound if sound is disabled by user', () => {
        vi.mocked(audioFeedback.isSoundEnabled).mockReturnValue(false);
        vi.mocked(onSnapshot).mockImplementation((_q: any, cb: any) => {
            cb({ size: 2, docs: [{ id: '1', data: () => ({}) }, { id: '2', data: () => ({}) }] });
            return () => {};
        });

        const { result } = renderHook(() => useLetterAvailability(mockUserData));

        expect(result.current.isLetterAvailable).toBe(true);
        expect(audioFeedback.playUnreadNotificationSound).not.toHaveBeenCalled();
    });
});
