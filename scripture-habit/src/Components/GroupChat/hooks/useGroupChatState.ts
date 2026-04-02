import { useCallback, useReducer } from 'react';

interface GroupChatLocalState {
  membersLoading: boolean;
  showMobileMenu: boolean;
}

type GroupChatLocalAction =
  | { type: 'SET_MEMBERS_LOADING'; payload: boolean }
  | { type: 'SET_SHOW_MOBILE_MENU'; payload: boolean };

const initialState: GroupChatLocalState = {
  membersLoading: false,
  showMobileMenu: false
};

const reducer = (state: GroupChatLocalState, action: GroupChatLocalAction): GroupChatLocalState => {
  switch (action.type) {
    case 'SET_MEMBERS_LOADING':
      return { ...state, membersLoading: action.payload };
    case 'SET_SHOW_MOBILE_MENU':
      return { ...state, showMobileMenu: action.payload };
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

  return {
    state,
    setMembersLoading,
    setShowMobileMenu
  };
};

