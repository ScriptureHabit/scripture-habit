import { FC } from 'react';
import { UilTrashAlt, UilPen, UilCommentAlt } from '@iconscout/react-unicons';
import { 
  useChatData, 
  useChatMessageActions, 
  useChatUIActions 
} from '../hooks/useChatContext';
import { useChatStore } from '../../../store/useChatStore';

const GroupChatContextMenu: FC = () => {
    const { userData } = useChatData();
    const { 
        handleReply, handleToggleReaction, handleEditMessage, 
        handleDeleteMessageClick, handleReportClick
    } = useChatMessageActions();
    const { t, closeContextMenu, contextMenuRef } = useChatUIActions();
    
    // Zustand UI State
    const { contextMenu } = useChatStore();

    if (!contextMenu.show || !contextMenu.message) return null;

    const message = contextMenu.message;
    const isSender = message.senderId === userData?.uid;
    const hasLiked = message.reactions?.['👍']?.includes(userData?.uid || '');

    return (
        <>
        <div className="context-menu-overlay" onClick={closeContextMenu} />
        <div className="message-context-menu" ref={contextMenuRef}>
            <button onClick={() => { handleReply(message); closeContextMenu(); }}>
            <div className="context-menu-icon-wrapper"><UilCommentAlt size="18" /></div>
            <span>{t('groupChat.reply')}</span>
            </button>
            {!isSender && (
            <button onClick={() => { handleToggleReaction(message); closeContextMenu(); }}>
                <div className="context-menu-icon-wrapper large">👍</div>
                <span>{hasLiked ? t('groupChat.unlike') : t('groupChat.like')}</span>
            </button>
            )}
            {isSender && (
            <button onClick={() => { handleEditMessage(message); closeContextMenu(); }}>
                <div className="context-menu-icon-wrapper"><UilPen size="18" /></div>
                <span>{t('groupChat.editMessage')}</span>
            </button>
            )}
            {isSender && (
            <button className="delete-option" onClick={() => { handleDeleteMessageClick(message); closeContextMenu(); }}>
                <div className="context-menu-icon-wrapper"><UilTrashAlt size="18" /></div>
                <span>{t('groupChat.deleteMessage')}</span>
            </button>
            )}
            {!isSender && (
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

