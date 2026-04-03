import { FC, Fragment, MouseEvent } from 'react';
import MessageItem from './MessageItem';
import { Message, GroupData, MembersMap } from '../../../types/chat';
import { UserData } from '../../../types/user';
import { parseTimestampToDate } from '../../../Utils/timeUtils';

interface GroupChatMessageListProps {
  messages: Message[];
  language: string;
  userData: UserData;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  handleMessageClick: (msg: Message, e: MouseEvent) => void;
  handleEditMessage: (msg: Message) => void;
  handleDeleteMessageClick: (msg: Message) => void;
  handleReply: (msg: Message) => void;
  handleTranslateMessage: (msg: Message, force?: boolean) => Promise<void>;
  handleLazyTranslate: (msg: Message) => void;
  translatingIds: Set<string>;
  handleToggleReaction: (msg: Message) => Promise<void>;
  handleReportClick: (msg: Message) => void;
  handleUserProfileClick: (userId: string | null) => Promise<void>;
  groupData: GroupData | null;
  translatedTexts: Record<string, string>;
  handleShowReactions: (reactions: Record<string, string[]>) => void;
  membersMap: MembersMap;
  userReadCount: number | null;
  isRecapAvailable: boolean;
}

const GroupChatMessageList: FC<GroupChatMessageListProps> = ({
  messages,
  language,
  userData,
  t,
  handleMessageClick,
  handleEditMessage,
  handleDeleteMessageClick,
  handleReply,
  handleTranslateMessage,
  handleLazyTranslate,
  translatingIds,
  handleToggleReaction,
  handleReportClick,
  handleUserProfileClick,
  groupData,
  translatedTexts,
  handleShowReactions,
  membersMap,
  userReadCount,
  isRecapAvailable
}) => {
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
            <MessageItem
              msg={msg}
              userData={userData}
              t={t}
              handleMessageClick={handleMessageClick}
              handleEditMessage={() => handleEditMessage(msg)}
              handleDeleteMessageClick={() => handleDeleteMessageClick(msg)}
              handleReply={() => handleReply(msg)}
              handleTranslateMessage={() => handleTranslateMessage(msg)}
              handleLazyTranslate={() => handleLazyTranslate(msg)}
              isTranslating={translatingIds.has(msg.id)}
              handleToggleReaction={() => handleToggleReaction(msg)}
              handleReportClick={() => handleReportClick(msg)}
              handleUserProfileClick={handleUserProfileClick}
              groupData={groupData}
              translatedText={translatedTexts[msg.id] || msg.translations?.[language]}
              language={language}
              handleShowReactions={handleShowReactions}
              membersMap={membersMap}
              isRecapAvailable={isRecapAvailable}
            />
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
