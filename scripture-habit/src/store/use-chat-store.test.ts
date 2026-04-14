import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './use-chat-store';
import { Message } from '../types/chat';

describe('useChatStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useChatStore.getState().resetChatUI();
  });

  it('should have initial state', () => {
    const state = useChatStore.getState();
    expect(state.replyTo).toBeNull();
    expect(state.editingMessage).toBeNull();
    expect(state.showUnityModal).toBe(false);
    expect(state.contextMenu.show).toBe(false);
  });

  it('should update replyTo state', () => {
    const mockMessage: Message = { 
        id: 'msg1', 
        text: 'Hello', 
        senderId: 'user1',
        createdAt: { seconds: 123, nanoseconds: 0 } 
    };
    useChatStore.getState().setReplyTo(mockMessage);
    
    expect(useChatStore.getState().replyTo).toEqual(mockMessage);
  });

  it('should update modal states', () => {
    useChatStore.getState().setShowUnityModal(true);
    expect(useChatStore.getState().showUnityModal).toBe(true);

    useChatStore.getState().setShowDeleteMessageModal(true);
    expect(useChatStore.getState().showDeleteMessageModal).toBe(true);
  });

  it('should update context menu state', () => {
    const newMenu = { 
        show: true, 
        x: 100, 
        y: 200, 
        messageId: 'msg1', 
        message: null, 
        showBelow: false 
    };
    useChatStore.getState().setContextMenu(newMenu);
    
    expect(useChatStore.getState().contextMenu).toEqual(newMenu);
    
    useChatStore.getState().closeContextMenu();
    expect(useChatStore.getState().contextMenu.show).toBe(false);
    expect(useChatStore.getState().contextMenu.messageId).toBeNull();
  });

  it('should reset all UI states when resetChatUI is called', () => {
    // Set some dirty state
    const store = useChatStore.getState();
    store.setReplyTo({ 
        id: '1', 
        text: 'Reply text', 
        senderId: 'u1', 
        createdAt: { seconds: 456, nanoseconds: 0 } 
    } as Message);
    store.setShowUnityModal(true);
    store.setEditText('Writing something...');
    store.setContextMenu({ show: true, x: 10, y: 10, messageId: 'm1' });

    // Verify it was set
    expect(useChatStore.getState().replyTo).not.toBeNull();
    expect(useChatStore.getState().showUnityModal).toBe(true);

    // Reset
    useChatStore.getState().resetChatUI();

    // Verify reset
    const newState = useChatStore.getState();
    expect(newState.replyTo).toBeNull();
    expect(newState.showUnityModal).toBe(false);
    expect(newState.editText).toBe('');
    expect(newState.contextMenu.show).toBe(false);
  });
});
