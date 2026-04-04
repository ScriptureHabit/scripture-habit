import React, { createContext, useContext, ReactNode, RefObject, Dispatch } from 'react';
import { Message, Group, MembersMap, UserProfileBrief, GroupData } from '../../types/chat';
import { ReactionPreview } from '../../../types/firestore';
import { UserData } from '../../types/user';
import { Note } from '../../types/note';
import { ReactionItem } from '../../store/useModalStore';
import { ContextMenu } from './hooks/interaction/useMessageInteraction';
import { ChatAction } from './hooks/core/chatReducer';

export type ActiveModalType = 
  | 'leave' 
  | 'delete' 
  | 'editName' 
  | 'reactions' 
  | 'members' 
  | 'newNote' 
  | 'editNote' 
  | null;

// 1. Data Context: Stable Firestore data
export interface ChatDataContextType {
  groupId: string;
  userData: UserData;
  groupData: GroupData | null;
  messages: Message[];
  loading: boolean;
  membersLoading: boolean; 
  membersMap: MembersMap;
  membersList: UserProfileBrief[];
  userReadCount: number | null;
  unityPercentage: number;
  isOwner: boolean;
  language: string;
  userGroups: Group[];
}

// 2. Interaction Context: High-frequency UI state (inputs, context menus, refs)
export interface ChatInteractionContextType {
  replyTo: Message | null;
  editingMessage: Message | null;
  editText: string;
  contextMenu: ContextMenu;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  previousScrollHeightRef: RefObject<number>;
  previousScrollTopRef: RefObject<number>;
  messageToDelete: Message | null;
  setReplyTo: (msg: Message | null) => void;
  setEditingMessage: (msg: Message | null) => void;
  setEditText: (text: string) => void;
  setContextMenu: (val: ContextMenu) => void;
  setMessageToDelete: (msg: Message | null) => void;
}

// 3. UI Context: Modals, tooltips, and non-critical toggles
export interface ChatUIContextType {
  activeModal: ActiveModalType;
  showDeleteMessageModal: boolean;
  showUnityModal: boolean;
  showInviteModal: boolean;
  showReportModal: boolean;
  showInactivityPolicyBanner: boolean;
  showAddNoteTooltip: boolean;
  showMobileMenu: boolean;
  isRecapLoading: boolean;
  isRecapAvailable: boolean;
  unityModalData: {
    posted: { id: string; nickname: string }[];
    notPosted: { id: string; nickname: string }[];
  };
}

// 4. Action Context: Stable handler functions & state setters
export interface ChatActionContextType {
  // Handlers
  t: (key: string, replacements?: Record<string, string | number>) => string;
  tArray: (key: string) => string[];
  handleSendMessage: (text: string, replyTo: Message | null) => Promise<boolean>;
  handleSaveEdit: (message: Message, text: string) => Promise<boolean>;
  handleConfirmDeleteMessage: (message: Message) => Promise<boolean>;
  handleToggleReaction: (msg: Message) => Promise<void>;
  handleTranslateMessage: (msg: Message, force?: boolean) => Promise<void>;
  handleLazyTranslate: (msg: Message) => void;
  handleCancelEdit: () => void;
  handleReply: (msg: Message) => void;
  handleMessageClick: (msg: Message, e: React.MouseEvent) => void;
  handleEditMessage: (msg: Message) => void;
  handleDeleteMessageClick: (msg: Message) => void;
  handleReportClick: (msg: Message) => void;
  handleUserProfileClick: (userId: string | null) => Promise<void>;
  handleShowReactions: (reactions: Record<string, string[]>, previews?: Record<string, ReactionPreview[]>) => void;
  handleShowMembers: () => void;
  handleShowUnityModal: () => void;
  handleGenerateWeeklyRecap: () => Promise<void>;
  handleLeaveGroup: () => Promise<void>;
  handleDeleteGroup: (confirmation: string) => Promise<void>;
  handleUpdateGroupName: (name: string, desc: string, tName: string, tDesc: string) => Promise<boolean>;
  togglePublicStatus: () => Promise<void>;
  scrollToBottom: () => void;
  handleScroll: () => void;
  dispatch: Dispatch<ChatAction>;
  
