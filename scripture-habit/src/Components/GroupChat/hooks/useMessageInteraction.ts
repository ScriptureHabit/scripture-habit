import { useState, useRef, useCallback } from 'react';
import { Message } from '../../../types/chat';

interface ContextMenu {
  show: boolean;
  x: number;
  y: number;
  messageId: string | null;
  message?: Message | null;
  showBelow?: boolean;
}

export const useMessageInteraction = () => {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ 
    show: false, x: 0, y: 0, messageId: null, message: null, showBelow: false 
  });
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleReply = useCallback((message: Message) => {
    setReplyTo(message);
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  const handleMessageClick = useCallback((message: Message, e: React.MouseEvent) => {
    if (message.senderId === 'system') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 160;
    let x = rect.left + rect.width / 2;
    x = Math.max(menuWidth / 2 + 10, Math.min(window.innerWidth - menuWidth / 2 - 10, x));

    setContextMenu({
      show: true,
      x,
      y: rect.top + rect.height / 2,
      messageId: message.id,
      message
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ show: false, x: 0, y: 0, messageId: null, message: null, showBelow: false });
  }, []);

  const handleEditMessage = useCallback((message: Message) => {
    setEditingMessage(message);
    setEditText(message.text || '');
    closeContextMenu();
  }, [closeContextMenu]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setEditText('');
  }, []);

  const handleDeleteMessageClick = useCallback((message: Message) => {
    setMessageToDelete(message);
    setShowDeleteMessageModal(true);
    closeContextMenu();
  }, [closeContextMenu]);

  return {
    replyTo, setReplyTo,
    contextMenu, setContextMenu,
    editingMessage, setEditingMessage,
    editText, setEditText,
    showDeleteMessageModal, setShowDeleteMessageModal,
    messageToDelete, setMessageToDelete,
    textareaRef,
    handleReply,
    handleMessageClick,
    closeContextMenu,
    handleEditMessage,
    handleCancelEdit,
    handleDeleteMessageClick
  };
};
