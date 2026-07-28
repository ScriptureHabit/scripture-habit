import { FC } from 'react';
import ReactMarkdown from 'react-markdown';
import './system-message.css';
import { Message } from '../../../types/chat';
import { DEFAULT_KICK_THRESHOLD } from '../../../constants';

interface SystemMessageProps {
  msg: Message;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  kickThreshold?: number;
}

const SystemMessage: FC<SystemMessageProps> = ({ msg, t, kickThreshold = DEFAULT_KICK_THRESHOLD }) => {
  const text = msg.text || '';

  const getSystemText = () => {
    // New format: has messageType and messageData
    if (msg.messageType === 'streakAnnouncement' && msg.messageData) {
      const data = msg.messageData;
      if (data.isCumulative) {
        return t('groupChat.streakAnnouncement', {
          nickname: String(data.nickname || '').trim(),
          streak: data.streakCount || data.streak || 0
        });
      }
      return text;
    }

    if (msg.messageType === 'notePostedAnnouncement' && msg.messageData) {
      const data = msg.messageData;
      return t('groupChat.notePostedAnnouncement', {
        nickname: String(data.nickname || '').trim()
      });
    }

    if (msg.messageType === 'userJoined' && msg.messageData) {
      const data = msg.messageData;
      return t('groupChat.userJoined', {
        nickname: String(data.nickname || '').trim()
      });
    }

    if (msg.messageType === 'userLeft' && msg.messageData) {
      const data = msg.messageData;
      return t('groupChat.userLeft', {
        nickname: String(data.nickname || '').trim()
      });
    }



    if (msg.messageType === 'unityAnnouncement') {
      return t('groupChat.unityAnnouncement');
    }

    // For legacy streak messages, we render their original stored text directly
    // to preserve historical accuracy (e.g. showing "6日連続" for past events rather than mismapping to "累計6日目")

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

    for (const pattern of joinPatterns) {
      const match = text.match(pattern);
      if (match) {
        return t('groupChat.userJoined', { nickname: match[1].trim() });
      }
    }

    const leavePatterns = [
      /\*\*(.+?)\*\* left the group/,        // English
      /\*\*(.+?)\*\*さんがグループを退(会|室)/,    // Japanese
      /\*\*(.+?)\*\* saiu do grupo/,         // Portuguese
      /\*\*(.+?)\*\* (離開了群組|离开了小组)/,    // Chinese
      /\*\*(.+?)\*\* (salió del|ha dejado el) grupo/,       // Spanish
      /\*\*(.+?)\*\* đã rời (khỏi\s+)?nhóm/,           // Vietnamese
      /\*\*(.+?)\*\* (ได้)?ออกจากกลุ่มแล้ว/,          // Thai
      /\*\*(.+?)\*\*님이 그룹을 (나갔|떠났)/,         // Korean
      /\*\*(.+?)\*\* (ay\s+)?umalis sa grupo/,        // Tagalog
      /\*\*(.+?)\*\* (ame|ali)ondoka kwenye kikundi/, // Swahili
    ];

    for (const pattern of leavePatterns) {
      const match = text.match(pattern);
      if (match) {
        return t('groupChat.userLeft', { nickname: match[1].trim() });
      }
    }

    const inactivityPattern = /👋 \*\*(\d+) member\(s\)\*\* were removed due to inactivity(?:\s*\((\d+)\+ days\))?\./;
    const inactivityMatch = text.match(inactivityPattern);
    if (inactivityMatch) {
      return t('groupChat.inactivityRemoval', { 
        count: inactivityMatch[1], 
        days: inactivityMatch[2] || kickThreshold 
      });
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
