import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAutoRetry } from '../use-auto-retry';
import { savePendingMessage } from '../../../../../utils/offline-chat-queue';
import { Message } from '../../../../../types/chat';

describe('useAutoRetry hook', () => {
  const mockGroupId = 'test-group-auto-retry';
  const mockDispatch = vi.fn();
  const mockHandleRetryMessage = vi.fn().mockResolvedValue(true);

  const currentUserId = 'user-1';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('hydrates pending offline messages from localStorage on initial load for current user', () => {
    const offlineMsg: Message = {
      id: 'temp-offline-1',
      optimisticId: 'temp-offline-1',
      text: 'Saved while offline',
      senderId: currentUserId,
      isFailed: true,
      isOptimistic: false
    };
    savePendingMessage(currentUserId, mockGroupId, offlineMsg);

    renderHook(() =>
      useAutoRetry({
        groupId: mockGroupId,
        userId: currentUserId,
        messages: [],
        messagesLoaded: true,
        dispatch: mockDispatch,
        handleRetryMessage: mockHandleRetryMessage
      })
    );

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_NEW_MESSAGES',
        newMessages: [
          expect.objectContaining({
            id: 'temp-offline-1',
            text: 'Saved while offline',
            isFailed: true
          })
        ]
      })
    );
  });

  it('does NOT hydrate pending messages belonging to a different user', () => {
    const victimMsg: Message = {
      id: 'temp-victim-1',
      optimisticId: 'temp-victim-1',
      text: 'Victim private offline message',
      senderId: 'user-victim',
      isFailed: true,
      isOptimistic: false
    };
    savePendingMessage('user-victim', mockGroupId, victimMsg);

    renderHook(() =>
      useAutoRetry({
        groupId: mockGroupId,
        userId: currentUserId,
        messages: [],
        messagesLoaded: true,
        dispatch: mockDispatch,
        handleRetryMessage: mockHandleRetryMessage
      })
    );

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch if pending messages are already in the messages state', () => {
    const offlineMsg: Message = {
      id: 'temp-offline-1',
      optimisticId: 'temp-offline-1',
      text: 'Already in state',
      senderId: currentUserId,
      isFailed: true,
      isOptimistic: false
    };
    savePendingMessage(currentUserId, mockGroupId, offlineMsg);

    renderHook(() =>
      useAutoRetry({
        groupId: mockGroupId,
        userId: currentUserId,
        messages: [offlineMsg],
        messagesLoaded: true,
        dispatch: mockDispatch,
        handleRetryMessage: mockHandleRetryMessage
      })
    );

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('automatically triggers handleRetryMessage when window online event fires only for current user messages', async () => {
    const failedMsgMine: Message = {
      id: 'temp-f1',
      text: 'My failed message',
      senderId: currentUserId,
      isFailed: true
    };
    const failedMsgOther: Message = {
      id: 'temp-f2',
      text: 'Other user failed message',
      senderId: 'other-user',
      isFailed: true
    };
    const regularMsg: Message = {
      id: 'msg-success',
      text: 'Success message',
      senderId: currentUserId,
      isFailed: false
    };

    renderHook(() =>
      useAutoRetry({
        groupId: mockGroupId,
        userId: currentUserId,
        messages: [regularMsg, failedMsgMine, failedMsgOther],
        messagesLoaded: true,
        dispatch: mockDispatch,
        handleRetryMessage: mockHandleRetryMessage
      })
    );

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    // Only current user's message should be retried!
    expect(mockHandleRetryMessage).toHaveBeenCalledTimes(1);
    expect(mockHandleRetryMessage).toHaveBeenCalledWith(failedMsgMine);
  });
});
