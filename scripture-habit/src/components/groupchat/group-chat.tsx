import { useEffect, useState } from 'react';
import './group-chat.css';
import GroupChatMessageListContainer from './subcomponents/group-chat-message-list-container';
import GroupChatFooter from './subcomponents/group-chat-footer';
import GroupChatModals from './group-chat-modals';
import ChatHeader from './subcomponents/chat-header';
import GroupChatContextMenu from './subcomponents/group-chat-context-menu';
import GroupChatProvider from './group-chat-provider';
import GroupChatTour from './group-chat-tour';
import { useModalStore } from '../../store/use-modal-store';
import { useLanguage } from '../../hooks/use-language';
import { UserData } from '../../types/user';
import { Group } from '../../types/chat';
import { clearGroupNotifications } from '../../utils/notification-helper';
import apiClient from '../../utils/api-client';

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

const GroupChatContent = ({ userData }: { userData: UserData }) => {
    const { activeModal, setActiveModal } = useModalStore();
    const { t } = useLanguage();
    const [showTour, setShowTour] = useState(false);

    useEffect(() => {
        if (!userData) return;
        const uid = userData.uid || 'guest';
        const userTourSeenKey = `group_chat_tour_seen_${uid}`;
        const localSeen = localStorage.getItem(userTourSeenKey) === 'true';
        const firestoreSeen = userData.hasSeenGroupChatTour === true;

        if (!localSeen && !firestoreSeen) {
            // Delay slightly to let the group chat components mount into DOM
            const timer = setTimeout(() => setShowTour(true), 500);
            return () => clearTimeout(timer);
        }
    }, [userData]);

    const handleCloseTour = async () => {
        if (userData?.uid) {
            localStorage.setItem(`group_chat_tour_seen_${userData.uid}`, 'true');
            try {
                await apiClient.post('/api/auth/update-profile', { hasSeenGroupChatTour: true });
            } catch (err) {
                console.error('Failed to update hasSeenGroupChatTour:', err);
            }
        }
        localStorage.setItem('group_chat_tour_seen_guest', 'true');
        setShowTour(false);
    };

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

            {/* Group Chat Tour */}
            <GroupChatTour
                isOpen={showTour}
                onClose={handleCloseTour}
                t={t}
            />

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

const GroupChat = (props: GroupChatProps) => {
  useEffect(() => {
    // Clear any OS push notifications for this specific group when the user opens it
    if (props.isActive) {
       clearGroupNotifications(props.groupId);
    }
  }, [props.groupId, props.isActive]);

  return (
    <GroupChatProvider {...props} isActive={props.isActive ?? false}>
      <GroupChatContent userData={props.userData} />
    </GroupChatProvider>
  );
};

export default GroupChat;
