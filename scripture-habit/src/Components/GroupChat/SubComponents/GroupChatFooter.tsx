import { FC, FormEvent } from 'react';
import { UilTimes } from '@iconscout/react-unicons';
import MessageInput from './MessageInput';
import { useMessageInput } from '../hooks/useMessageInput';
import { useChatData, useChatActions, useChatInteraction, useChatUI } from '../ChatContext';

const GroupChatFooter: FC = () => {
    const { userData } = useChatData();
    const { 
        t, tArray, handleSendMessage, scrollToBottom, handleDismissInactivityBanner, 
        onInputFocusChange, handleDismissTooltip, setActiveModal
    } = useChatActions();
    const { replyTo, setReplyTo, textareaRef, containerRef, editingMessage } = useChatInteraction();
    const { 
        showInactivityPolicyBanner, showAddNoteTooltip, activeModal, showDeleteMessageModal,
        showUnityModal, showInviteModal, showReportModal
    } = useChatUI();

    const isAnyModalOpen = activeModal !== null || showDeleteMessageModal || !!editingMessage || showUnityModal || showInviteModal || showReportModal;

    const { 
        newMessage, setNewMessage, inputPlaceholder, onSendMessage, handleKeyDown 
    } = useMessageInput(
        t, 
        tArray, 
        userData, 
        handleSendMessage, 
        scrollToBottom, 
        setReplyTo, 
        replyTo
    );

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
