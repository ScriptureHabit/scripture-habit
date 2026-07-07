import { useCallback, useReducer } from 'react';

interface GroupChatLocalState {
  showMobileMenu: boolean;
}

type GroupChatLocalAction =
  | { type: 'SET_SHOW_MOBILE_MENU'; payload: boolean };

const initialState: GroupChatLocalState = {
  showMobileMenu: false
};

const reducer = (state: GroupChatLocalState, action: GroupChatLocalAction): GroupChatLocalState => {
  switch (action.type) {
    case 'SET_SHOW_MOBILE_MENU':
      return { ...state, showMobileMenu: action.payload };
    default:
      return state;
  }
};

export const useGroupChatState = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setShowMobileMenu = useCallback((value: boolean) => {
    dispatch({ type: 'SET_SHOW_MOBILE_MENU', payload: value });
  }, []);

  return {
    state,
    setShowMobileMenu
  };
};
