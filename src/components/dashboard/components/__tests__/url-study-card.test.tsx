import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UrlStudyCard from '../url-study-card';
import apiClient from '../../../../utils/api-client';
import { UserData } from '../../../../types/user';

vi.mock('../../../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

vi.mock('../../../../utils/confetti-utils', () => ({
  triggerConfetti: vi.fn()
}));

vi.mock('../../../../utils/audio-feedback', () => ({
  playNoteSubmitSound: vi.fn()
}));

describe('UrlStudyCard', () => {
  const mockT = (key: string) => {
    const translations: Record<string, string> = {
      'urlStudy.prompt': '読んだ聖典や総大会のURLを入力して記録しよう',
      'urlStudy.urlInputPlaceholder': '福音ライブラリー等のURLを貼り付け (https://...)',
      'urlStudy.commentLabel': 'コメント (編集可能)',
      'urlStudy.completeButton': '完了する',
      'urlStudy.submitting': '記録中...',
      'urlStudy.successMessage': '本日の学習を完了しました！🎉',
      'urlStudy.fetchingInfo': 'URLから情報を取得中...'
    };
    return translations[key] || key;
  };

  const mockUserData: UserData = {
    uid: 'test-user-123',
    nickname: 'TestUser',
    daysStudiedCount: 5,
    streakCount: 3
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial state with empty input and prompt', () => {
    render(
      <UrlStudyCard
        userData={mockUserData}
        language="ja"
        t={mockT}
      />
    );

    expect(screen.getByText('読んだ聖典や総大会のURLを入力して記録しよう')).toBeDefined();
    const input = screen.getByTestId('url-study-input') as HTMLInputElement;
    expect(input.value).toBe('');

    const submitBtn = screen.getByTestId('url-study-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('parses scripture URL and auto-populates exact requested comment', async () => {
    render(
      <UrlStudyCard
        userData={mockUserData}
        language="ja"
        t={mockT}
      />
    );

    const input = screen.getByTestId('url-study-input');
    fireEvent.change(input, {
      target: { value: 'https://www.churchofjesuschrist.org/study/scriptures/ot/prov/22?lang=jpn' }
    });

    // Preview badges
    expect(screen.getByText('旧約聖書')).toBeDefined();
    expect(screen.getByText(/箴言 22/)).toBeDefined();

    // Comment textarea
    const commentTextarea = screen.getByTestId('url-study-comment') as HTMLTextAreaElement;
    expect(commentTextarea.value).toBe('今日は旧約聖書の箴言22章について学びを深めました。');

    const submitBtn = screen.getByTestId('url-study-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
  });

  it('allows user to customize comment before submitting', async () => {
    render(
      <UrlStudyCard
        userData={mockUserData}
        language="ja"
        t={mockT}
      />
    );

    const input = screen.getByTestId('url-study-input');
    fireEvent.change(input, {
      target: { value: 'https://www.churchofjesuschrist.org/study/scriptures/ot/prov/22?lang=jpn' }
    });

    const commentTextarea = screen.getByTestId('url-study-comment') as HTMLTextAreaElement;
    fireEvent.change(commentTextarea, {
      target: { value: '今日は旧約聖書の箴言22章について学びを深めました。良い知恵を得ました！' }
    });

    expect(commentTextarea.value).toBe('今日は旧約聖書の箴言22章について学びを深めました。良い知恵を得ました！');
  });

  it('fetches metadata for General Conference and regenerates comment with speaker and title', async () => {
    (apiClient.get as any).mockResolvedValueOnce({
      data: {
        title: '世に打ち勝ちなさい。そうすれば休みが与えられるであろう',
        speaker: 'ラッセル・M・ネルソン大管長'
      }
    });

    render(
      <UrlStudyCard
        userData={mockUserData}
        language="ja"
        t={mockT}
      />
    );

    const input = screen.getByTestId('url-study-input');
    fireEvent.change(input, {
      target: { value: 'https://www.churchofjesuschrist.org/study/general-conference/2022/10/47nelson?lang=jpn' }
    });

    // Initially parsed with session
    expect(screen.getByText('総大会')).toBeDefined();
    expect(screen.getAllByText(/2022年10月総大会/).length).toBeGreaterThan(0);

    // After debounce and metadata fetch
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/preview/fetch-church-metadata', expect.any(Object));
    });

    await waitFor(() => {
      const commentTextarea = screen.getByTestId('url-study-comment') as HTMLTextAreaElement;
      expect(commentTextarea.value).toBe(
        '今日は2022年10月総大会のラッセル・M・ネルソン大管長の説教「世に打ち勝ちなさい。そうすれば休みが与えられるであろう」について学びを深めました。'
      );
    });
  });

  it('posts note when complete button is clicked and resets fields upon success', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      data: { success: true, streakUpdated: true }
    });

    const onSuccess = vi.fn();

    render(
      <UrlStudyCard
        userData={mockUserData}
        language="ja"
        t={mockT}
        onSuccess={onSuccess}
      />
    );

    const input = screen.getByTestId('url-study-input');
    fireEvent.change(input, {
      target: { value: 'https://www.churchofjesuschrist.org/study/scriptures/ot/prov/22?lang=jpn' }
    });

    const submitBtn = screen.getByTestId('url-study-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/groups/post-note', expect.objectContaining({
        chapter: '箴言 22',
        comment: '今日は旧約聖書の箴言22章について学びを深めました。',
        scripture: 'Old Testament',
        shareOption: 'all'
      }));
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      // Inputs cleared for subsequent study
      const clearedInput = screen.getByTestId('url-study-input') as HTMLInputElement;
      expect(clearedInput.value).toBe('');
    });
  });

  it('clears all fields when the clear button is clicked', () => {
    render(
      <UrlStudyCard
        userData={mockUserData}
        language="ja"
        t={mockT}
      />
    );

    const input = screen.getByTestId('url-study-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: 'https://www.churchofjesuschrist.org/study/scriptures/ot/prov/22?lang=jpn' }
    });

    expect(screen.getByTestId('url-study-preview')).toBeDefined();

    const clearBtn = screen.getByLabelText('Clear URL');
    fireEvent.click(clearBtn);

    expect(input.value).toBe('');
    expect(screen.queryByTestId('url-study-preview')).toBeNull();
    expect(screen.queryByTestId('url-study-comment')).toBeNull();
  });
});
