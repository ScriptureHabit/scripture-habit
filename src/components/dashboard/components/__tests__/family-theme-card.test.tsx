import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FamilyThemeCard } from '../family-theme-card';
import { Group } from '../../../../types/chat';
import { UserData } from '../../../../types/user';

vi.mock('../../../../hooks/use-language', () => ({
    useLanguage: () => ({
        t: (key: string, replacements?: Record<string, string | number>) => {
            if (key === 'familyTheme.completedTitle') return `Today's Theme: ${replacements?.theme}`;
            if (key === 'familyTheme.waitingPartnerDesc') return `Selected: ${replacements?.selectedTheme}`;
            return key;
        },
        language: 'ja'
    })
}));

describe('FamilyThemeCard', () => {
    const mockUser: UserData = {
        uid: 'user_1',
        nickname: 'Takehiro',
        email: 'takehiro@example.com'
    };

    const baseGroup: Group = {
        id: 'family_grp_1',
        name: 'Kato Family',
        members: ['user_1', 'user_2'],
        isFamilySyncEnabled: true
    };

    it('renders null when familyGroup is null or isFamilySyncEnabled is false', () => {
        const { container: c1 } = render(<FamilyThemeCard userData={mockUser} familyGroup={null} />);
        expect(c1.firstChild).toBeNull();

        const disabledGroup: Group = { ...baseGroup, isFamilySyncEnabled: false };
        const { container: c2 } = render(<FamilyThemeCard userData={mockUser} familyGroup={disabledGroup} />);
        expect(c2.firstChild).toBeNull();
    });

    it('renders initial unselected state correctly', () => {
        render(<FamilyThemeCard userData={mockUser} familyGroup={baseGroup} />);
        expect(screen.getByText('familyTheme.cardTitle')).toBeDefined();
        expect(screen.getByText('familyTheme.openModalBtn')).toBeDefined();
    });

    it('renders partner selected state when partner chose a theme but user has not', () => {
        const groupWithPartner: Group = {
            ...baseGroup,
            familyThemeSession: {
                date: '2026-09-06',
                selections: {
                    user_2: 'charity'
                }
            }
        };

        render(<FamilyThemeCard userData={mockUser} familyGroup={groupWithPartner} />);
        expect(screen.getByText('familyTheme.partnerSelectedTitle')).toBeDefined();
        expect(screen.getByText('familyTheme.partnerSelectedDesc')).toBeDefined();
    });

    it('renders waiting state when user has selected but partner has not', () => {
        const groupWaiting: Group = {
            ...baseGroup,
            familyThemeSession: {
                date: '2026-09-06',
                selections: {
                    user_1: 'faith'
                }
            }
        };

        render(<FamilyThemeCard userData={mockUser} familyGroup={groupWaiting} />);
        expect(screen.getByText('familyTheme.waitingPartnerTitle')).toBeDefined();
        expect(screen.getByText('familyTheme.changeSelection')).toBeDefined();
    });

    it('renders completed state when theme is matched', () => {
        const groupCompleted: Group = {
            ...baseGroup,
            familyThemeSession: {
                date: '2026-09-06',
                selections: {
                    user_1: 'charity',
                    user_2: 'charity'
                },
                matchedTheme: 'charity',
                completedBy: ['user_1', 'user_2']
            }
        };

        render(<FamilyThemeCard userData={mockUser} familyGroup={groupCompleted} />);
        expect(screen.getByText(/Today's Theme:/)).toBeDefined();
        expect(screen.getByText('familyTheme.completedBadge')).toBeDefined();
    });
});
