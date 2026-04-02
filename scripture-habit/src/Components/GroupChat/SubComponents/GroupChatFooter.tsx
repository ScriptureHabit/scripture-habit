import { FC, RefObject, FormEvent } from 'react';
import { UilTimes } from '@iconscout/react-unicons';
import { Message } from '../../../types/chat';
import MessageInput from './MessageInput';
import { useMessageInput } from '../hooks/useMessageInput';

interface GroupChatFooterProps {
  showInactivityPolicyBanner: boolean;
  handleDismissInactivityBanner: () => void;
  handleSendMessage: (text: string, replyTo: Message | null) => Promise<boolean>;
  scrollToBottom: () => void;
  isAnyModalOpen: boolean;
  replyTo: Message | null;
  setReplyTo: (msg: Message | null) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  tArray: (key: string) => string[];

  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInputFocusChange?: (focused: boolean) => void;
  containerRef: RefObject<HTMLElement | null>;
  showAddNoteTooltip: boolean;
  handleDismissTooltip: () => void;
  setIsNewNoteOpen: (open: boolean) => void;
  userData: { kickThreshold?: number } | null;
}

const GroupChatFooter: FC<GroupChatFooterProps> = ({
  showInactivityPolicyBanner,
  handleDismissInactivityBanner,
  handleSendMessage,
  scrollToBottom,
  isAnyModalOpen,
  replyTo,
  setReplyTo,
  t,
  tArray,
  textareaRef,
  onInputFocusChange,
  containerRef,
  showAddNoteTooltip,
  handleDismissTooltip,
  setIsNewNoteOpen,
  userData
}) => {
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
        setIsNewNoteOpen={setIsNewNoteOpen}
      />
    </>
  );
};

export default GroupChatFooter;
