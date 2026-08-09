import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GroupChatTour from '../group-chat-tour';

describe('GroupChatTour Business Logic', () => {
  const mockClose = vi.fn();
  const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
      'groupChat.groupChatTour.step1Title': 'ここでノートを投稿！',
      'groupChat.groupChatTour.step1Desc': '＋ボタンを押して、今日の学びや気づきをノートに記録しましょう。',
      'groupChat.groupChatTour.step2Title': 'ダッシュボードに戻る',
      'groupChat.groupChatTour.step2Desc': '← ボタンでダッシュボードに戻ることができます。',
      'tourGuide.skip': 'スキップ',
      'tourGuide.next': '次へ',
      'tourGuide.back': '戻る',
      'tourGuide.finish': '完了',
    };
    return translations[key] || key;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div data-testid="new-note-button" style="width: 40px; height: 40px;">+</div>
      <div class="back-button" style="width: 40px; height: 40px;">←</div>
    `;
  });

  it('does not render when isOpen is false', () => {
    render(<GroupChatTour isOpen={false} onClose={mockClose} t={mockT} />);
    expect(screen.queryByText('ここでノートを投稿！')).toBeNull();
  });

  it('renders Step 1 correctly when isOpen is true', () => {
    render(<GroupChatTour isOpen={true} onClose={mockClose} t={mockT} />);
    expect(screen.getByText('ここでノートを投稿！')).toBeInTheDocument();
    expect(screen.getByText('スキップ')).toBeInTheDocument();
    expect(screen.getByText('次へ')).toBeInTheDocument();
  });

  it('navigates from Step 1 to Step 2 on clicking Next', () => {
    render(<GroupChatTour isOpen={true} onClose={mockClose} t={mockT} />);

    const nextBtn = screen.getByText('次へ');
    fireEvent.click(nextBtn);

    expect(screen.getByText('ダッシュボードに戻る')).toBeInTheDocument();
    expect(screen.getByText('完了')).toBeInTheDocument();
    expect(screen.getByText('戻る')).toBeInTheDocument();
  });

  it('calls onClose when clicking Skip', () => {
    render(<GroupChatTour isOpen={true} onClose={mockClose} t={mockT} />);

    const skipBtn = screen.getByText('スキップ');
    fireEvent.click(skipBtn);

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking Finish on the last step', () => {
    render(<GroupChatTour isOpen={true} onClose={mockClose} t={mockT} />);

    // Move to step 2
    fireEvent.click(screen.getByText('次へ'));

    // Click finish
    const finishBtn = screen.getByText('完了');
    fireEvent.click(finishBtn);

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
