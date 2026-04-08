import { FC } from 'react';
import './GroupChat.css';
import GroupChatMessageListContainer from './subcomponents/GroupChatMessageListContainer';
import GroupChatFooter from './subcomponents/GroupChatFooter';
import GroupChatModals from './GroupChatModals';
import ChatHeader from './subcomponents/ChatHeader';
import GroupChatContextMenu from './subcomponents/GroupChatContextMenu';
import GroupChatProvider from './GroupChatProvider';
import { useChatUI, useChatActions } from './ChatContext';
import { UserData } from '../../types/user';
import { Group } from '../../types/chat';

interface GroupChatProps {
  groupId: string;
  userData: UserData;
  userGroups: Group[];
  onBack?: () => void;
  onGroupSelect?: (groupId: string) => void;
  onInputFocusChange?: (focused: boolean) => void;
  isExternalModalOpen?: boolean;
  initialShowInviteModal?: boolean;
  onUnityUpdate?: (percentage: number) => void;
  isActive?: boolean;
}

const GroupChatContent: FC = () => {
    const { activeModal } = useChatUI();
    const { setActiveModal } = useChatActions();

    return (
        <>
            <div className={`GroupChat ${activeModal === 'members' ? 'members-open' : ''}`}>
                <ChatHeader />
                <GroupChatMessageListContainer />
                <GroupChatFooter />
            </div>

            {/* Feature Overlays */}
            <GroupChatContextMenu />
            <GroupChatModals />
            
            {/* Click-to-close overlay for modals */}
            {activeModal && (
              <div 
                className="modal-backdrop-overlay" 
                onClick={() => setActiveModal(null)} 
              />
            )}
        </>
    );
};

const GroupChat: FC<GroupChatProps> = (props) => {
  return (
    <GroupChatProvider {...props} isActive={props.isActive ?? false}>
      <GroupChatContent />
    </GroupChatProvider>
  );
};

export default GroupChat;
