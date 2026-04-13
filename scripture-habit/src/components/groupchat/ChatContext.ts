import { createContext, Dispatch, RefObject, useContext } from 'react';
import { Message, Group, MembersMap, UserProfileBrief, GroupData } from '../../types/chat';
import { ReactionPreview } from '../../../types/firestore';
import { UserData } from '../../types/user';
import { ChatAction } from './hooks/core/chatReducer';

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
  isRecapLoading: boolean;
  isRecapAvailable: boolean;
  unityModalData: {
    posted: { id: string; nickname: string }[];
    notPosted: { id: string; nickname: string }[];
  };
}

export interface ChatMessageActionsContextType {
  handleSendMessage: (text: string, replyTo: Message | null) => Promise<boolean>;
  handleSaveEdit: (message: Message, text: string) => Promise<boolean>;
  handleConfirmDeleteMessage: (message: Message) => Promise<boolean>;
  handleToggleReaction: (msg: Message) => Promise<void>;
  handleTranslateMessage: (msg: Message, force?: boolean) => Promise<void>;
  handleLazyTranslate: (msg: Message) => void;
  handleReply: (msg: Message) => void;
  handleMessageClick: (msg: Message, e: React.MouseEvent) => void;
  handleEditMessage: (msg: Message) => void;
  handleDeleteMessageClick: (msg: Message) => void;
  handleReportClick: (msg: Message) => void;
  handleToggleReactionDirect: (msg: Message, emoji: string) => Promise<void>;
  translatingIds: Set<string>;
  translatedTexts: Record<string, string>;
}

export interface ChatGroupActionsContextType {
  handleLeaveGroup: () => Promise<void>;
  handleDeleteGroup: (confirmation: string) => Promise<void>;
  handleUpdateGroupName: (name: string, desc: string, tName: string, tDesc: string) => Promise<boolean>;
  togglePublicStatus: () => Promise<void>;
  handleCopyInviteLink: () => void;
  handleRegenerateInviteCode: () => Promise<void>;
  handleGenerateWeeklyRecap: () => Promise<void>;
  handleUserProfileClick: (userId: string | null) => Promise<void>;
  handleShowMembers: () => void;
  handleShowUnityModal: () => void;
  handleShowReactions: (reactions: Record<string, string[]>, previews?: Record<string, ReactionPreview[]>) => void;
  translatedGroupName: string;
  translatedGroupDesc: string;
  isLeaving: boolean;
  isDeleting: boolean;
  isSendingCheer: boolean;
  cheeredTodayUids: Set<string>;
  confirmReport: () => Promise<boolean>;
  handleSendCheer: () => Promise<boolean | undefined>;
  handleCheerClick: (member: UserProfileBrief) => void;
}

export interface ChatUIActionsContextType {
  t: (key: string, replacements?: Record<string, string | number>) => string;
  tArray: (key: string) => string[];
  scrollToBottom: () => void;
  handleScroll: () => void;
  dispatch: Dispatch<ChatAction>;
  closeContextMenu: () => void;
  onBack?: () => void;
  onGroupSelect?: (groupId: string) => void;
  onInputFocusChange?: (focused: boolean) => void;
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  loadMoreOlderMessages: (containerRef: RefObject<HTMLDivElement | null>, heightRef: RefObject<number>, topRef: RefObject<number>) => Promise<void>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  previousScrollHeightRef: RefObject<number>;
  previousScrollTopRef: RefObject<number>;
}

export const ChatDataContext = createContext<ChatDataContextType | undefined>(undefined);
export const ChatMessageActionsContext = createContext<ChatMessageActionsContextType | undefined>(undefined);
export const ChatGroupActionsContext = createContext<ChatGroupActionsContextType | undefined>(undefined);
export const ChatUIActionsContext = createContext<ChatUIActionsContextType | undefined>(undefined);

export const useChatData = () => {
    const context = useContext(ChatDataContext);
    if (!context) throw new Error('useChatData must be used within ChatProvider');
    return context;
};

export const useChatMessageActions = () => {
    const context = useContext(ChatMessageActionsContext);
    if (!context) throw new Error('useChatMessageActions must be used within ChatProvider');
    return context;
};

export const useChatGroupActions = () => {
    const context = useContext(ChatGroupActionsContext);
    if (!context) throw new Error('useChatGroupActions must be used within ChatProvider');
    return context;
};

export const useChatUIActions = () => {
    const context = useContext(ChatUIActionsContext);
    if (!context) throw new Error('useChatUIActions must be used within ChatProvider');
    return context;
};
