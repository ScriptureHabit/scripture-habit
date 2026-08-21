import React, { ReactNode } from 'react';
import { 
  ChatDataContext, 
  ChatDataContextType, 
  ChatMessageActionsContext, 
  ChatMessageActionsContextType, 
  ChatGroupActionsContext, 
  ChatGroupActionsContextType, 
  ChatUIActionsContext, 
  ChatUIActionsContextType 
} from './chat-context';

export const ChatProvider: React.FC<{ 
  data: ChatDataContextType; 
  messageActions: ChatMessageActionsContextType;
  groupActions: ChatGroupActionsContextType;
  uiActions: ChatUIActionsContextType;
  children: ReactNode;
}> = ({ data, messageActions, groupActions, uiActions, children }) => {
  return (
    <ChatDataContext.Provider value={data}>
      <ChatMessageActionsContext.Provider value={messageActions}>
        <ChatGroupActionsContext.Provider value={groupActions}>
          <ChatUIActionsContext.Provider value={uiActions}>
            {children}
          </ChatUIActionsContext.Provider>
        </ChatGroupActionsContext.Provider>
      </ChatMessageActionsContext.Provider>
    </ChatDataContext.Provider>
  );
};
