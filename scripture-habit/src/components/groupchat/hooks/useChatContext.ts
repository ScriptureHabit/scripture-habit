import { useContext } from 'react';
import { 
  ChatDataContext, 
  ChatMessageActionsContext, 
  ChatGroupActionsContext, 
  ChatUIActionsContext 
} from '../ChatContext';

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

// Legacy shim for easier migration
export const useChat = () => {
  return {
    ...useChatData(),
    ...useChatMessageActions(),
    ...useChatGroupActions(),
    ...useChatUIActions()
  };
};
