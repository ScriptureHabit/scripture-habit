import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUnreadAudioAlert } from '../use-unread-audio-alert';
import * as audioFeedback from '../../utils/audio-feedback';
import { Group } from '../../types/chat';

vi.mock('../../utils/audio-feedback', () => ({
    playUnreadNotificationSound: vi.fn(),
    isSoundEnabled: vi.fn(() => true),
}));

describe('useUnreadAudioAlert', () => {
    const currentUserId = 'user-123';
    const otherUserId = 'user-456';

    const createMockGroup = (hasUnread: boolean): Group => ({
        id: 'group-1',
        name: 'Test Group',
        members: [currentUserId, otherUserId],
        lastMessageAt: { seconds: 1000, nanoseconds: 0 },
        lastMessageByUid: otherUserId,
        memberLastReadAt: {
            [currentUserId]: { seconds: hasUnread ? 500 : 1000, nanoseconds: 0 }
        },
        memberJoinedAt: {
            [currentUserId]: { seconds: 100, nanoseconds: 0 }
        }
    } as unknown as Group);

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        vi.mocked(audioFeedback.isSoundEnabled).mockReturnValue(true);
    });

    it('plays notification sound on launch if unread messages exist and not yet alerted in session', () => {
        const groups = [createMockGroup(true)];
        renderHook(() => useUnreadAudioAlert(groups, currentUserId));

        expect(audioFeedback.playUnreadNotificationSound).toHaveBeenCalledTimes(1);
        expect(sessionStorage.getItem('sh_unread_audio_alerted_session')).toBe('true');
    });

    it('does NOT play notification sound on launch if already alerted in session', () => {
        sessionStorage.setItem('sh_unread_audio_alerted_session', 'true');
        const groups = [createMockGroup(true)];
        renderHook(() => useUnreadAudioAlert(groups, currentUserId));

        expect(audioFeedback.playUnreadNotificationSound).not.toHaveBeenCalled();
    });

    it('does NOT play notification sound if there are no unread messages', () => {
        const groups = [createMockGroup(false)];
        renderHook(() => useUnreadAudioAlert(groups, currentUserId));

        expect(audioFeedback.playUnreadNotificationSound).not.toHaveBeenCalled();
        expect(sessionStorage.getItem('sh_unread_audio_alerted_session')).toBeNull();
    });

    it('does NOT play sound when sound is disabled by user setting', () => {
        vi.mocked(audioFeedback.isSoundEnabled).mockReturnValue(false);
        const groups = [createMockGroup(true)];
        renderHook(() => useUnreadAudioAlert(groups, currentUserId));

        expect(audioFeedback.playUnreadNotificationSound).not.toHaveBeenCalled();
    });

    it('plays sound when a new unread message arrives during active session (transition from read to unread)', () => {
        const readGroups = [createMockGroup(false)];
        const { rerender } = renderHook(
            ({ groups }) => useUnreadAudioAlert(groups, currentUserId),
            { initialProps: { groups: readGroups } }
        );

        expect(audioFeedback.playUnreadNotificationSound).not.toHaveBeenCalled();

        // New unread message arrives
        const unreadGroups = [createMockGroup(true)];
        rerender({ groups: unreadGroups });

        expect(audioFeedback.playUnreadNotificationSound).toHaveBeenCalledTimes(1);
    });
});
