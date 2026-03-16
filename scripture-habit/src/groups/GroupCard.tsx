import { useState, useEffect } from 'react';

import { getFirestore, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { app, auth } from '../firebase';
import './GroupCard.css';
import { useLanguage } from '../Context/LanguageContext';
import { toast } from 'react-toastify';

type Props = {
  group: { id: string; name: string; description?: string; members?: string[]; lastMessageAt?: unknown; messageCount?: number };
  currentUser: { uid: string } | null;
  onJoin?: (groupId: string, groupData?: unknown) => Promise<void> | void;
  onOpen?: (group: unknown) => void;
};

export default function GroupCard({ group, currentUser, onJoin, onOpen }: Props) {
  const { t } = useLanguage();

  const [joining, setJoining] = useState(false);
  const [translatedName, setTranslatedName] = useState('');
  const [translating, setTranslating] = useState(false);
  const { language } = useLanguage();
  const db = getFirestore(app);


  useEffect(() => {
    const autoTranslate = async () => {
      if (!group.name || !language) return;

      // 1. Check for manual translation inFirestore
      const g = group as any;
      const manualName = g.translations?.[language]?.name;
      if (manualName) {
        setTranslatedName(manualName);
        return;
      }

      // 2. Check basic check: if name is short and likely already in target language (very rough)
      // For now, reliance on cache is better
      const cacheKey = `trans_name_${group.id}_${language}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setTranslatedName(cached);
        return;
      }

      setTranslating(true);
      try {
        const idToken = await auth?.currentUser?.getIdToken();
        const backend = import.meta.env.VITE_BACKEND_URL ?? '';
        const API_BASE = backend || (window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app');

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

        if (res.ok) {
          const data = await res.json();
          if (data.translatedText && data.translatedText !== group.name) {
            setTranslatedName(data.translatedText);
            sessionStorage.setItem(cacheKey, data.translatedText);
          }
        }
      } catch (err) {
        console.error('Auto-translation failed', err);
      } finally {
        setTranslating(false);
      }
    };

    autoTranslate();
  }, [group.id, group.name, language, (group as any).translations]);

  const isMember = !!(group.members && currentUser && group.members.includes(currentUser.uid));

  const getActivityStatus = () => {
    const now = new Date();
    const ONE_HOUR = 1000 * 60 * 60;

    // 1. Check Message Activity
    let lastDate: Date | null = null;
    if (group.lastMessageAt) {
      const gDate = group.lastMessageAt as { toDate?: () => Date; seconds?: number; _seconds?: number };
      if (gDate.toDate) lastDate = gDate.toDate();
      else if (gDate.seconds) lastDate = new Date(gDate.seconds * 1000);
      else if (gDate._seconds) lastDate = new Date(gDate._seconds * 1000);
      else lastDate = new Date(group.lastMessageAt as string | number);
    }

    if (lastDate && !isNaN(lastDate.getTime())) {
      const diffHours = (now.getTime() - lastDate.getTime()) / ONE_HOUR;
      if (diffHours <= 24) return { label: t('groupCard.statusActive'), color: '#ff5722', bg: '#fbe9e7' };
      return { label: t('groupCard.statusRelaxed'), color: '#795548', bg: '#efebe9' };
    }

    // 2. No messages? Check New (Created < 48h)
    let createdDate = null;
    const g = group as { createdAt?: unknown };
    if (g.createdAt) {
      const gDate = g.createdAt as { toDate?: () => Date; seconds?: number; _seconds?: number };
      if (gDate.toDate) createdDate = gDate.toDate();
      else if (gDate.seconds) createdDate = new Date(gDate.seconds * 1000);
      else if (gDate._seconds) createdDate = new Date(gDate._seconds * 1000);
      else createdDate = new Date(g.createdAt as string | number);
    }

    if (createdDate && !isNaN(createdDate.getTime())) {
      const createdHours = (now.getTime() - createdDate.getTime()) / ONE_HOUR;
      if (createdHours <= 48) return { label: t('groupCard.statusNew'), color: '#4caf50', bg: '#e8f5e9' };
    }

    // Fallback
    if (!lastDate && !createdDate) return { label: t('groupCard.statusNew'), color: '#4caf50', bg: '#e8f5e9' };

    return { label: t('groupCard.statusRelaxed'), color: '#795548', bg: '#efebe9' };
  };

  const activity = getActivityStatus();

  const handleJoin = async () => {
    if (!currentUser) {
      toast.info(t('groupCard.signInFirst'));
      return;
    }
    if (isMember) return;
    setJoining(true);
    try {
      // If an external join handler is provided (e.g. JoinGroup.joinGroup), prefer that
      if (onJoin) {
        await onJoin(group.id, group);
        return;
      }
      const backend = import.meta.env.VITE_BACKEND_URL ?? '/api';
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
    } catch (err) {
      console.error('Join failed', err);
      toast.error(t('groupCard.unableToJoin'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="group-card" role="group" aria-label={`Group ${group.name}`}>
      <div className="group-card-meta">
        <div
          className="activity-badge"
          style={{
            backgroundColor: activity.bg,
            color: activity.color,
            padding: '0.3rem 0.6rem',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          {activity.label}
        </div>
        <div className="member-badge">{group.members?.length ?? 0} {t('groupCard.members')}</div>
      </div>

      <div className="group-card-title-row">
        <h4 className="group-title">
          {translating ? <span className="translating-placeholder">...</span> : (translatedName || group.name)}
        </h4>
      </div>

      <div className="group-actions">
        <button
          className="join-btn"
          onClick={() => {
            if (isMember) {
              if (onOpen) onOpen(group);
            }
            else handleJoin();
          }}
          disabled={joining}
        >
          {joining ? t('groupCard.joining') : t('groupCard.details')}
        </button>
      </div>
    </div>
  );
}
