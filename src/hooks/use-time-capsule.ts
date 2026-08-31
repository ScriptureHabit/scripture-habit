import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UserData } from '../types/user';
import { TimeCapsule } from '../types/time-capsule';
import { FirebaseTimestamp } from '../types/chat';
import { getNextMilestone } from '../utils/milestone';

const DRAFT_KEY_PREFIX = 'scripture_habit_capsule_draft_';

export function useTimeCapsule(userData: UserData | null) {
  const [sealedCapsule, setSealedCapsule] = useState<TimeCapsule | null>(null);
  const [unlockedCapsules, setUnlockedCapsules] = useState<TimeCapsule[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const uid = userData?.uid;
  const isDemo = !!userData?.isAnonymousDemo;
  const daysStudiedCount = userData?.daysStudiedCount || 0;

  const nextTargetDays = useMemo(() => getNextMilestone(daysStudiedCount), [daysStudiedCount]);

  // Subscribe to time capsule letters for the current user
  useEffect(() => {
    if (!uid || isDemo) {
      return;
    }

    const lettersRef = collection(db, 'users', uid, 'letters');
    const q = query(lettersRef, where('type', '==', 'time_capsule'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const capsules = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        } as TimeCapsule));

        const sealed = capsules.find((c) => !c.isUnlocked) || null;
        const unlocked = capsules.filter((c) => c.isUnlocked);

        setSealedCapsule(sealed);
        setUnlockedCapsules(unlocked);
        setLoading(false);
      },
      (error) => {
        console.error('Error subscribing to time capsules:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid, isDemo]);

  // Draft Management (localStorage)
  const getDraft = useCallback((targetDays: number) => {
    if (typeof window === 'undefined') return { content: '', sosMessage: '' };
    try {
      const saved = localStorage.getItem(`${DRAFT_KEY_PREFIX}${targetDays}`);
      if (saved) {
        return JSON.parse(saved) as { content: string; sosMessage: string };
      }
    } catch (e) {
      console.warn('Failed to load draft from localStorage', e);
    }
    return { content: '', sosMessage: '' };
  }, []);

  const saveDraft = useCallback((targetDays: number, content: string, sosMessage: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${DRAFT_KEY_PREFIX}${targetDays}`, JSON.stringify({ content, sosMessage }));
    } catch (e) {
      console.warn('Failed to save draft to localStorage', e);
    }
  }, []);

  const clearDraft = useCallback((targetDays: number) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${targetDays}`);
    } catch (e) {
      console.warn('Failed to clear draft from localStorage', e);
    }
  }, []);

  // Create & Seal a Time Capsule
  const createTimeCapsule = useCallback(
    async (targetDays: number, content: string, sosMessage: string) => {
      if (!uid) throw new Error('User not authenticated');

      const capsuleDocId = `capsule_${targetDays}`;
      const capsuleRef = doc(db, 'users', uid, 'letters', capsuleDocId);

      const now = new Date();
      const formattedDate = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;

      const newCapsule: Omit<TimeCapsule, 'id'> = {
        type: 'time_capsule',
        targetDays,
        title: `Day ${targetDays}の自分へ`,
        content: content.trim(),
        sosMessage: sosMessage.trim(),
        isUnlocked: false,
        createdAt: serverTimestamp() as unknown as FirebaseTimestamp,
        createdStats: {
          days: daysStudiedCount,
          level: Math.floor(daysStudiedCount / 7) + 1,
          date: formattedDate
        }
      };

      await setDoc(capsuleRef, newCapsule, { merge: true });
      clearDraft(targetDays);
    },
    [uid, daysStudiedCount, clearDraft]
  );

  // Unlock a Time Capsule
  const unlockTimeCapsule = useCallback(
    async (capsuleId: string) => {
      if (!uid) return;
      const capsuleRef = doc(db, 'users', uid, 'letters', capsuleId);
      await updateDoc(capsuleRef, {
        isUnlocked: true,
        unlockedAt: serverTimestamp()
      });
    },
    [uid]
  );

  // SOS Message for crisis / habit rule warning
  const activeSosMessage = useMemo(() => {
    if (sealedCapsule && sealedCapsule.sosMessage) {
      return sealedCapsule.sosMessage;
    }
    return null;
  }, [sealedCapsule]);

  return {
    sealedCapsule,
    unlockedCapsules,
    nextTargetDays,
    loading,
    getDraft,
    saveDraft,
    clearDraft,
    createTimeCapsule,
    unlockTimeCapsule,
    activeSosMessage
  };
}
