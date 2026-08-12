import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SystemMessage from '../system-message';
import { Message } from '../../../../types/chat';

vi.mock('../../hooks/use-chat-context', () => ({
  useChatData: () => ({
    language: 'en'
  })
}));

vi.mock('../../hooks/view/use-translated-nickname', () => ({
  useTranslatedNickname: (_userId: string | undefined, originalNickname: string) => {
    if (originalNickname === 'ひーで') return 'Hide';
    return originalNickname;
  }
}));

describe('SystemMessage Component', () => {
  it('translates nickname in notePostedAnnouncement', () => {
    const msg: Message = {
      id: 'msg-1',
      senderId: 'system',
      text: '🎉🎉🎉 **ひーで posted a note!!** 🎉🎉🎉',
      isSystemMessage: true,
      messageType: 'notePostedAnnouncement',
      messageData: {
        nickname: 'ひーで',
        userId: 'user-123'
      }
    };

    const t = (key: string, replacements?: Record<string, string | number>) => {
      if (key === 'groupChat.notePostedAnnouncement') {
        return `🎉🎉🎉 **${replacements?.nickname} posted a note!!** 🎉🎉🎉`;
      }
      return key;
    };

    render(<SystemMessage msg={msg} t={t} />);

    expect(screen.getByText(/Hide posted a note!!/i)).toBeInTheDocument();
  });
});
