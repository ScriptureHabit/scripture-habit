import { useReducer, useRef, useCallback } from 'react';
import { Message } from '../../../types/chat';

export interface ContextMenu {
  show: boolean;
  x: number;
  y: number;
  messageId: string | null;
  message?: Message | null;
  showBelow?: boolean;
}


interface MessageInteractionState {
  replyTo: Message | null;
  contextMenu: ContextMenu;
  editingMessage: Message | null;
  editText: string;
  showDeleteMessageModal: boolean;
  messageToDelete: Message | null;
}

type MessageInteractionAction =
  | { type: 'SET_REPLY_TO'; payload: Message | null }
  | { type: 'SET_CONTEXT_MENU'; payload: ContextMenu }
  | { type: 'SET_EDITING_MESSAGE'; payload: Message | null }
  | { type: 'SET_EDIT_TEXT'; payload: string }
  | { type: 'SET_SHOW_DELETE_MESSAGE_MODAL'; payload: boolean }
  | { type: 'SET_MESSAGE_TO_DELETE'; payload: Message | null };

const initialState: MessageInteractionState = {
  replyTo: null,
  contextMenu: { show: false, x: 0, y: 0, messageId: null, message: null, showBelow: false },
  editingMessage: null,
  editText: '',
  showDeleteMessageModal: false,
  messageToDelete: null
};

const reducer = (state: MessageInteractionState, action: MessageInteractionAction): MessageInteractionState => {
  switch (action.type) {
    case 'SET_REPLY_TO':
      return { ...state, replyTo: action.payload };
    case 'SET_CONTEXT_MENU':
      return { ...state, contextMenu: action.payload };
    case 'SET_EDITING_MESSAGE':
      return { ...state, editingMessage: action.payload };
    case 'SET_EDIT_TEXT':
      return { ...state, editText: action.payload };
    case 'SET_SHOW_DELETE_MESSAGE_MODAL':
      return { ...state, showDeleteMessageModal: action.payload };
    case 'SET_MESSAGE_TO_DELETE':
      return { ...state, messageToDelete: action.payload };
    default:
      return state;
  }
};

export const useMessageInteraction = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleReply = useCallback((message: Message) => {
    dispatch({ type: 'SET_REPLY_TO', payload: message });
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  const handleMessageClick = useCallback((message: Message, e: React.MouseEvent) => {
    if (message.senderId === 'system') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 160;
    let x = rect.left + rect.width / 2;
    x = Math.max(menuWidth / 2 + 10, Math.min(window.innerWidth - menuWidth / 2 - 10, x));

    dispatch({
      type: 'SET_CONTEXT_MENU',
      payload: {
        show: true,
        x,
        y: rect.top + rect.height / 2,
        messageId: message.id,
        message
      }
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    dispatch({ type: 'SET_CONTEXT_MENU', payload: { show: false, x: 0, y: 0, messageId: null, message: null, showBelow: false } });
  }, []);

  const handleEditMessage = useCallback((message: Message) => {
    dispatch({ type: 'SET_EDITING_MESSAGE', payload: message });
    dispatch({ type: 'SET_EDIT_TEXT', payload: message.text || '' });
    closeContextMenu();
  }, [closeContextMenu]);

  const handleCancelEdit = useCallback(() => {
    dispatch({ type: 'SET_EDITING_MESSAGE', payload: null });
    dispatch({ type: 'SET_EDIT_TEXT', payload: '' });
  }, []);

  const handleDeleteMessageClick = useCallback((message: Message) => {
    dispatch({ type: 'SET_MESSAGE_TO_DELETE', payload: message });
    dispatch({ type: 'SET_SHOW_DELETE_MESSAGE_MODAL', payload: true });
    closeContextMenu();
  }, [closeContextMenu]);

  return {
    replyTo: state.replyTo,
    setReplyTo: (reply: Message | null) => dispatch({ type: 'SET_REPLY_TO', payload: reply }),
    contextMenu: state.contextMenu,
    setContextMenu: (menu: ContextMenu) => dispatch({ type: 'SET_CONTEXT_MENU', payload: menu }),
    editingMessage: state.editingMessage,
    setEditingMessage: (message: Message | null) => dispatch({ type: 'SET_EDITING_MESSAGE', payload: message }),
    editText: state.editText,
    setEditText: (text: string) => dispatch({ type: 'SET_EDIT_TEXT', payload: text }),
    showDeleteMessageModal: state.showDeleteMessageModal,
    setShowDeleteMessageModal: (show: boolean) => dispatch({ type: 'SET_SHOW_DELETE_MESSAGE_MODAL', payload: show }),
    messageToDelete: state.messageToDelete,
    setMessageToDelete: (message: Message | null) => dispatch({ type: 'SET_MESSAGE_TO_DELETE', payload: message }),
    textareaRef,
    handleReply,
    handleMessageClick,
    closeContextMenu,
    handleEditMessage,
    handleCancelEdit,
    handleDeleteMessageClick
  };
};
