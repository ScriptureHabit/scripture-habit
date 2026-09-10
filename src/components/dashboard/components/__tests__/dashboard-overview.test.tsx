import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardOverview from '../dashboard-overview';
import { UserData } from '../../../../types/user';

vi.mock('../../mascot/mascot', () => ({
  default: () => <div data-testid="mock-mascot">Mascot</div>
}));

vi.mock('../quest-card', () => ({
  QuestCard: () => <div data-testid="mock-quest-card">QuestCard</div>
}));

vi.mock('../time-capsule-card', () => ({
  TimeCapsuleCard: () => <div data-testid="mock-time-capsule-card">TimeCapsuleCard</div>
}));

vi.mock('../streak-calendar', () => ({
  default: () => <div data-testid="mock-streak-calendar">StreakCalendar</div>
}));

vi.mock('../../../../hooks/use-language', () => ({
  useLanguage: () => ({
    language: 'ja',
    t: (key: string) => key,
    isLoaded: true
  })
}));

describe('DashboardOverview recent group CTA', () => {
  const mockT = (key: string, replacements?: Record<string, string | number>) => {
    if (key === 'dashboard.rejoinGroupPrompt' && replacements?.groupName) {
      return `Rejoin ${replacements.groupName}`;
    }
    return key;
  };

  const baseUserData: UserData = {
    uid: 'u123',
    nickname: 'TestUser',
    groupIds: []
  };

  const baseProps = {
    t: mockT,
    userData: baseUserData,
    warnings: [],
    todayPlan: null,
    getReadingPlanUrl: () => null,
    translateChapterField: (f: string) => f,
    isJoiningInvite: false,
    hasGroups: false,
    setIsModalOpen: vi.fn(),
    setShowWelcomeStory: vi.fn(),
    setShowEditProfileModal: vi.fn(),
    setNewNickname: vi.fn()
  };

  it('renders default join group CTA when user has no groups and no recent group', () => {
    render(
      <MemoryRouter>
        <DashboardOverview {...baseProps} hasGroups={false} userData={{ ...baseUserData, lastRecentGroup: undefined }} />
      </MemoryRouter>
    );

    expect(screen.getByText('dashboard.joinGroupStudy')).toBeDefined();
    expect(screen.getByText('dashboard.joinCreateGroup')).toBeDefined();
  });

  it('renders recent group rejoin CTA when user has lastRecentGroup', () => {
    const userDataWithRecent: UserData = {
      ...baseUserData,
      lastRecentGroup: {
        id: 'grp-alpha',
        name: 'Alpha Group',
        isAiGroup: false
      }
    };

    render(
      <MemoryRouter>
        <DashboardOverview {...baseProps} hasGroups={false} userData={userDataWithRecent} />
      </MemoryRouter>
    );

    expect(screen.getByText('Rejoin Alpha Group')).toBeDefined();
    expect(screen.getByText('dashboard.rejoinBtn')).toBeDefined();
    expect(screen.getByText('dashboard.findOrCreateOtherGroup')).toBeDefined();
  });

  it('renders AI group rejoin CTA when lastRecentGroup is AI group', () => {
    const userDataWithAi: UserData = {
      ...baseUserData,
      lastRecentGroup: {
        id: 'grp-ai',
        name: 'AI Group',
        isAiGroup: true
      }
    };

    render(
      <MemoryRouter>
        <DashboardOverview {...baseProps} hasGroups={false} userData={userDataWithAi} />
      </MemoryRouter>
    );

    expect(screen.getByText('dashboard.rejoinAiGroupPrompt')).toBeDefined();
    expect(screen.getByText('dashboard.rejoinBtn')).toBeDefined();
  });

  it('does not render CTA when user belongs to at least one group', () => {
    render(
      <MemoryRouter>
        <DashboardOverview {...baseProps} hasGroups={true} />
      </MemoryRouter>
    );

    expect(screen.queryByText('dashboard.joinGroupStudy')).toBeNull();
    expect(screen.queryByText('dashboard.rejoinBtn')).toBeNull();
  });

  it('disables one-tap theme buttons and displays notice when completed today', () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const completedUserData: UserData = {
      ...baseUserData,
      todayTheme: 'faith',
      todayThemeDate: todayStr,
      timeZone: 'Asia/Tokyo'
    };

    render(
      <MemoryRouter>
        <DashboardOverview {...baseProps} userData={completedUserData} />
      </MemoryRouter>
    );

    // Switch to one-tap mode
    const oneTapTab = screen.getByTestId('mode-toggle-onetap');
    fireEvent.click(oneTapTab);

    // Check faith button is selected and disabled
    const faithBtn = screen.getByTestId('onetap-theme-faith') as HTMLButtonElement;
    expect(faithBtn.disabled).toBe(true);
    expect(faithBtn.className).toContain('selected');
    expect(faithBtn.className).toContain('completed');

    // Check hope button is also disabled
    const hopeBtn = screen.getByTestId('onetap-theme-hope') as HTMLButtonElement;
    expect(hopeBtn.disabled).toBe(true);

    // Check next day notice is shown
    expect(screen.getByText('※ 次の日の学習記録は明日また利用可能になります')).toBeDefined();
  });
});
