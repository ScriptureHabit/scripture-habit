import { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { TimeCapsule } from '../types/time-capsule';

export function useMilestoneCapsule(days?: number, isOpen?: boolean) {
  const [capsule, setCapsule] = useState<TimeCapsule | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const currentUser = auth?.currentUser;

    if (!isOpen || !days || !currentUser) {
      return;
    }

    const capsuleRef = doc(db, 'users', currentUser.uid, 'letters', `capsule_${days}`);
    const unsubscribe = onSnapshot(
      capsuleRef,
      (snap) => {
        if (snap.exists()) {
          setCapsule({ id: snap.id, ...snap.data() } as TimeCapsule);
        } else {
          setCapsule(null);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Could not subscribe to capsule for milestone', err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isOpen, days]);

  const unlockCapsule = useCallback(
    async (capsuleId: string) => {
      const currentUser = auth?.currentUser;
      if (!currentUser) return;

      const capsuleRef = doc(db, 'users', currentUser.uid, 'letters', capsuleId);
      await updateDoc(capsuleRef, {
        isUnlocked: true,
        unlockedAt: serverTimestamp()
      });
    },
    []
  );

  return {
    capsule,
    loading,
    unlockCapsule
  };
}
