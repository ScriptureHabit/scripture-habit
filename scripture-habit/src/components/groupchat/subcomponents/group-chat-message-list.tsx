import { FC, Fragment } from 'react';
import MessageItem from './message-item';
import { Message } from '../../../types/chat';
import { parseTimestampToDate } from '../../../utils/time-utils';
import { useChatData, useChatUIActions } from '../hooks/use-chat-context';

interface GroupChatMessageListProps {
  messages: Message[];
}

const GroupChatMessageList: FC<GroupChatMessageListProps> = ({
  messages
}) => {
  const { language, userReadCount } = useChatData();
  const { t } = useChatUIActions();

  return (
    <>
      {messages.map((msg, index) => {
        const prevDate = index > 0 ? parseTimestampToDate(messages[index - 1].createdAt) : null;
        const currDate = parseTimestampToDate(msg.createdAt);
        const showDateDivider = index === 0 || prevDate?.toDateString() !== currDate.toDateString();
        const messageDate = currDate;

        return (
          <Fragment key={msg.id}>
            {showDateDivider && (
              <div className="date-separator">
                <span>{messageDate.toLocaleDateString(language, { month: 'long', day: 'numeric' })}</span>
              </div>
            )}
            <MessageItem msg={msg} />
            {userReadCount !== null && index === Math.max(0, userReadCount - 1) && index < messages.length - 1 && msg.senderId !== 'system' && (
              <div className="unread-divider"><span>{t('groupChat.newMessages')}</span></div>
            )}
          </Fragment>
        );
      })}
    </>
  );
};

export default GroupChatMessageList;

