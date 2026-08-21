import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMessageActions } from '../use-message-actions';
import apiClient from '../../../../../utils/api-client';

vi.mock('../../../../../utils/api-client', () => ({
  default: {
    post: vi.fn()
  }
}));

describe('useMessageActions - Optimistic Messaging & Retry', () => {
  const mockGroupId = 'test-group-1';
  const mockUserData = {
    uid: 'user-123',
    nickname: 'TestUser',
    photoURL: 'https://example.com/pic.jpg'
  };
  const mockT = vi.fn((key: string) => key);
  const mockDispatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('optimistically adds message on send, and resolves real ID on success', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      data: { messageId: 'real-msg-999', totalCount: 5 }
    });

    const { result } = renderHook(() =>
      useMessageActions(mockGroupId, mockUserData, 'en', mockT, mockDispatch)
    );

    let success: boolean = false;
    await act(async () => {
      success = await result.current.handleSendMessage('Hello world!', null);
    });

    expect(success).toBe(true);

    // 1. Check Optimistic Add
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_NEW_MESSAGES',
        newMessages: [
          expect.objectContaining({
            text: 'Hello world!',
            senderId: 'user-123',
            isOptimistic: true,
            optimisticId: expect.stringMatching(/^temp-\d+$/)
          })
        ]
      })
    );

    // 2. Check API call
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/groups/post-message',
      expect.objectContaining({
        groupId: mockGroupId,
        text: 'Hello world!'
      })
    );

    // 3. Check Resolution
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_MESSAGE',
        data: expect.objectContaining({
          id: 'real-msg-999',
          isOptimistic: false
        })
      })
    );
  });

  it('sets isFailed: true on send failure instead of deleting the message', async () => {
    (apiClient.post as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useMessageActions(mockGroupId, mockUserData, 'en', mockT, mockDispatch)
    );

    let success: boolean = true;
    await act(async () => {
      success = await result.current.handleSendMessage('Failed text', null);
    });

    expect(success).toBe(false);

    // Check that it updated the message with isFailed: true (NOT REMOVE_MESSAGE)
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_MESSAGE',
        data: expect.objectContaining({
          isOptimistic: false,
          isFailed: true
        })
      })
    );
    expect(mockDispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REMOVE_MESSAGE'
      })
    );
  });

  it('retries a failed message and resolves with real ID on retry success', async () => {
    (apiClient.post as any).mockResolvedValueOnce({
      data: { messageId: 'retry-success-id', totalCount: 6 }
    });

    const { result } = renderHook(() =>
      useMessageActions(mockGroupId, mockUserData, 'en', mockT, mockDispatch)
    );

    const failedMsg = {
      id: 'temp-12345',
      text: 'Retried message text',
      senderId: 'user-123',
      isOptimistic: false,
      isFailed: true,
      optimisticId: 'temp-12345',
      clientTimestamp: 12345
    };

    let retrySuccess: boolean = false;
    await act(async () => {
      retrySuccess = await result.current.handleRetryMessage(failedMsg as any);
    });

    expect(retrySuccess).toBe(true);

    // 1. Check that status was set back to sending
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_MESSAGE',
        messageId: 'temp-12345',
        data: {
          isOptimistic: true,
          isFailed: false
        }
      })
    );

    // 2. Check that real ID resolved
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_MESSAGE',
        messageId: 'temp-12345',
        data: expect.objectContaining({
          id: 'retry-success-id',
          isOptimistic: false,
          isFailed: false
        })
      })
    );
  });

  it('keeps isFailed: true when retrying fails again', async () => {
    (apiClient.post as any).mockRejectedValueOnce(new Error('Still offline'));

    const { result } = renderHook(() =>
      useMessageActions(mockGroupId, mockUserData, 'en', mockT, mockDispatch)
    );

    const failedMsg = {
      id: 'temp-12345',
      text: 'Still failing text',
      senderId: 'user-123',
      isOptimistic: false,
      isFailed: true,
      optimisticId: 'temp-12345'
    };

    let retrySuccess: boolean = true;
    await act(async () => {
      retrySuccess = await result.current.handleRetryMessage(failedMsg as any);
    });

    expect(retrySuccess).toBe(false);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'UPDATE_MESSAGE',
        messageId: 'temp-12345',
        data: {
          isOptimistic: false,
          isFailed: true
        }
      })
    );
  });
});
