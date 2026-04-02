import { FC, RefObject } from 'react';
import { UilTrashAlt, UilPen, UilCommentAlt } from '@iconscout/react-unicons';
import { Message } from '../../../types/chat';
import { UserData } from '../../../types/user';

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  messageId: string | null;
  message?: Message | null;
}

interface GroupChatContextMenuProps {
  contextMenu: ContextMenuState;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  userData: UserData | null;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  handleReply: (msg: Message) => void;
  handleToggleReaction: (msg: Message) => Promise<void>;
  handleEditMessage: (msg: Message) => void;
  handleDeleteMessageClick: (msg: Message) => void;
  handleReportClick: (msg: Message) => void;
  closeContextMenu: () => void;
}

const GroupChatContextMenu: FC<GroupChatContextMenuProps> = ({
  contextMenu,
  contextMenuRef,
  userData,
  t,
  handleReply,
  handleToggleReaction,
  handleEditMessage,
  handleDeleteMessageClick,
  handleReportClick,
  closeContextMenu
}) => {
  if (!contextMenu.show || !contextMenu.message) return null;

  const message = contextMenu.message;
  const isOwner = message.senderId === userData?.uid;
  const hasLiked = message.reactions?.['👍']?.includes(userData?.uid || '');

  return (
    <>
      <div className="context-menu-overlay" onClick={closeContextMenu} />
      <div className="message-context-menu" ref={contextMenuRef}>
        <button onClick={() => { handleReply(message); closeContextMenu(); }}>
          <div className="context-menu-icon-wrapper"><UilCommentAlt size="18" /></div>
          <span>{t('groupChat.reply')}</span>
        </button>
        {!isOwner && (
          <button onClick={() => { handleToggleReaction(message); closeContextMenu(); }}>
            <div className="context-menu-icon-wrapper large">👍</div>
            <span>{hasLiked ? t('groupChat.unlike') : t('groupChat.like')}</span>
          </button>
        )}
        {isOwner && (
          <button onClick={() => { handleEditMessage(message); closeContextMenu(); }}>
            <div className="context-menu-icon-wrapper"><UilPen size="18" /></div>
            <span>{t('groupChat.editMessage')}</span>
          </button>
        )}
        {isOwner && (
          <button className="delete-option" onClick={() => { handleDeleteMessageClick(message); closeContextMenu(); }}>
            <div className="context-menu-icon-wrapper"><UilTrashAlt size="18" /></div>
            <span>{t('groupChat.deleteMessage')}</span>
          </button>
        )}
        {!isOwner && (
          <button onClick={() => { handleReportClick(message); closeContextMenu(); }}>
            <div className="context-menu-icon-wrapper large">🚩</div>
            <span>{t('groupChat.report')}</span>
          </button>
        )}
      </div>
    </>
  );
};

export default GroupChatContextMenu;
