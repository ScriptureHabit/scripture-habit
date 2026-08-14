import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMessageInput } from '../use-message-input';
import { useChatStore } from '../../../../../store/use-chat-store';
import { Message } from '../../../../../types/chat';

describe('useMessageInput hook', () => {
  const mockT = vi.fn((key: string) => key);
  const mockTArray = vi.fn(() => ['Type a message']);
  const mockUserData = { kickThreshold: 7 };
  const mockHandleSendMessage = vi.fn().mockResolvedValue(true);
  const mockScrollToBottom = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.getState().setEditText('');
    useChatStore.getState().setReplyTo(null);
  });

  it('immediately clears newMessage and replyTo and scrolls to bottom on send', async () => {
    const mockReplyMessage: Message = {
      id: 'reply-1',
      text: 'Previous text',
      senderId: 'user-2'
    };

    useChatStore.getState().setEditText('My new message');
    useChatStore.getState().setReplyTo(mockReplyMessage);

    const { result } = renderHook(() =>
      useMessageInput(
        mockT,
        mockTArray,
        mockUserData,
        mockHandleSendMessage,
        mockScrollToBottom
      )
    );

    expect(result.current.newMessage).toBe('My new message');

    let isInputClearedDuringApiCall = false;
    mockHandleSendMessage.mockImplementationOnce(async () => {
      // Check that inside the API call, the store's editText and replyTo are already cleared
      isInputClearedDuringApiCall =
        useChatStore.getState().editText === '' &&
        useChatStore.getState().replyTo === null;
      return true;
    });

    await act(async () => {
      await result.current.onSendMessage();
    });

    // 1. Assert input was cleared before/during the API call
    expect(isInputClearedDuringApiCall).toBe(true);

    // 2. Assert scroll was called
    expect(mockScrollToBottom).toHaveBeenCalled();

    // 3. Assert handleSendMessage received the correct text & replyTo
    expect(mockHandleSendMessage).toHaveBeenCalledWith('My new message', mockReplyMessage);

    // 4. Assert final store state
    expect(useChatStore.getState().editText).toBe('');
    expect(useChatStore.getState().replyTo).toBeNull();
  });

  it('does nothing if newMessage is empty or only whitespace', async () => {
    useChatStore.getState().setEditText('   ');

    const { result } = renderHook(() =>
      useMessageInput(
        mockT,
        mockTArray,
        mockUserData,
        mockHandleSendMessage,
        mockScrollToBottom
      )
    );

    await act(async () => {
      await result.current.onSendMessage();
    });

    expect(mockHandleSendMessage).not.toHaveBeenCalled();
    expect(mockScrollToBottom).not.toHaveBeenCalled();
  });
});
