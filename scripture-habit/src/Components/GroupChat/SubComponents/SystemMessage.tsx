import { FC } from 'react';
import ReactMarkdown from 'react-markdown';
import './SystemMessage.css';
import { Message } from '../../../types/chat';

interface SystemMessageProps {
  msg: Message;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  kickThreshold?: number;
}

const SystemMessage: FC<SystemMessageProps> = ({ msg, t, kickThreshold = 3 }) => {
  const text = msg.text || '';

  const getSystemText = () => {
    // New format: has messageType and messageData
    if (msg.messageType === 'streakAnnouncement' && msg.messageData) {
      const data = msg.messageData;
      return t('groupChat.streakAnnouncement', {
        nickname: String(data.nickname || ''),
        streak: data.streakCount || data.streak || 0
      });
    }

    if (msg.messageType === 'userJoined' && msg.messageData) {
      const data = msg.messageData;
      return t('groupChat.userJoined', {
        nickname: String(data.nickname || '')
      });
    }

    if (msg.messageType === 'userLeft' && msg.messageData) {
      const data = msg.messageData;
      return t('groupChat.userLeft', {
        nickname: String(data.nickname || '')
      });
    }



    if (msg.messageType === 'unityAnnouncement') {
      return t('groupChat.unityAnnouncement');
    }

    if (msg.messageType === 'weeklyRecap') {
      return text;
    }

    // Legacy format: parse from text
    const streakPatterns = [
      /\*\*(.+?) reached a (\d+) day streak/,           // English
      /\*\*(.+?)さんが(\d+)日連続/,                      // Japanese
      /\*\*(.+?) alcançou uma ofensiva de (\d+) dias/, // Portuguese
      /\*\*(.+?) 達成了 (\d+) 天連續紀錄/,              // Chinese
      /\*\*¡?(.+?) alcanzó una racha de (\d+) días/,     // Spanish
      /\*\*(.+?) đã đạt chuỗi (\d+) ngày/,             // Vietnamese
      /\*\*(.+?) ทำต่อเนื่องได้ (\d+) วันแล้ว/,             // Thai
      /\*\*(.+?)님이 (\d+)일 연속 기록/,                 // Korean
      /\*\*Naabot ni (.+?) ang (\d+) araw/,             // Tagalog
      /\*\*(.+?) amefikisha mfululizo wa siku (\d+)/,   // Swahili
    ];

    for (const pattern of streakPatterns) {
      const match = text.match(pattern);
      if (match) {
        return t('groupChat.streakAnnouncement', { nickname: match[1], streak: match[2] });
      }
    }

    const joinPatterns = [
      /\*\*(.+?)\*\* joined the group/,      // English
      /\*\*(.+?)\*\*さんがグループに参加/,    // Japanese
      /\*\*(.+?)\*\* entrou no grupo/,       // Portuguese
      /\*\*(.+?)\*\* 加入了群組/,            // Chinese
      /\*\*(.+?)\*\* se unió al grupo/,      // Spanish
      /\*\*(.+?)\*\* đã tham gia nhóm/,      // Vietnamese
      /\*\*(.+?)\*\* เข้าร่วมグループแล้ว/,         // Thai
      /\*\*(.+?)\*\*님이 그룹에 참여/,        // Korean
      /\*\*(.+?)\*\* sumali sa grupo/,       // Tagalog
      /\*\*(.+?)\*\* amejiunga na kikundi/,  // Swahili
    ];

    for (const pattern of joinPatterns) {
      const match = text.match(pattern);
      if (match) {
        return t('groupChat.userJoined', { nickname: match[1] });
      }
    }

    const leavePatterns = [
      /\*\*(.+?)\*\* left the group/,        // English
      /\*\*(.+?)\*\*さんがグループを退会/,    // Japanese
      /\*\*(.+?)\*\* saiu do grupo/,         // Portuguese
      /\*\*(.+?)\*\* 離開了群組/,            // Chinese
      /\*\*(.+?)\*\* salió del grupo/,       // Spanish
      /\*\*(.+?)\*\* đã rời nhóm/,           // Vietnamese
      /\*\*(.+?)\*\* ออกจากกลุ่มแล้ว/,          // Thai
      /\*\*(.+?)\*\*님이 그룹을 나갔/,         // Korean
      /\*\*(.+?)\*\* umalis sa grupo/,        // Tagalog
      /\*\*(.+?)\*\* ameondoka kwenye kikundi/, // Swahili
    ];

    for (const pattern of leavePatterns) {
      const match = text.match(pattern);
      if (match) {
        return t('groupChat.userLeft', { nickname: match[1] });
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
    <div id={`message-${msg.id}`} className={`message system-message ${msg.messageType === 'streakAnnouncement' ? 'streak-announcement' : ''} ${msg.messageType === 'unityAnnouncement' ? 'unity-announcement' : ''}`}>
      <div className="message-content">
        {msg.messageType === 'unityAnnouncement' && (
          <div className="unity-announcement-body">
            <img src="/images/mascot.png" alt="Mascot" className="mascot-avatar-celestial" />
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
