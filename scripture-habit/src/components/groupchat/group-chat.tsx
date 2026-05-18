import { FC, useEffect } from 'react';
import './group-chat.css';
import GroupChatMessageListContainer from './subcomponents/group-chat-message-list-container';
import GroupChatFooter from './subcomponents/group-chat-footer';
import GroupChatModals from './group-chat-modals';
import ChatHeader from './subcomponents/chat-header';
import GroupChatContextMenu from './subcomponents/group-chat-context-menu';
import GroupChatProvider from './group-chat-provider';
import { useModalStore } from '../../store/use-modal-store';
import { UserData } from '../../types/user';
import { Group } from '../../types/chat';
import { clearGroupNotifications } from '../../utils/notification-helper';

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
  useEffect(() => {
    console.log(`[GroupChat] Mounted for group: ${props.groupId}`);
    
    // Clear any OS push notifications for this specific group when the user opens it
    if (props.isActive) {
       clearGroupNotifications(props.groupId);
    }

    return () => console.log(`[GroupChat] Unmounted for group: ${props.groupId}`);
  }, [props.groupId, props.isActive]);

  return (
    <GroupChatProvider {...props} isActive={props.isActive ?? false}>
      <GroupChatContent />
    </GroupChatProvider>
  );
};

export default GroupChat;
