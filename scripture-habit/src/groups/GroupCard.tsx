import { useState, useEffect, useCallback, useMemo } from 'react';
import { getFirestore, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { app, auth } from '../firebase';
import './GroupCard.css';
import { useLanguage } from '../Context/LanguageContext';
import { toast } from 'react-toastify';

// --- Types ---

interface Group {
  id: string;
  name: string;
  description?: string;
  members?: string[];
  lastMessageAt?: any;
  messageCount?: number;
  createdAt?: any;
  translations?: Record<string, { name: string }>;
}

interface ActivityStatus {
  label: string;
  color: string;
  bg: string;
}

interface Props {
  group: Group;
  currentUser: { uid: string } | null;
  onJoin?: (groupId: string, groupData?: Group) => Promise<void> | void;
  onOpen?: (group: Group) => void;
}

// --- Helpers ---

const parseFirebaseDate = (date: any): Date | null => {
  if (!date) return null;
  if (date.toDate) return date.toDate();
  if (date.seconds) return new Date(date.seconds * 1000);
  if (date._seconds) return new Date(date._seconds * 1000);
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
};

const getStatus = (group: Group, t: any): ActivityStatus => {
  const now = new Date();
  const ONE_HOUR = 3600000;
  
  const lastActive = parseFirebaseDate(group.lastMessageAt);
  if (lastActive) {
    const diffHours = (now.getTime() - lastActive.getTime()) / ONE_HOUR;
    if (diffHours <= 24) {
      return { label: t('groupCard.statusActive'), color: '#ff5722', bg: '#fbe9e7' };
    }
    return { label: t('groupCard.statusRelaxed'), color: '#795548', bg: '#efebe9' };
  }

  const created = parseFirebaseDate(group.createdAt);
  if (created) {
    const createdHours = (now.getTime() - created.getTime()) / ONE_HOUR;
    if (createdHours <= 48) {
      return { label: t('groupCard.statusNew'), color: '#4caf50', bg: '#e8f5e9' };
    }
  }

  if (!lastActive && !created) {
     return { label: t('groupCard.statusNew'), color: '#4caf50', bg: '#e8f5e9' };
  }

  return { label: t('groupCard.statusRelaxed'), color: '#795548', bg: '#efebe9' };
};

// --- Component ---

export default function GroupCard({ group, currentUser, onJoin, onOpen }: Props) {
  const { t, language } = useLanguage();
  const [joining, setJoining] = useState(false);
  const [translatedName, setTranslatedName] = useState('');
  const [translating, setTranslating] = useState(false);

  const db = useMemo(() => getFirestore(app), []);
  const isMember = useMemo(() => 
    !!(group.members && currentUser && group.members.includes(currentUser.uid)),
    [group.members, currentUser]
  );

  const activity = useMemo(() => getStatus(group, t), [group, t]);

  useEffect(() => {
    let active = true;
    
    const autoTranslate = async () => {
      if (!group.name || !language) return;

      const manualName = group.translations?.[language]?.name;
      if (manualName) {
        setTranslatedName(manualName);
        return;
      }

      const cacheKey = `trans_name_${group.id}_${language}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setTranslatedName(cached);
        return;
      }

      setTranslating(true);
      try {
        const idToken = await auth?.currentUser?.getIdToken();
        const API_BASE = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app');

        const res = await fetch(`${API_BASE}/api/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({
            text: group.name,
            targetLanguage: language,
          }),
        });

        if (res.ok && active) {
          const data = await res.json();
          if (data.translatedText && data.translatedText !== group.name) {
            setTranslatedName(data.translatedText);
            sessionStorage.setItem(cacheKey, data.translatedText);
          }
        }
      } catch (err) {
        console.error('Translation failed:', err);
      } finally {
        if (active) setTranslating(false);
      }
    };

    autoTranslate();
    return () => { active = false; };
  }, [group.id, group.name, language, group.translations]);

  const handleAction = useCallback(async () => {
    if (isMember) {
      onOpen?.(group);
      return;
    }

    if (!currentUser) {
      toast.info(t('groupCard.signInFirst'));
      return;
    }

    setJoining(true);
    try {
      if (onJoin) {
        await onJoin(group.id, group);
        return;
      }

      const backend = import.meta.env.VITE_BACKEND_URL || '/api';
      const idToken = await auth?.currentUser?.getIdToken();
      
      if (idToken) {
        const res = await fetch(`${backend}/join-group`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ groupId: group.id }),
        });
        
        if (!res.ok) {
           const err = await res.json().catch(() => ({}));
           throw new Error(err?.error || 'Server join failed');
        }
      } else {
        const groupRef = doc(db, 'groups', group.id);
        await updateDoc(groupRef, { members: arrayUnion(currentUser.uid) });
      }
    } catch (err: any) {
      console.error('Join failed:', err);
      toast.error(t('groupCard.unableToJoin'));
    } finally {
      setJoining(false);
    }
  }, [isMember, currentUser, group, onJoin, onOpen, t, db]);

  return (
    <div className="group-card" role="group" aria-label={`Group ${group.name}`}>
      <div className="group-card-meta">
        <div
          className="activity-badge"
          style={{
            backgroundColor: activity.bg,
            color: activity.color
          }}
        >
          {activity.label}
        </div>
        <div className="member-badge">
          {group.members?.length ?? 0} {t('groupCard.members')}
        </div>
      </div>

      <div className="group-card-title-row">
        <h4 className="group-title">
          {translating ? (
            <span className="translating-placeholder">...</span>
          ) : (
            translatedName || group.name
          )}
        </h4>
      </div>

      <div className="group-actions">
        <button
          className="join-btn"
          onClick={handleAction}
          disabled={joining}
        >
          {joining ? t('groupCard.joining') : t('groupCard.details')}
        </button>
      </div>
    </div>
  );
}
