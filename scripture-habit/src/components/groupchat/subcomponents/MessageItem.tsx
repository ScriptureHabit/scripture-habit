import { FC, useEffect, useRef, memo, useMemo } from 'react';
import NoteDisplay from '../../notedisplay/NoteDisplay';
import { Message } from '../../../types/chat';
import { ReactionPreview } from '../../../../types/firestore';
import SystemMessage from './SystemMessage';
import GospelLink from './GospelLink';
import { parseTimestampToMillis } from '../../../utils/timeUtils';
import { 
  useChatData, 
  useChatMessageActions, 
  useChatGroupActions, 
  useChatUIActions 
} from '../hooks/useChatContext';
import './MessageItem.css';

interface MessageItemProps {
  msg: Message;
}

const MessageItem: FC<MessageItemProps> = memo(({
  msg
}) => {
  const { userData, groupData, language, membersMap } = useChatData();
  const { 
    handleToggleReaction, handleTranslateMessage, handleLazyTranslate, 
    handleReply, handleMessageClick, handleEditMessage, handleDeleteMessageClick,
    handleReportClick, translatingIds, translatedTexts 
  } = useChatMessageActions();
  const { handleUserProfileClick, handleShowReactions } = useChatGroupActions();
  const { t } = useChatUIActions();

  const userUid = userData?.uid || '';
  const isMe = msg.senderId === userUid;

  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!observerRef.current || isMe || msg.senderId === 'system' || msg.isSystemMessage) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        handleLazyTranslate(msg);
        observer.disconnect();
      }
    }, { threshold: 0.1 });

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [msg.id, isMe, msg.senderId, msg.isSystemMessage, handleLazyTranslate, msg]);

  const readCount = useMemo(() => {
    if (!isMe || !msg.createdAt || !groupData?.members) return 0;
    const msgTime = parseTimestampToMillis(msg.createdAt);
    const legacyLastReadAt = groupData.memberLastReadAt;
    let count = 0;

    for (const uid of groupData.members) {
      if (uid === msg.senderId) continue;
      
      const memberStatus = membersMap?.[uid];
      const readAt = memberStatus?.lastReadAt || legacyLastReadAt?.[uid];
      
      const didReadByTime = readAt && parseTimestampToMillis(readAt) >= msgTime;
      const didReact = msg.reactions && Object.values(msg.reactions).some(uids => uids.includes(uid));

      if (didReadByTime || didReact) {
        count++;
      }
    }
    return count;
  }, [isMe, msg.createdAt, msg.senderId, groupData?.members, groupData?.memberLastReadAt, membersMap, msg.reactions]);

  if (msg.senderId === 'system' || msg.isSystemMessage) {
    const kickThreshold = userData && 'kickThreshold' in userData ? userData.kickThreshold : undefined;
    return <SystemMessage msg={msg} t={t} kickThreshold={kickThreshold as number | undefined} />;
  }

  const translatedText = translatedTexts[msg.id] || msg.translations?.[language];
  const isTranslating = translatingIds.has(msg.id);

  return (
    <div 
      ref={observerRef}
      id={`message-${msg.id}`} 
      className={`message-wrapper ${isMe ? 'sent' : 'received'}`}
    >
      {!isMe && (
        <div
          className="message-avatar"
          onClick={(e) => { e.stopPropagation(); if (msg.senderId) handleUserProfileClick(msg.senderId); }}
        >
          {(msg.senderPhotoURL || (msg.senderId && membersMap?.[msg.senderId]?.photoURL)) ? (
            <img
              src={msg.senderPhotoURL || (msg.senderId ? membersMap?.[msg.senderId]?.photoURL : undefined)}
              alt=""
              className="profile-avatar-img"
            />
          ) : (
            msg.senderNickname ? msg.senderNickname.substring(0, 1).toUpperCase() : '?'
          )}
        </div>
      )}
      <div
        className={`message ${isMe ? 'sent' : 'received'} ${msg.isOptimistic ? 'is-optimistic' : ''}`}
        onClick={(e) => {
          if (msg.isOptimistic) return;
          if ((e.target as HTMLElement).tagName !== 'A') {
            e.stopPropagation();
            handleMessageClick(msg, e);
          }
        }}
      >
        <div className={`message-hover-actions ${isMe ? 'sent' : 'received'}`}>
          {isMe ? (
            <>
              <button className="hover-action-btn" onClick={(e) => { e.stopPropagation(); handleEditMessage(msg); }} title={t('groupChat.editMessage')}>✏️</button>
              <button className="hover-action-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteMessageClick(msg); }} title={t('groupChat.deleteMessage')}>🗑️</button>
              <button className="hover-action-btn" onClick={(e) => { e.stopPropagation(); handleReply(msg); }} title={t('groupChat.reply')}>↩️</button>
            </>
          ) : (
            <>
              <button className="hover-action-btn" onClick={(e) => { e.stopPropagation(); handleToggleReaction(msg); }} title={msg.reactions?.['👍']?.includes(userUid || '') ? t('groupChat.unlike') : t('groupChat.like')}>👍</button>
              <button className="hover-action-btn" onClick={(e) => { e.stopPropagation(); handleReply(msg); }} title={t('groupChat.reply')}>↩️</button>
              <button className="hover-action-btn report-btn" onClick={(e) => { e.stopPropagation(); handleReportClick(msg); }} title={t('groupChat.report')}>🚩</button>
            </>
          )}
        </div>
        {!isMe && (
          <span
            className="sender-name"
            onClick={(e) => { e.stopPropagation(); if (msg.senderId) handleUserProfileClick(msg.senderId); }}
          >
            {membersMap?.[msg.senderId || '']?.nickname || msg.senderNickname}{msg.isEdited && <span className="edited-indicator"> ({t('groupChat.messageEdited')})</span>}
          </span>
        )}
        <div className={`message-bubble-row ${isMe ? 'sent' : 'received'}`}>
          {isMe && (
            <div className="message-status-column">
              {readCount > 0 && (
                <span className="read-status">{t('groupChat.readStatus', { count: readCount })}</span>
              )}
              <span className="message-time">
                {msg.createdAt ? new Date(parseTimestampToMillis(msg.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </div>
          )}
          <div className="message-bubble-column">
            {msg.replyTo && typeof msg.replyTo === 'object' && 'senderNickname' in msg.replyTo && (
              <div 
                className={`reply-context-label ${isMe ? 'sent' : 'received'}`}
              >
                <span className="reply-context-prefix">{t('groupChat.replyTo')} </span>
                <span className="reply-context-name">{msg.replyTo.senderNickname}</span>
                <span className="reply-context-separator">: </span>
                <span className="reply-context-text">
                  {msg.replyTo.isNote || msg.replyTo.text?.startsWith('📖 **New Study') || msg.replyTo.text?.startsWith('**New Study')
                    ? t('groupChat.studyNote')
                    : msg.replyTo.text
                  }
                </span>
              </div>
            )}
            <div className="message-content">
              {msg.text && (
                <div className="entry-message-content">
                  <NoteDisplay
                    text={msg.text}
                    isSent={isMe}
                    translatedText={translatedText}
                    scripture={msg.scripture}
                    chapter={msg.chapter}
                    isTranslating={isTranslating}
                    onRetranslate={() => handleTranslateMessage(msg, true)}
                  />
                  <GospelLink
                    text={msg.text}
                    scripture={msg.scripture}
                    chapter={msg.chapter}
                    language={language}
                    isSent={isMe}
                    t={t}
                  />
                </div>
              )}
            </div>
          </div>
          {!isMe && (
            <span className="message-time received">
              {msg.createdAt ? new Date(parseTimestampToMillis(msg.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          )}
        </div>
        {msg.reactions && Object.values(msg.reactions).some(uids => uids.length > 0) && (
          <div
            className={`message-reactions ${isMe ? 'sent' : 'received'}`}
            onClick={(e) => {
              e.stopPropagation();
              if (msg.reactions) handleShowReactions(msg.reactions, msg.reactionPreviews);
            }}
          >
            <div className="reaction-previews">
              {(msg.reactionPreviews?.['👍'] || []).map((p: ReactionPreview) => p.photoURL && (
                <img key={p.uid} src={p.photoURL} alt="" className="reaction-preview-avatar" />
              ))}
              {(!(msg.reactionPreviews?.['👍']) && msg.reactions['👍']?.slice(0, 3).map(uid => (
                membersMap?.[uid]?.photoURL && (
                  <img key={uid} src={membersMap[uid].photoURL} alt="" className="reaction-preview-avatar" />
                )
              )))}
            </div>
            <span className="reaction-emoji">👍</span>
            <span className="reaction-count">
              {Object.values(msg.reactions).reduce((acc, uids) => acc + (uids?.length || 0), 0)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageItem;

