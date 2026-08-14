import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAutoRetry } from '../use-auto-retry';
import { savePendingMessage } from '../../../../../utils/offline-chat-queue';
import { Message } from '../../../../../types/chat';

describe('useAutoRetry hook', () => {
  const mockGroupId = 'test-group-auto-retry';
  const mockDispatch = vi.fn();
  const mockHandleRetryMessage = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('hydrates pending offline messages from localStorage on initial load', () => {
    const offlineMsg: Message = {
      id: 'temp-offline-1',
      optimisticId: 'temp-offline-1',
      text: 'Saved while offline',
      senderId: 'user-1',
      isFailed: true,
      isOptimistic: false
    };
    savePendingMessage(mockGroupId, offlineMsg);

    renderHook(() =>
      useAutoRetry({
        groupId: mockGroupId,
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

  it('does not dispatch if pending messages are already in the messages state', () => {
    const offlineMsg: Message = {
      id: 'temp-offline-1',
      optimisticId: 'temp-offline-1',
      text: 'Already in state',
      senderId: 'user-1',
      isFailed: true,
      isOptimistic: false
    };
    savePendingMessage(mockGroupId, offlineMsg);

    renderHook(() =>
      useAutoRetry({
        groupId: mockGroupId,
        messages: [offlineMsg],
        messagesLoaded: true,
        dispatch: mockDispatch,
        handleRetryMessage: mockHandleRetryMessage
      })
    );

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('automatically triggers handleRetryMessage when window online event fires', async () => {
    const failedMsg1: Message = {
      id: 'temp-f1',
      text: 'Failed 1',
      senderId: 'user-1',
      isFailed: true
    };
    const regularMsg: Message = {
      id: 'msg-success',
      text: 'Success message',
      senderId: 'user-1',
      isFailed: false
    };

    renderHook(() =>
      useAutoRetry({
        groupId: mockGroupId,
        messages: [regularMsg, failedMsg1],
        messagesLoaded: true,
        dispatch: mockDispatch,
        handleRetryMessage: mockHandleRetryMessage
      })
    );

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(mockHandleRetryMessage).toHaveBeenCalledTimes(1);
    expect(mockHandleRetryMessage).toHaveBeenCalledWith(failedMsg1);
  });
});
