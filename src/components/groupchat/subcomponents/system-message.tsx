import LazyMarkdown from '../../common/lazy-markdown';
import './system-message.css';
import { Message } from '../../../types/chat';
import { DEFAULT_KICK_THRESHOLD } from '../../../constants';
import { useChatData } from '../hooks/use-chat-context';
import { useTranslatedNickname } from '../hooks/view/use-translated-nickname';

interface SystemMessageProps {
  msg: Message;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  kickThreshold?: number;
}

const getSystemMessageNicknameInfo = (msg: Message): { rawNickname: string; userId?: string } => {
  if (msg.messageData) {
    const data = msg.messageData;
    const rawNickname = String(data.nickname || '').trim();
    const userId = data.userId ? String(data.userId) : undefined;
    return { rawNickname, userId };
  }

  // Fallback for legacy text messages: extract nickname from **bold**
  const match = (msg.text || '').match(/\*\*(.+?)\*\*/);
  return { rawNickname: match ? match[1].trim() : '' };
};

const SystemMessage = ({ msg, t, kickThreshold = DEFAULT_KICK_THRESHOLD }: SystemMessageProps) => {
  const { language } = useChatData();
  const text = msg.text || '';

  const { rawNickname, userId } = getSystemMessageNicknameInfo(msg);
  const displayNickname = useTranslatedNickname(userId, rawNickname, language);

  const getSystemText = () => {
    // 1. Structured modern messages (messageType + messageData)
    if (msg.messageType === 'streakAnnouncement' && msg.messageData) {
      const data = msg.messageData;
      if (data.isCumulative) {
        return t('groupChat.streakAnnouncement', {
          nickname: displayNickname || String(data.nickname || '').trim(),
          streak: data.streakCount || data.streak || 0
        });
      }
      return text;
    }

    if (msg.messageType === 'notePostedAnnouncement' && msg.messageData) {
      return t('groupChat.notePostedAnnouncement', {
        nickname: displayNickname || String(msg.messageData.nickname || '').trim()
      });
    }

    if (msg.messageType === 'aiNotePostedAnnouncement' && msg.messageData) {
      return t('groupChat.aiNotePostedAnnouncement', {
        nickname: displayNickname || String(msg.messageData.nickname || '').trim()
      });
    }

    if (msg.messageType === 'userJoined' && msg.messageData) {
      return t('groupChat.userJoined', {
        nickname: displayNickname || String(msg.messageData.nickname || '').trim()
      });
    }

    if (msg.messageType === 'userLeft' && msg.messageData) {
      return t('groupChat.userLeft', {
        nickname: displayNickname || String(msg.messageData.nickname || '').trim()
      });
    }

    if (msg.messageType === 'userKicked' && msg.messageData) {
      return t('groupChat.userKicked', {
        nickname: displayNickname || String(msg.messageData.nickname || '').trim()
      });
    }

    if (msg.messageType === 'inactivityRemoval' && msg.messageData) {
      return t('groupChat.inactivityRemoval', {
        count: Number(msg.messageData.count || 1),
        days: kickThreshold
      });
    }

    if (msg.messageType === 'unityAnnouncement') {
      return t('groupChat.unityAnnouncement');
    }

    if (msg.messageType === 'familyThemeCompleted') {
      const themeId = msg.messageData?.themeId;
      const themeName = themeId ? t(`familyTheme.themes.${themeId}`) : String(msg.messageData?.themeName || '');
      if (msg.messageData?.userId) {
        const nickname = displayNickname || String(msg.messageData?.nickname || '');
        return t('familyTheme.chatMessageOther', { nickname, theme: themeName });
      }
      return t('familyTheme.chatMessageFamily', { theme: themeName });
    }

    // 2. Legacy fallback for old unstructured messages (display stored text directly)
    return text;
  };

  return (
    <div id={`message-${msg.id}`} className={`message system-message ${msg.messageType === 'streakAnnouncement' ? 'streak-announcement' : ''} ${msg.messageType === 'notePostedAnnouncement' || msg.messageType === 'aiNotePostedAnnouncement' ? 'note-posted-announcement' : ''} ${msg.messageType === 'unityAnnouncement' ? 'unity-announcement' : ''} ${msg.messageType === 'familyThemeCompleted' ? 'family-theme-announcement' : ''}`}>
      <div className="message-content">
        {msg.messageType === 'unityAnnouncement' && (
          <div className="unity-announcement-body">
            <img src="/images/mascot.webp" alt="mascot" className="mascot-avatar-celestial" />
          </div>
        )}
        <LazyMarkdown>
          {getSystemText()}
        </LazyMarkdown>
      </div>
    </div>
  );
};

export default SystemMessage;
