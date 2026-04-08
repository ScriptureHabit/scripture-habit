import { useCallback } from 'react';
import { Message } from '../../../../types/chat';
import { useChatStore } from '../../../../store/useChatStore';

export const useMessageInteraction = () => {
  const { 
    setReplyTo, setEditingMessage, setEditText, setContextMenu, 
    setShowDeleteMessageModal, setMessageToDelete, closeContextMenu 
  } = useChatStore();

  const handleReply = useCallback((message: Message) => {
    setReplyTo(message);
    // Note: Local ref management (focus) should be done in the component consuming the ref
  }, [setReplyTo]);

  const handleMessageClick = useCallback((message: Message, e: React.MouseEvent) => {
    if (message.senderId === 'system') return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 160;
    let x = rect.left + rect.width / 2;
    // Keep it on screen
    x = Math.max(menuWidth / 2 + 10, Math.min(window.innerWidth - menuWidth / 2 - 10, x));

    setContextMenu({
      show: true,
      x,
      y: rect.top + rect.height / 2,
      messageId: message.id,
      message
    });
  }, [setContextMenu]);

  const handleEditMessage = useCallback((message: Message) => {
    setEditingMessage(message);
    setEditText(message.text || '');
    setContextMenu({ show: false, x: 0, y: 0, messageId: null, message: null });
  }, [setEditingMessage, setEditText, setContextMenu]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setEditText('');
  }, [setEditingMessage, setEditText]);

  const handleDeleteMessageClick = useCallback((message: Message) => {
    setMessageToDelete(message);
    setShowDeleteMessageModal(true);
    setContextMenu({ show: false, x: 0, y: 0, messageId: null, message: null });
  }, [setMessageToDelete, setShowDeleteMessageModal, setContextMenu]);

  return {
    handleReply,
    handleMessageClick,
    closeContextMenu,
    handleEditMessage,
    handleCancelEdit,
    handleDeleteMessageClick
  };
};
