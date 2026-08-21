import { memo } from 'react';
import NoteDisplay from '../../notedisplay/note-display';
import { Message } from '../../../types/chat';
import { ReactionPreview } from '../../../../types/firestore';
import SystemMessage from './system-message';
import GospelLink from './gospel-link';
import {
  useChatData,
  useChatMessageActions,
  useChatGroupActions,
  useChatUIActions
} from '../hooks/use-chat-context';
import { useAutoTranslateMessage } from '../hooks/view/use-auto-translate-message';
import { useTranslatedNickname } from '../hooks/view/use-translated-nickname';
import { useMessageReadCount } from '../hooks/view/use-message-read-count';
import { parseTimestampToMillis } from '../../../utils/time-utils';
import './message-item.css';

interface MessageItemProps {
  msg: Message;
}

const MessageItem = memo(({
  msg
}: MessageItemProps) => {
  const { userData, groupData, language, membersMap } = useChatData();
  const {
    handleToggleReaction, handleTranslateMessage, handleLazyTranslate,
    handleReply, handleMessageClick, handleEditMessage, handleDeleteMessageClick,
    handleReportClick, handleRetryMessage, translatingIds, translatedTexts
  } = useChatMessageActions();
  const { handleUserProfileClick, handleShowReactions } = useChatGroupActions();
  const { t } = useChatUIActions();

  const userUid = userData?.uid || '';
  const isMe = msg.senderId === userUid;

  // Extracted Custom Hooks for View Side-Effects & Calculations
  const observerRef = useAutoTranslateMessage(msg, isMe, handleLazyTranslate);
  const readCount = useMessageReadCount(msg, isMe, groupData, membersMap);

  const member = msg.senderId ? membersMap?.[msg.senderId] : null;
  const originalNickname = member?.nickname || msg.senderNickname || '';
  const displayNickname = useTranslatedNickname(msg.senderId, originalNickname, language);

  if (msg.senderId === 'system' || msg.isSystemMessage) {
    const kickThreshold = userData && 'kickThreshold' in userData ? userData.kickThreshold : undefined;
    return <SystemMessage msg={msg} t={t} kickThreshold={kickThreshold as number | undefined} />;
  }

  const isAiBot = msg.senderId === 'ai-partner-bot';
  const isKeyText = msg.text?.startsWith('groupChat.');

  const rawText = isKeyText ? t(msg.text) : msg.text;
  const translatedText = (isAiBot || isKeyText) ? undefined : (translatedTexts[msg.id] || msg.translations?.[language]);
  const isTranslating = translatingIds.has(msg.id);

  return (
    <div
      ref={observerRef}
      id={`message-${msg.optimisticId || msg.id}`}
      className={`message-wrapper ${isMe ? 'sent' : 'received'}`}
      data-testid={isMe ? 'chat-message-item' : 'chat-message-item-received'}
    >
      {!isMe && (
        <div
          className="message-avatar"
          onClick={(e) => { e.stopPropagation(); if (msg.senderId) handleUserProfileClick(msg.senderId); }}
        >
          {isAiBot ? (
            <div className="ai-bot-avatar">🤖</div>
          ) : (msg.senderPhotoURL || (msg.senderId && membersMap?.[msg.senderId]?.photoURL)) ? (
            <img
              src={(msg.senderPhotoURL || (msg.senderId ? membersMap?.[msg.senderId]?.photoURL : undefined)) || undefined}
              alt=""
              className="profile-avatar-img"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/mascot.webp';
              }}
            />
          ) : (
            displayNickname ? displayNickname.substring(0, 1).toUpperCase() : '?'
          )}
        </div>
      )}
      <div
        className={`message ${isMe ? 'sent' : 'received'} ${msg.isOptimistic ? 'is-optimistic' : ''} ${msg.isFailed ? 'is-failed' : ''}`}
        onClick={(e) => {
          if (msg.isOptimistic || msg.isFailed) return;
          if ((e.target as HTMLElement).tagName !== 'A') {
            e.stopPropagation();
            handleMessageClick(msg, e);
          }
        }}
      >
        <div className={`message-hover-actions ${isMe ? 'sent' : 'received'}`}>
          {isMe ? (
            <>
              {!msg.isFailed && !msg.isOptimistic && (
                <button className="hover-action-btn" onClick={(e) => { e.stopPropagation(); handleEditMessage(msg); }} title={t('groupChat.editMessage')}>✏️</button>
              )}
              <button className="hover-action-btn delete" onClick={(e) => { e.stopPropagation(); handleDeleteMessageClick(msg); }} title={t('groupChat.deleteMessage')}>🗑️</button>
              {!msg.isFailed && !msg.isOptimistic && (
                <button className="hover-action-btn" onClick={(e) => { e.stopPropagation(); handleReply(msg); }} title={t('groupChat.reply')}>↩️</button>
              )}
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
            {displayNickname}{msg.isEdited && <span className="edited-indicator"> ({t('groupChat.messageEdited')})</span>}
          </span>
        )}
        <div className={`message-bubble-row ${isMe ? 'sent' : 'received'}`}>
          {isMe && (
            <div className="message-status-column">
              {readCount > 0 && !msg.isOptimistic && !msg.isFailed && (
                <span className="read-status">{t('groupChat.readStatus', { count: readCount })}</span>
              )}
              {msg.isFailed ? (
                <button
                  className="message-retry-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetryMessage(msg);
                  }}
                  title={t('groupChat.retrySend')}
                  type="button"
                >
                  <span className="retry-icon">⚠️</span>
                  <span className="retry-text">{t('groupChat.retry')}</span>
                </button>
              ) : msg.isOptimistic ? (
                <span className="message-sending-indicator" title={t('groupChat.sending')}>
                  <span className="sending-spinner" />
                </span>
              ) : (
                <span className="message-time">
                  {msg.createdAt ? new Date(parseTimestampToMillis(msg.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              )}
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
                    text={rawText}
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

