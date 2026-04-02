import React, { createContext, useContext, ReactNode, RefObject } from 'react';
import { Message, Group, MembersMap, UserProfileBrief } from '../../types/chat';
import { UserData } from '../../types/user';
import { ContextMenu } from './hooks/useMessageInteraction';

export type ActiveModalType = 
  | 'leave' 
  | 'delete' 
  | 'editName' 
  | 'reactions' 
  | 'members' 
  | 'newNote' 
  | 'editNote' 
  | null;

interface ChatContextType {
  groupId: string;
  userData: UserData;
  groupData: Group | null;
  messages: Message[];
  loading: boolean;
  language: string;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  tArray: (key: string) => string[];
  membersMap: MembersMap;

  membersList: UserProfileBrief[];
  
  // Interaction State
  replyTo: Message | null;
  setReplyTo: (msg: Message | null) => void;
  editingMessage: Message | null;
  setEditingMessage: (msg: Message | null) => void;
  editText: string;
  setEditText: (text: string) => void;
  activeModal: ActiveModalType;
  setActiveModal: (val: ActiveModalType) => void;
  contextMenu: ContextMenu;
  setContextMenu: (val: ContextMenu) => void;

  
  // Actions
  handleSendMessage: (text: string, replyTo: Message | null) => Promise<boolean>;
  handleSaveEdit: (messageId: string, text: string) => Promise<boolean>;
  handleConfirmDeleteMessage: (messageId: string) => Promise<boolean>;
  handleToggleReaction: (msg: Message) => Promise<void>;
  handleTranslateMessage: (msg: Message, force?: boolean) => Promise<void>;
  handleLazyTranslate: (msg: Message) => void;
  
  // Translation state
  translatingIds: Set<string>;
  translatedTexts: Record<string, string>;
  
  // Interaction Actions
  handleCancelEdit: () => void;
  userReadCount: number | null;
  
  // Shared Refs
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  previousScrollHeightRef: RefObject<number>;
  previousScrollTopRef: RefObject<number>;
  scrollToBottom: () => void;
}


const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ value: ChatContextType; children: ReactNode }> = ({ value, children }) => {
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
