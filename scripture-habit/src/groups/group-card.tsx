
import { useState, useEffect, useCallback, useMemo } from 'react';
import { auth, appCheck } from '../firebase';
import { getToken } from 'firebase/app-check';
import { Group, FirebaseTimestamp } from '../types/chat';
import './group-card.css';
import { useLanguage } from '../hooks/use-language';
import { toast } from 'react-toastify';


interface ActivityStatus {
  label: string;
  type: 'active' | 'relaxed' | 'new';
}

interface Props {
  group: Group;
  currentUser: { uid: string } | null;
  onJoin?: (groupId: string, groupData?: Group) => Promise<void> | void;
  onOpen?: (group: Group) => void;
}

// --- Helpers ---

const parseFirebaseDate = (date: FirebaseTimestamp | undefined | null): Date | null => {
  if (!date) return null;
  const dAny = date as unknown as { toDate?: () => Date, seconds?: number, _seconds?: number };
  if (typeof dAny.toDate === 'function') return dAny.toDate();
  if (typeof dAny.seconds === 'number') return new Date(dAny.seconds * 1000);
  if (typeof dAny._seconds === 'number') return new Date(dAny._seconds * 1000);
  const d = new Date(date as string | number | Date);
  return isNaN(d.getTime()) ? null : d;
};

const getStatus = (group: Group, t: (key: string) => string): ActivityStatus => {

  const now = new Date();
  const ONE_HOUR = 3600000;
  
  const lastActiveMsg = parseFirebaseDate(group.lastMessageAt);
  const lastActiveNote = parseFirebaseDate(group.lastNoteAt);
  
  const lastActive = (lastActiveMsg && lastActiveNote) 
    ? (lastActiveMsg > lastActiveNote ? lastActiveMsg : lastActiveNote)
    : (lastActiveMsg || lastActiveNote);

  if (lastActive) {
    const diffHours = (now.getTime() - lastActive.getTime()) / ONE_HOUR;
    if (diffHours <= 24) {
      return { label: t('groupCard.statusActive'), type: 'active' };
    }
  }

  const created = parseFirebaseDate(group.createdAt);
  if (created) {
    const createdHours = (now.getTime() - created.getTime()) / ONE_HOUR;
    if (createdHours <= 48) {
      return { label: t('groupCard.statusNew'), type: 'new' };
    }
  }

  if (!lastActive && !created) {
     return { label: t('groupCard.statusNew'), type: 'new' };
  }

  return { label: t('groupCard.statusRelaxed'), type: 'relaxed' };
};

// --- Component ---

export default function GroupCard({ group, currentUser, onJoin, onOpen }: Props) {
  const { t, language } = useLanguage();
  const [joining, setJoining] = useState(false);
  const [translatedName, setTranslatedName] = useState('');
  const [translating, setTranslating] = useState(false);

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
        const currentUser = auth?.currentUser;

        if (!currentUser) {
          if (active) setTranslating(false);
          return;
        }

        const idToken = await currentUser.getIdToken();
        let appCheckToken = '';
        if (appCheck) {
          const appCheckTokenResponse = await getToken(appCheck, false);
          appCheckToken = appCheckTokenResponse.token;
        }

        const API_BASE = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app');

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        };
        if (appCheckToken) {
          headers['x-firebase-appcheck'] = appCheckToken;
        }

        const res = await fetch(`${API_BASE}/api/ai/translate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            text: group.name,
            targetLanguage: language,
            updateType: 'group_name',
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

    if (onJoin) {
      await onJoin(group.id, group);
      return;
    }

    if (!currentUser) {
      toast.info(t('groupCard.signInFirst'));
      return;
    }

    setJoining(true);
    try {

      const backend = import.meta.env.VITE_BACKEND_URL || '/api';
      const idToken = await auth?.currentUser?.getIdToken();
      
      if (!idToken) {
        throw new Error('Unable to retrieve authentication token');
      }

      let appCheckToken = '';
      try {
        if (appCheck) {
          const appCheckTokenResponse = await getToken(appCheck, false);
          appCheckToken = appCheckTokenResponse.token;
        }
      } catch (e) {
        console.warn('[GroupCard] AppCheck token failed:', e);
      }

      const res = await fetch(`${backend}/join-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {})
        },
        body: JSON.stringify({ groupId: group.id }),
      });
      
      if (!res.ok) {
         const err = await res.json().catch(() => ({}));
         throw new Error(err?.error || 'Server join failed');
      }
    } catch (err: unknown) {
      console.error('Join failed:', err);
      toast.error(t('groupCard.unableToJoin'));
    } finally {
      setJoining(false);
    }
  }, [isMember, currentUser, group, onJoin, onOpen, t]);

  return (
    <div className="group-card" role="group" aria-label={`Group ${group.name}`}>
      <div className="group-card-meta">
        <div className={`activity-badge ${activity.type}`}>
          {activity.label}
        </div>
        <div className="member-badge">
          {group.membersCount ?? group.members?.length ?? 0} {t('groupCard.members')}
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


