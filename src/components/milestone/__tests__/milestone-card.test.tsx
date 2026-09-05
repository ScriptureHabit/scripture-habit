import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MilestoneCard } from '../milestone-card';

vi.mock('../../../hooks/use-language', () => ({
    useLanguage: () => ({
        t: (key: string, replacements?: Record<string, any>) => {
            if (key === 'milestone.label') return '学びの記録';
            if (key === 'milestone.daysUnit') return 'DAYS';
            if (key === 'milestone.speechBubbleLine1') return `${replacements?.days}日達成おめでとう！🎉`;
            if (key === 'milestone.speechBubbleLine2') return 'すごい！';
            if (key === 'milestone.achievementMessage') return `${replacements?.days}日間の聖典学習を達成しました。`;
            if (key === 'profile.you') return 'あなた';
            return key;
        },
        language: 'ja'
    })
}));

describe('MilestoneCard', () => {
    it('renders days, mascot, speech bubble, and user info correctly', () => {
        render(<MilestoneCard days={25} nickname="Taro" achievedDate="2026.09.05" />);

        expect(screen.getByText('25')).toBeDefined();
        expect(screen.getByText('DAYS')).toBeDefined();
        expect(screen.getByText('Taro')).toBeDefined();
        expect(screen.getByText('2026.09.05')).toBeDefined();
        expect(screen.getByText('25日間の聖典学習を達成しました。')).toBeDefined();

        const bubble = screen.getByTestId('milestone-speech-bubble');
        expect(bubble).toBeDefined();
        expect(screen.getByText('25日達成おめでとう！🎉')).toBeDefined();
        expect(screen.getByText('すごい！')).toBeDefined();
    });

    it('falls back to default nickname if not provided', () => {
        render(<MilestoneCard days={50} />);
        expect(screen.getByText('あなた')).toBeDefined();
        expect(screen.getByText('50日達成おめでとう！🎉')).toBeDefined();
    });
});
