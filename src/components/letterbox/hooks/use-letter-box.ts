import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { UserData } from '../../../types/user';
import { FirebaseTimestamp } from '../../../types/chat';

export interface Letter {
  id: string;
  title?: string;
  content?: string;
  createdAt?: FirebaseTimestamp;
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
      const fetchedLetters = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Letter));
      setLetters(fetchedLetters);
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error("[LetterBox] Stream error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData, isOpen]);

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
    deleteTargetLetterId,
    setDeleteTargetLetterId,
    handleDelete,
    confirmDeleteLetter
  };
}
