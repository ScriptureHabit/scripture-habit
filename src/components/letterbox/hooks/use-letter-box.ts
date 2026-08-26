import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { UserData } from '../../../types/user';
import { FirebaseTimestamp } from '../../../types/chat';
import { parseTimestampToDate } from '../../../utils/time-utils';

export interface Letter {
  id: string;
  title?: string;
  content?: string;
  createdAt?: FirebaseTimestamp;
  expiresAt?: FirebaseTimestamp;
  type?: string;
  read?: boolean;
}

export function useLetterBox(isOpen: boolean, userData: UserData | null) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);
  const [deleteTargetLetterId, setDeleteTargetLetterId] = useState<string | null>(null);

  useEffect(() => {
    if (!userData || !userData.uid || !isOpen) return;

    const lettersRef = collection(db, 'users', userData.uid, 'letters');
    const q = query(lettersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const fetchedLetters = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Letter))
        .filter(letter => {
          // 1. If explicit expiresAt is present, check against current time
          if (letter.expiresAt) {
            try {
              const expireDate = parseTimestampToDate(letter.expiresAt);
              return expireDate.getTime() > now;
            } catch {
              // fallback to createdAt check
            }
          }
          // 2. Check createdAt within 30 days
          if (letter.createdAt) {
            try {
              const createDate = parseTimestampToDate(letter.createdAt);
              return createDate.getTime() >= thirtyDaysAgo;
            } catch {
              return true;
            }
          }
          return true;
        });

      setLetters(fetchedLetters);
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error("[LetterBox] Stream error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData, isOpen]);

  const handleSelectLetter = (letter: Letter) => {
    setSelectedLetter(letter);

    // If letter is unread, automatically mark as read in Firestore
    if (letter.read === false && userData?.uid) {
      updateDoc(doc(db, 'users', userData.uid, 'letters', letter.id), {
        read: true
      }).catch(err => {
        console.error('[LetterBox] Failed to mark letter as read:', err);
      });
    }
  };

  const handleDelete = (e: React.MouseEvent, letterId: string) => {
    e.stopPropagation();
    setDeleteTargetLetterId(letterId);
  };

  const confirmDeleteLetter = async () => {
    if (!userData?.uid || !deleteTargetLetterId) {
      setDeleteTargetLetterId(null);
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userData.uid, 'letters', deleteTargetLetterId));
    } catch (error) {
      console.error('Error deleting letter:', error);
    } finally {
      setDeleteTargetLetterId(null);
    }
  };

  return {
    letters,
    loading,
    selectedLetter,
    setSelectedLetter,
    handleSelectLetter,
    deleteTargetLetterId,
    setDeleteTargetLetterId,
    handleDelete,
    confirmDeleteLetter
  };
}
