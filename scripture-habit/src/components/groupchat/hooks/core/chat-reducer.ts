import { Message, GroupData, MembersMap } from '../../../../types/chat';
import { parseTimestampToMillis } from '../../../../utils/time-utils';

export type ChatStatus = 'loading' | 'active' | 'error' | 'notFound';

export interface ChatState {
  status: ChatStatus;
  messages: Message[];
  groupData: GroupData | null;
  error: string | null;
  userReadCount: number | null;
  initialScrollDone: boolean;
  hasMoreOlder: boolean;
  isLoadingOlder: boolean;
  membersMap: MembersMap;
}

export type ChatAction =
  | { type: 'RESET'; groupId: string }
  | { type: 'SET_INITIAL_STATE'; messages: Message[]; groupData: GroupData; readCount: number }
  | { type: 'UPDATE_GROUP'; groupData: GroupData }
  | { type: 'SET_NOT_FOUND' }
  | { type: 'SET_ERROR'; message: string }
  | { type: 'SET_MESSAGES'; messages: Message[] }
  | { type: 'ADD_NEW_MESSAGES'; newMessages: Message[] }
  | { type: 'SET_LOADING_OLDER'; isLoading: boolean }
  | { type: 'ADD_OLDER_MESSAGES'; olderMessages: Message[]; hasMore: boolean }
  | { type: 'SET_READ_COUNT'; count: number }
  | { type: 'SET_SCROLL_DONE' }
  | { type: 'UPDATE_MEMBERS'; newMembers: MembersMap }
  | { type: 'UPDATE_MESSAGE'; messageId: string; data: Partial<Message> }
  | { type: 'REMOVE_MESSAGE'; messageId: string };

export const initialState: ChatState = {
  status: 'loading',
  messages: [],
  groupData: null,
  error: null,
  userReadCount: null,
  initialScrollDone: false,
  hasMoreOlder: true,
  isLoadingOlder: false,
  membersMap: {}
};

export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'RESET':
      return {
        ...initialState,
        status: 'loading',
      };
    case 'SET_INITIAL_STATE':
      return {
        ...state,
        status: 'active',
        messages: action.messages,
        groupData: action.groupData || state.groupData,
        userReadCount: action.readCount
      };
    case 'UPDATE_GROUP': {
      const isSame = state.groupData && JSON.stringify(state.groupData) === JSON.stringify(action.groupData);
      if (isSame && state.status === 'active') return state;
      return { 
        ...state, 
        groupData: action.groupData,
        status: state.status === 'loading' ? 'active' : state.status 
      };
    }
    case 'SET_NOT_FOUND':
      return { ...state, status: 'notFound' };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.message };
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages, status: 'active' };
    case 'ADD_NEW_MESSAGES': {
      const { newMessages } = action;
      
      if (newMessages.length === 0) {
        if (state.status === 'loading') return { ...state, status: 'active' };
        return state;
      }

      // 1. Identify which optimistic IDs are being resolved
      const optimisticIdsToResolve = new Set(
        newMessages.map(m => m.optimisticId).filter(Boolean) as string[]
      );

      // 2. Filter existing messages to remove resolved optimistic ones
      const existingMessages = state.messages.filter(m => {
        const isResolvedOptimistic = optimisticIdsToResolve.has(m.id);
        const matchesServerOptimisticId = m.optimisticId && optimisticIdsToResolve.has(m.optimisticId);
        return !isResolvedOptimistic && !matchesServerOptimisticId;
      });

      // 3. Combine and Deduplicate by ID
      const allMessagesMap = new Map<string, Message>();
      existingMessages.forEach(m => allMessagesMap.set(m.id, m));
      newMessages.forEach(m => allMessagesMap.set(m.id, m));

      const finalMessages = Array.from(allMessagesMap.values()).sort((a, b) => {
        const timeA = a.clientTimestamp || parseTimestampToMillis(a.createdAt);
        const timeB = b.clientTimestamp || parseTimestampToMillis(b.createdAt);
        return timeA - timeB;
      });

      // Prevent redundant update if messages didn't change (only content/IDs)
      const isSame = finalMessages.length === state.messages.length && 
                     finalMessages.every((m, i) => m.id === state.messages[i]?.id && m.text === state.messages[i]?.text);
      
      if (isSame && state.status === 'active') return state;

      return { ...state, messages: finalMessages, status: 'active' };
    }
    case 'SET_LOADING_OLDER':
      return { ...state, isLoadingOlder: action.isLoading };
    case 'ADD_OLDER_MESSAGES': {
      const allMessagesMap = new Map<string, Message>();
      action.olderMessages.forEach(m => allMessagesMap.set(m.id, m));
      state.messages.forEach(m => allMessagesMap.set(m.id, m));

      const combined = Array.from(allMessagesMap.values()).sort((a, b) => {
        const timeA = a.clientTimestamp || parseTimestampToMillis(a.createdAt);
        const timeB = b.clientTimestamp || parseTimestampToMillis(b.createdAt);
        return timeA - timeB;
      });

      return {
        ...state,
        messages: combined,
        hasMoreOlder: action.hasMore,
        isLoadingOlder: false
      };
    }
    case 'SET_READ_COUNT':
      return { ...state, userReadCount: Math.max(state.userReadCount || 0, action.count) };
    case 'SET_SCROLL_DONE':
      return { ...state, initialScrollDone: true };
    case 'UPDATE_MEMBERS': {
      const newKeys = Object.keys(action.newMembers);
      if (newKeys.length === 0) return state;

      let hasChanges = false;
      const updatedMap = { ...state.membersMap };
      
      for (const key of newKeys) {
        if (JSON.stringify(state.membersMap[key]) !== JSON.stringify(action.newMembers[key])) {
          updatedMap[key] = action.newMembers[key];
          hasChanges = true;
        }
      }

      if (!hasChanges) return state;
      return { ...state, membersMap: updatedMap };
    }
    case 'UPDATE_MESSAGE': {
      const updatedMessages = state.messages.map(m => m.id === action.messageId ? { ...m, ...action.data } : m);
      if (JSON.stringify(updatedMessages) === JSON.stringify(state.messages)) return state;
      return { ...state, messages: updatedMessages };
    }
    case 'REMOVE_MESSAGE':
      return { ...state, messages: state.messages.filter(m => m.id !== action.messageId) };
    default:
      return state;
  }
};
