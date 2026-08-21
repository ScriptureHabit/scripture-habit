import { Fragment } from 'react';
import MessageItem from './message-item';
import { Message } from '../../../types/chat';
import { parseTimestampToDate } from '../../../utils/time-utils';
import { useChatData, useChatUIActions } from '../hooks/use-chat-context';

interface GroupChatMessageListProps {
  messages: Message[];
}

const GroupChatMessageList = ({
  messages
}: GroupChatMessageListProps) => {
  const { language, unreadAnchorMessageId } = useChatData();
  const { t } = useChatUIActions();

  return (
    <>
      {messages.map((msg, index) => {
        const prevDate = index > 0 ? parseTimestampToDate(messages[index - 1].createdAt) : null;
        const currDate = parseTimestampToDate(msg.createdAt);
        const showDateDivider = index === 0 || prevDate?.toDateString() !== currDate.toDateString();
        const messageDate = currDate;

        return (
          <Fragment key={msg.optimisticId || msg.id}>
            {showDateDivider && (
              <div className="date-separator">
                <span>{messageDate.toLocaleDateString(language, { month: 'long', day: 'numeric' })}</span>
              </div>
            )}
            <MessageItem msg={msg} />
            {unreadAnchorMessageId !== null && msg.id === unreadAnchorMessageId && msg.senderId !== 'system' && (
              <div className="unread-divider"><span>{t('groupChat.newMessages')}</span></div>
            )}
          </Fragment>
        );
      })}
    </>
  );
};

export default GroupChatMessageList;

