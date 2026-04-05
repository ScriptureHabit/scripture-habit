import { Message, GroupData, MembersMap } from '../../../../types/chat';
import { parseTimestampToMillis } from '../../../../utils/timeUtils';

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
    case 'UPDATE_GROUP':
      return { ...state, groupData: action.groupData };
    case 'SET_NOT_FOUND':
      return { ...state, status: 'notFound' };
    case 'SET_ERROR':
      return { ...state, status: 'error', error: action.message };
    case 'SET_MESSAGES':
      return { ...state, messages: action.messages, status: 'active' };
    case 'ADD_NEW_MESSAGES': {
      // TRUTH: Identify which optimistic IDs are being resolved by ANY incoming message
      const optimisticIdsToResolve = new Set(
        action.newMessages.map(m => m.optimisticId).filter(Boolean) as string[]
      );

      // TRUTH: Solid deduplication strategy
      const incoming = action.newMessages.filter(n => !state.messages.some(p => p.id === n.id));
      
      const existingMessages = state.messages.filter(m => {
        const isResolvedOptimistic = optimisticIdsToResolve.has(m.id);
        const matchesServerOptimisticId = m.optimisticId && optimisticIdsToResolve.has(m.optimisticId);
        return !isResolvedOptimistic && !matchesServerOptimisticId;
      });

      if (incoming.length === 0 && existingMessages.length === state.messages.length) return state;

      const newMessages = [...existingMessages, ...incoming].sort((a, b) => {
        const timeA = parseTimestampToMillis(a.createdAt);
        const timeB = parseTimestampToMillis(b.createdAt);
        return timeA - timeB; // No more sorting to 0 (top of chat)
      });
      return { ...state, messages: newMessages, status: 'active' };
    }
    case 'SET_LOADING_OLDER':
      return { ...state, isLoadingOlder: action.isLoading };
    case 'ADD_OLDER_MESSAGES':
      return {
        ...state,
        messages: [...action.olderMessages, ...state.messages],
        hasMoreOlder: action.hasMore,
        isLoadingOlder: false
      };
    case 'SET_READ_COUNT':
      return { ...state, userReadCount: action.count };
    case 'SET_SCROLL_DONE':
      return { ...state, initialScrollDone: true };
    case 'UPDATE_MEMBERS':
      return { ...state, membersMap: { ...state.membersMap, ...action.newMembers } };
    case 'UPDATE_MESSAGE':
      return { ...state, messages: state.messages.map(m => m.id === action.messageId ? { ...m, ...action.data } : m) };
    case 'REMOVE_MESSAGE':
      return { ...state, messages: state.messages.filter(m => m.id !== action.messageId) };
    default:
      return state;
  }
};
