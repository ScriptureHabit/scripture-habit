import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { FamilyThemeModal } from '../family-theme-modal';
import { Group } from '../../../../types/chat';
import { UserData } from '../../../../types/user';
import apiClient from '../../../../utils/api-client';
import * as audioFeedback from '../../../../utils/audio-feedback';
import * as confettiUtils from '../../../../utils/confetti-utils';
import { useLevelUpStore } from '../../../../store/use-level-up-store';
import { useMilestoneStore } from '../../../../store/use-milestone-store';

vi.mock('../../../../utils/api-client', () => ({
    default: {
        post: vi.fn()
    }
}));

vi.mock('../../../../utils/audio-feedback', () => ({
    playNoteSubmitSound: vi.fn(),
    isSoundEnabled: vi.fn(() => true)
}));

vi.mock('../../../../utils/confetti-utils', () => ({
    triggerConfetti: vi.fn()
}));

vi.mock('../../../../hooks/use-language', () => ({
    useLanguage: () => ({
        t: (key: string, replacements?: Record<string, string | number>) => {
            if (key === 'familyTheme.completedTitle') return `Today's Theme: ${replacements?.theme}`;
            if (key === 'familyTheme.themes.charity') return '慈愛';
            if (key === 'familyTheme.themes.faith') return '信仰';
            return key;
        },
        language: 'ja'
    })
}));

describe('FamilyThemeModal Celebrations', () => {
    const mockUser: UserData = {
        uid: 'user_1',
        nickname: 'Takehiro',
        email: 'takehiro@example.com',
        daysStudiedCount: 6
    };

    const familyGroup: Group = {
        id: 'family_grp_1',
        name: 'Kato Family',
        members: ['user_1', 'user_2'],
        isFamilySyncEnabled: true,
        familyThemeSession: {
            date: '2026-09-08',
            selections: {
                user_2: 'charity'
            }
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
        useLevelUpStore.setState({ isOpen: false, levelUpData: null, pendingMilestone: null });
        useMilestoneStore.setState({ isOpen: false, milestoneData: null });
    });

    it('plays sound and opens LevelUpModal when match achieves a level up (6 -> 7 days)', async () => {
        const onClose = vi.fn();
        vi.mocked(apiClient.post).mockResolvedValueOnce({
            data: {
                success: true,
                matched: true,
                matchedTheme: 'charity',
                streakUpdated: true,
                newStreak: 7,
                daysStudiedCount: 7
            }
        });

        const openLevelUpSpy = vi.spyOn(useLevelUpStore.getState(), 'openLevelUp');

        render(
            <FamilyThemeModal
                isOpen={true}
                onClose={onClose}
                familyGroup={familyGroup}
                currentUserId="user_1"
                userData={mockUser}
            />
        );

        const charityBtn = document.body.querySelector('.family-theme-grid button.partner-selected');
        expect(charityBtn).toBeTruthy();
        fireEvent.click(charityBtn!);

        await waitFor(() => {
            expect(audioFeedback.playNoteSubmitSound).toHaveBeenCalledTimes(1);
        });

        expect(openLevelUpSpy).toHaveBeenCalledWith(
            {
                level: 2,
                days: 7,
                nickname: 'Takehiro'
            },
            null
        );
        expect(onClose).toHaveBeenCalled();
    });

    it('plays sound and opens MilestoneModal when match achieves a milestone (9 -> 10 days)', async () => {
        const onClose = vi.fn();
        const user9Days: UserData = { ...mockUser, daysStudiedCount: 9 };

        vi.mocked(apiClient.post).mockResolvedValueOnce({
            data: {
                success: true,
                matched: true,
                matchedTheme: 'charity',
                streakUpdated: true,
                newStreak: 10,
                daysStudiedCount: 10
            }
        });

        const openMilestoneSpy = vi.spyOn(useMilestoneStore.getState(), 'openMilestone');

        render(
            <FamilyThemeModal
                isOpen={true}
                onClose={onClose}
                familyGroup={familyGroup}
                currentUserId="user_1"
                userData={user9Days}
            />
        );

        const charityBtn = document.body.querySelector('.family-theme-grid button.partner-selected');
        expect(charityBtn).toBeTruthy();
        fireEvent.click(charityBtn!);

        await waitFor(() => {
            expect(audioFeedback.playNoteSubmitSound).toHaveBeenCalledTimes(1);
        });

        expect(openMilestoneSpy).toHaveBeenCalledWith({
            days: 10,
            nickname: 'Takehiro'
        });
        expect(onClose).toHaveBeenCalled();
    });

    it('plays sound and triggers confetti on normal match without level up or milestone (2 -> 3 days)', async () => {
        const onClose = vi.fn();
        const user2Days: UserData = { ...mockUser, daysStudiedCount: 2 };

        vi.mocked(apiClient.post).mockResolvedValueOnce({
            data: {
                success: true,
                matched: true,
                matchedTheme: 'charity',
                streakUpdated: true,
                newStreak: 3,
                daysStudiedCount: 3
            }
        });

        render(
            <FamilyThemeModal
                isOpen={true}
                onClose={onClose}
                familyGroup={familyGroup}
                currentUserId="user_1"
                userData={user2Days}
            />
        );

        const charityBtn = document.body.querySelector('.family-theme-grid button.partner-selected');
        expect(charityBtn).toBeTruthy();
        fireEvent.click(charityBtn!);

        await waitFor(() => {
            expect(audioFeedback.playNoteSubmitSound).toHaveBeenCalledTimes(1);
            expect(confettiUtils.triggerConfetti).toHaveBeenCalledWith(
                expect.objectContaining({
                    particleCount: 150,
                    zIndex: 10000
                })
            );
        });

        expect(useLevelUpStore.getState().isOpen).toBe(false);
        expect(useMilestoneStore.getState().isOpen).toBe(false);
    });
});
