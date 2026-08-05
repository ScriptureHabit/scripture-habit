import { FormEvent } from 'react';
import { UilTimes } from '@iconscout/react-unicons';
import MessageInput from './message-input';
import { useMessageInput } from '../hooks/interaction/use-message-input';
import { 
    useChatData, 
    useChatMessageActions, 
    useChatUIActions 
} from '../hooks/use-chat-context';
import { useChatStore } from '../../../store/use-chat-store';
import { DEFAULT_KICK_THRESHOLD } from '../../../constants';
import { useModalStore } from '../../../store/use-modal-store';

const GroupChatFooter = () => {
    const { userData } = useChatData();
    const { handleSendMessage } = useChatMessageActions();
    const { 
        t, tArray, scrollToBottom, onInputFocusChange, 
        containerRef, textareaRef 
    } = useChatUIActions();
    
    // Zustand States
    const { 
        replyTo, setReplyTo, showInactivityPolicyBanner, showAddNoteTooltip,
        editingMessage, showDeleteMessageModal, showUnityModal, showInviteModal, showReportModal,
        setShowAddNoteTooltip, setShowInactivityPolicyBanner
    } = useChatStore();
    const { activeModal, setActiveModal } = useModalStore();

    const isAnyModalOpen = activeModal !== null || showDeleteMessageModal || !!editingMessage || showUnityModal || showInviteModal || showReportModal;

    const { 
        newMessage, setNewMessage, inputPlaceholder, onSendMessage, handleKeyDown 
    } = useMessageInput(
        t, 
        tArray, 
        userData, 
        handleSendMessage, 
        scrollToBottom
    );

    const handleDismissInactivityBanner = () => {
        setShowInactivityPolicyBanner(false);
    };

    const handleDismissTooltip = () => {
        setShowAddNoteTooltip(false);
    };

    return (
        <>
        {showInactivityPolicyBanner && (
            <div className="inactivity-policy-banner">
            <span>{t('groupChat.inactivityPolicyBanner', { days: userData?.kickThreshold || DEFAULT_KICK_THRESHOLD })}</span>
            <button className="inactivity-policy-dismiss" onClick={handleDismissInactivityBanner} aria-label={t('common.dismiss')}><UilTimes size="16" /></button>
            </div>
        )}
        <MessageInput
            handleSendMessage={(e: FormEvent) => onSendMessage(e)}
            isAnyModalOpen={isAnyModalOpen}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            t={t}
            textareaRef={textareaRef}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            handleKeyDown={handleKeyDown}
            onInputFocusChange={onInputFocusChange}
            containerRef={containerRef}
            inputPlaceholder={inputPlaceholder}
            showAddNoteTooltip={showAddNoteTooltip}
            handleDismissTooltip={handleDismissTooltip}
            setIsNewNoteOpen={() => setActiveModal('newNote')}
        />
        </>
    );
};

export default GroupChatFooter;