  // State Setters (UI Logic)
  setActiveModal: (val: ActiveModalType) => void;
  setShowDeleteMessageModal: (show: boolean) => void;
  setShowUnityModal: (show: boolean) => void;
  setShowInviteModal: (show: boolean) => void;
  setShowReportModal: (show: boolean) => void;
  setShowInactivityPolicyBanner: (show: boolean) => void;
  setShowAddNoteTooltip: (show: boolean) => void;
  setShowMobileMenu: (show: boolean) => void;
  setMembersLoading: (val: boolean) => void;
  handleDismissTooltip: () => void;
  handleDismissInactivityBanner: () => void;
  closeContextMenu: () => void;

  // Feature Props
  onBack?: () => void;
  onGroupSelect?: (groupId: string) => void;
  onInputFocusChange?: (focused: boolean) => void;
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  loadMoreOlderMessages: (containerRef: RefObject<HTMLDivElement | null>, heightRef: RefObject<number>, topRef: RefObject<number>) => Promise<void>;
  isLeaving: boolean;
  isDeleting: boolean;

  // Cheer & Report State
  cheerTarget: UserProfileBrief | null;
  setCheerTarget: (target: UserProfileBrief | null) => void;
  isSendingCheer: boolean;
  cheeredTodayUids: Set<string>;
  handleSendCheer: () => Promise<boolean | undefined>;
  handleCheerClick: (member: UserProfileBrief) => void;
  reportReason: string;
  setReportReason: (reason: string) => void;
  confirmReport: () => Promise<boolean>;

  // Invite & Name
  handleCopyInviteLink: () => void;
  handleRegenerateInviteCode: () => Promise<void>;
  translatedGroupName: string;
  translatedGroupDesc: string;

  // Modal Specific State
  selectedMember: UserProfileBrief | null;
  setSelectedMember: (member: UserProfileBrief | null) => void;
  reactionsToShow: ReactionItem[];
  setReactionsToShow: (reactions: ReactionItem[]) => void;
  newGroupName: string;
  setNewGroupName: (val: string) => void;
  newGroupDescription: string;
  setNewGroupDescription: (val: string) => void;
  newTranslatedName: string;
  setNewTranslatedName: (val: string) => void;
  newTranslatedDesc: string;
  setNewTranslatedDesc: (val: string) => void;
  deleteConfirmationName: string;
  setDeleteConfirmationName: (val: string) => void;
  noteToEdit: Note | null;
  setNoteToEdit: (note: Note | null) => void;

  // Translation helpers
  translatingIds: Set<string>;
  translatedTexts: Record<string, string>;
}

const ChatDataContext = createContext<ChatDataContextType | undefined>(undefined);
const ChatInteractionContext = createContext<ChatInteractionContextType | undefined>(undefined);
const ChatUIContext = createContext<ChatUIContextType | undefined>(undefined);
const ChatActionContext = createContext<ChatActionContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ 
  data: ChatDataContextType; 
  interaction: ChatInteractionContextType;
  ui: ChatUIContextType;
  actions: ChatActionContextType;
  children: ReactNode;
}> = ({ data, interaction, ui, actions, children }) => {
  return (
    <ChatDataContext.Provider value={data}>
      <ChatActionContext.Provider value={actions}>
        <ChatUIContext.Provider value={ui}>
          <ChatInteractionContext.Provider value={interaction}>
            {children}
          </ChatInteractionContext.Provider>
        </ChatUIContext.Provider>
      </ChatActionContext.Provider>
    </ChatDataContext.Provider>
  );
};

export const useChatData = () => {
  const context = useContext(ChatDataContext);
  if (!context) throw new Error('useChatData must be used within ChatProvider');
  return context;
};

export const useChatInteraction = () => {
  const context = useContext(ChatInteractionContext);
  if (!context) throw new Error('useChatInteraction must be used within ChatProvider');
  return context;
};

export const useChatUI = () => {
  const context = useContext(ChatUIContext);
  if (!context) throw new Error('useChatUI must be used within ChatProvider');
  return context;
};

export const useChatActions = () => {
  const context = useContext(ChatActionContext);
  if (!context) throw new Error('useChatActions must be used within ChatProvider');
  return context;
};

export const useChat = () => {
  const data = useChatData();
  const interaction = useChatInteraction();
  const ui = useChatUI();
  const actions = useChatActions();
  return { ...data, ...interaction, ...ui, ...actions };
};
