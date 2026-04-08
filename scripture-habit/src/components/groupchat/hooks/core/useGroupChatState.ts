import { useCallback, useReducer } from 'react';
import { UserProfileBrief } from '../../../../types/chat';

interface GroupChatLocalState {
  membersLoading: boolean;
  showMobileMenu: boolean;
  membersList: UserProfileBrief[];
}

type GroupChatLocalAction =
  | { type: 'SET_MEMBERS_LOADING'; payload: boolean }
  | { type: 'SET_SHOW_MOBILE_MENU'; payload: boolean }
  | { type: 'SET_MEMBERS_LIST'; payload: UserProfileBrief[] | ((prev: UserProfileBrief[]) => UserProfileBrief[]) };

const initialState: GroupChatLocalState = {
  membersLoading: false,
  showMobileMenu: false,
  membersList: []
};

const reducer = (state: GroupChatLocalState, action: GroupChatLocalAction): GroupChatLocalState => {
  switch (action.type) {
    case 'SET_MEMBERS_LOADING':
      return { ...state, membersLoading: action.payload };
    case 'SET_SHOW_MOBILE_MENU':
      return { ...state, showMobileMenu: action.payload };
    case 'SET_MEMBERS_LIST':
      const nextList = typeof action.payload === 'function' ? action.payload(state.membersList) : action.payload;
      return { ...state, membersList: nextList };
    default:
      return state;
  }
};

export const useGroupChatState = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setMembersLoading = useCallback((value: boolean) => {
    dispatch({ type: 'SET_MEMBERS_LOADING', payload: value });
  }, []);

  const setShowMobileMenu = useCallback((value: boolean) => {
    dispatch({ type: 'SET_SHOW_MOBILE_MENU', payload: value });
  }, []);

  const setMembersList = useCallback((payload: UserProfileBrief[] | ((prev: UserProfileBrief[]) => UserProfileBrief[])) => {
    dispatch({ type: 'SET_MEMBERS_LIST', payload });
  }, []);

  return {
    state,
    setMembersLoading,
    setShowMobileMenu,
    setMembersList
  };
};
