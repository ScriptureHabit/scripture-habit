import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import GroupOptions from '../group-options';
import { MemoryRouter } from 'react-router-dom';
import * as useGroupOptionsModule from '../hooks/use-group-options';
import { useLanguage } from '../../../hooks/use-language';

vi.mock('../hooks/use-group-options', () => ({
  useGroupOptions: vi.fn()
}));

vi.mock('../../../hooks/use-language');

vi.mock('../../utils/api-client', () => ({
  default: {
    post: vi.fn()
  }
}));

const mockDict: Record<string, string> = {
  'groupOptions.title': '学習グループ',
  'groupOptions.joinGroupTitle': 'グループに参加',
  'groupOptions.joinGroupDesc': '既存のグループを見つけて一緒に学習しましょう。',
  'groupOptions.createGroupTitle': 'グループを作成',
  'groupOptions.createGroupDesc': '自分のグループを立ち上げて友達を招待しましょう。',
  'groupOptions.aiGroupTitle': 'スクハビAIと始める',
  'groupOptions.aiGroupDesc': 'スクハビAIと1対1で毎日聖典を学ぶ専用グループを作成します。',
  'groupOptions.aiGroupAlreadyJoinedBadge': '参加中',
  'groupOptions.aiGroupAlreadyJoinedNote': '※スクハビAIグループは1人1グループまで参加可能です',
  'mascot.aiGroupPrompt': '一人でマイペースに勉強したい',
  'mascot.aiGroupAlreadyJoinedPrompt': 'スクハビAIグループは参加中だよ！他のグループを探してみよう',
  'mascot.joinGroupPrompt': 'いろんな人と一緒に勉強したい！',
  'mascot.createGroupPrompt2': '友達と一緒に勉強したい！',
  'onboardingQuest.step1Title': 'ステップ1',
  'onboardingQuest.groupOptionsBannerDesc': 'グループを選びましょう'
};

describe('GroupOptions Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLanguage).mockReturnValue({
      t: (key: string) => mockDict[key] || key,
      language: 'ja',
      setLanguage: vi.fn(),
      tArray: vi.fn(() => []),
      isLoaded: true,
      translateBookName: vi.fn(n => n || ''),
      translateChapterField: vi.fn(n => n || ''),
      bookTranslations: {},
    });
  });

  it('renders enabled AI card and default mascot message when hasAiGroup is false', () => {
    vi.spyOn(useGroupOptionsModule, 'useGroupOptions').mockReturnValue({
      user: { uid: 'user-1' } as any,
      userData: { uid: 'user-1', groupIds: ['g1'] } as any,
      hasAiGroup: false,
      showWelcomeStory: false,
      loading: false,
      handleCloseWelcomeStory: vi.fn()
    });

    render(
      <MemoryRouter>
        <GroupOptions />
      </MemoryRouter>
    );

    const aiCard = screen.getByTestId('create-ai-group-card');
    expect(aiCard).toBeInTheDocument();
    expect(aiCard).not.toBeDisabled();
    expect(aiCard).not.toHaveClass('disabled-card');
    expect(screen.queryByTestId('ai-group-joined-badge')).not.toBeInTheDocument();
    expect(screen.getByText('一人でマイペースに勉強したい')).toBeInTheDocument();

    const createGroupMascotMsg = screen.getByText('友達と一緒に勉強したい！');
    expect(createGroupMascotMsg).toBeInTheDocument();
    const createGroupMascotContainer = createGroupMascotMsg.closest('.mascot-container');
    expect(createGroupMascotContainer).toHaveClass('reversed');
  });

  it('renders disabled AI card with joined badge, note, and updated mascot message when hasAiGroup is true', () => {
    vi.spyOn(useGroupOptionsModule, 'useGroupOptions').mockReturnValue({
      user: { uid: 'user-1' } as any,
      userData: { uid: 'user-1', groupIds: ['g1', 'ai-g'] } as any,
      hasAiGroup: true,
      showWelcomeStory: false,
      loading: false,
      handleCloseWelcomeStory: vi.fn()
    });

    render(
      <MemoryRouter>
        <GroupOptions />
      </MemoryRouter>
    );

    const aiCard = screen.getByTestId('create-ai-group-card');
    expect(aiCard).toBeInTheDocument();
    expect(aiCard).toBeDisabled();
    expect(aiCard).toHaveClass('disabled-card');

    const badge = screen.getByTestId('ai-group-joined-badge');
    expect(badge).toHaveTextContent('参加中');
    expect(screen.getByText('※スクハビAIグループは1人1グループまで参加可能です')).toBeInTheDocument();
    expect(screen.getByText('スクハビAIグループは参加中だよ！他のグループを探してみよう')).toBeInTheDocument();
  });
});
