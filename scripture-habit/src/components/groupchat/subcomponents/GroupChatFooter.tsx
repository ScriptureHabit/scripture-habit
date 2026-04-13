import { FC, FormEvent } from 'react';
import { UilTimes } from '@iconscout/react-unicons';
import MessageInput from './MessageInput';
import { useMessageInput } from '../hooks/interaction/useMessageInput';
import { 
    useChatData, 
    useChatMessageActions, 
    useChatUIActions 
} from '../ChatContext';
import { useChatStore } from '../../../store/useChatStore';
import { useModalStore } from '../../../store/useModalStore';

const GroupChatFooter: FC = () => {
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
            <span>{t('groupChat.inactivityPolicyBanner', { days: userData?.kickThreshold || 3 })}</span>
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
