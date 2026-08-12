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

const joinPatterns = [
  /\*\*(.+?)\*\* joined the group/,      // English
  /\*\*(.+?)\*\*さんがグループに参加/,    // Japanese
  /\*\*(.+?)\*\* entrou no grupo/,       // Portuguese
  /\*\*(.+?)\*\* 加入了群組/,            // Chinese
  /\*\*(.+?)\*\* se unió al grupo/,      // Spanish
  /\*\*(.+?)\*\* đã tham gia nhóm/,      // Vietnamese
  /\*\*(.+?)\*\* เข้าร่วมกลุ่มแล้ว/,         // Thai
  /\*\*(.+?)\*\*님이 그룹에 참여/,        // Korean
  /\*\*(.+?)\*\* sumali sa grupo/,       // Tagalog
  /\*\*(.+?)\*\* amejiunga na kikundi/,  // Swahili
];

const leavePatterns = [
  /\*\*(.+?)\*\* left the group/,        // English
  /\*\*(.+?)\*\*さんがグループを退(会|室)/,    // Japanese
  /\*\*(.+?)\*\* saiu do grupo/,         // Portuguese
  /\*\*(.+?)\*\* (離開了群組|离开了小组)/,    // Chinese
  /\*\*(.+?)\*\* (salió del|ha dejado el) grupo/,       // Spanish
  /\*\*(.+?)\*\* đã rời (khỏi\s+)?nhóm/,           // Vietnamese
  /\*\*(.+?)\*\* (ได้)?ออกจากกลุ่มแล้ว/,          // Thai
  /\*\*(.+?)\*\*님이 그룹を (나갔|떠났)/,         // Korean
  /\*\*(.+?)\*\* (ay\s+)?umalis sa grupo/,        // Tagalog
  /\*\*(.+?)\*\* (ame|ali)ondoka kwenye kikundi/, // Swahili
];

const getSystemMessageNicknameInfo = (msg: Message): { rawNickname: string; userId?: string } => {
  if (msg.messageData) {
    const data = msg.messageData;
    const rawNickname = String(data.nickname || '').trim();
    const userId = data.userId ? String(data.userId) : undefined;
    return { rawNickname, userId };
  }

  const text = msg.text || '';
  for (const pattern of joinPatterns) {
    const match = text.match(pattern);
    if (match) {
      return { rawNickname: match[1].trim() };
    }
  }

  for (const pattern of leavePatterns) {
    const match = text.match(pattern);
    if (match) {
      return { rawNickname: match[1].trim() };
    }
  }

  return { rawNickname: '' };
};

const SystemMessage = ({ msg, t, kickThreshold = DEFAULT_KICK_THRESHOLD }: SystemMessageProps) => {
  const { language } = useChatData();
  const text = msg.text || '';

  const { rawNickname, userId } = getSystemMessageNicknameInfo(msg);
  const displayNickname = useTranslatedNickname(userId, rawNickname, language);

  const getSystemText = () => {
    // New format: has messageType and messageData
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

    // For legacy streak messages, we render their original stored text directly
    // to preserve historical accuracy (e.g. showing "6日連続" for past events rather than mismapping to "累計6日目")

    for (const pattern of joinPatterns) {
      const match = text.match(pattern);
      if (match) {
        return t('groupChat.userJoined', { nickname: displayNickname || match[1].trim() });
      }
    }

    for (const pattern of leavePatterns) {
      const match = text.match(pattern);
      if (match) {
        return t('groupChat.userLeft', { nickname: displayNickname || match[1].trim() });
      }
    }

    const inactivityPatterns = [
      /👋 \*\*(\d+) member\(s\)\*\* were removed due to inactivity(?:\s*\((\d+)\+ days\))?\./,
      /👋 \*\*(\d+)名.*?\*\*.*?(?:自動的|退出|削除)/,
      /👋 \*\*(\d+)\s*(?:名|位|名成員|thành viên|miyembro|สมาชิก|Wanachama|membro\(s\))\*\*/
    ];

    for (const pattern of inactivityPatterns) {
      const inactivityMatch = text.match(pattern);
      if (inactivityMatch) {
        return t('groupChat.inactivityRemoval', {
          count: inactivityMatch[1],
          days: inactivityMatch[2] || kickThreshold
        });
      }
    }

    return text;
  };

  return (
    <div id={`message-${msg.id}`} className={`message system-message ${msg.messageType === 'streakAnnouncement' ? 'streak-announcement' : ''} ${msg.messageType === 'notePostedAnnouncement' ? 'note-posted-announcement' : ''} ${msg.messageType === 'unityAnnouncement' ? 'unity-announcement' : ''}`}>
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

