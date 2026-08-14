import ReactMarkdown from 'react-markdown';
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

    // 2. Legacy fallback for old unstructured messages in history
    const legacyBoldMatch = text.match(/\*\*(.+?)\*\*/);
    if (legacyBoldMatch && !msg.messageType) {
      const rawName = legacyBoldMatch[1].trim();
      const nickname = displayNickname || rawName;

      if (/join|参加|entrou|加入|unió|tham gia|เข้า|참여|sumali|amejiunga/i.test(text)) {
        return t('groupChat.userJoined', { nickname });
      }
      if (/left|退|saiu|離開|离开|salió|ha dejado|rời|ออก|떠났|나갔|umalis|ondoka/i.test(text)) {
        return t('groupChat.userLeft', { nickname });
      }
      if (/inactivity|名|thành viên|miyembro|สมาชิก|Wanachama|membro/i.test(text) && /^\d+$/.test(rawName)) {
        return t('groupChat.inactivityRemoval', { count: rawName, days: kickThreshold });
      }
    }

    return text;
  };

  return (
    <div id={`message-${msg.id}`} className={`message system-message ${msg.messageType === 'streakAnnouncement' ? 'streak-announcement' : ''} ${msg.messageType === 'notePostedAnnouncement' || msg.messageType === 'aiNotePostedAnnouncement' ? 'note-posted-announcement' : ''} ${msg.messageType === 'unityAnnouncement' ? 'unity-announcement' : ''}`}>
      <div className="message-content">
        {msg.messageType === 'unityAnnouncement' && (
          <div className="unity-announcement-body">
            <img src="/images/mascot.png" alt="mascot" className="mascot-avatar-celestial" />
          </div>
        )}
        <ReactMarkdown>
          {getSystemText()}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default SystemMessage;
