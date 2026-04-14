import { FC } from 'react';
import './group-chat.css';
import GroupChatMessageListContainer from './subcomponents/group-chat-message-list-container';
import GroupChatFooter from './subcomponents/group-chat-footer';
import GroupChatModals from './group-chat-modals';
import ChatHeader from './subcomponents/chat-header';
import GroupChatContextMenu from './subcomponents/group-chat-context-menu';
import GroupChatProvider from './group-chat-provider';
import { useModalStore } from '../../store/useModalStore';
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
    const { activeModal, setActiveModal } = useModalStore();

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
