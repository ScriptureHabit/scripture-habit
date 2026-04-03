import { useState } from 'react';
import apiClient from '../../../utils/apiClient';
import { db } from '../../../firebase';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { UserData } from '../../../types/user';
import { parseTimestampToDate } from '../../../utils/timeUtils';

/**
 * Hook for the business logic of generating and saving recaps.
 * Separated from UI state for better maintainability.
 */
export const useRecapOperations = (userData: UserData, language: string, t: (k: string, options?: Record<string, string | number>) => string) => {
  const [loading, setLoading] = useState(false);

  const generateRecap = async (notesCount: number) => {
    // 1. Rate Limit Checks
    if (userData?.lastRecapGeneratedAt) {
      const lastGenerated = parseTimestampToDate(userData.lastRecapGeneratedAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastGenerated.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 6) {
        const daysLeft = 6 - diffDays;
        toast.info(t('groupChat.recapRateLimit') + " " + t('groupChat.daysLeft', { days: daysLeft }));
        return null;
      }
    }

    if (notesCount === 0) {
      toast.info(t('myNotes.noNotesForRecap'));
      return null;
    }

    // 2. API Call
    setLoading(true);
    toast.info(t('myNotes.generatingRecap'));
    try {
      const response = await apiClient.post('/api/generate-personal-weekly-recap', {
        uid: userData.uid,
        language: language
      });

      if (response.data.recap) {
        toast.success(t('myNotes.recapSuccess'));
        return response.data.recap as string;
      } else {
        toast.info(response.data.message || t('myNotes.noNotesForRecap'));
        return null;
      }

    } catch (error) {
      console.error("Error generating recap:", error);
      toast.error(t('myNotes.recapError'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const saveRecapToLetterBox = async (recapText: string) => {
    try {
      const lettersRef = collection(db, 'users', userData.uid, 'letters');
      const lines = recapText.split('\n');
      let title = t('letterBox.defaultTitle') || "Weekly Recap";

      const titleLine = lines.find(line => line.toLowerCase().includes('title:') || line.includes('タイトル：'));
      if (titleLine) {
        title = titleLine.replace(/Title:|タイトル：/i, '').replace(/\*/g, '').trim();
      }

      await addDoc(lettersRef, {
        content: recapText,
        title: title,
        createdAt: serverTimestamp(),
        type: 'weekly_recap'
      });

      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, {
        lastRecapGeneratedAt: serverTimestamp()
      });

      toast.success(t('newNote.successPost') || "Saved to Letter Box!");
      return true;
    } catch (error) {
      console.error("Error saving to letter box:", error);
      toast.error(t('myNotes.letterSaveError'));
      return false;
    }
  };

  return { loading, generateRecap, saveRecapToLetterBox };
};

/**
 * Orchestrator hook that combines business logic with UI state (modals, results).
 */
export const useRecap = (userData: UserData, language: string, t: (k: string, options?: Record<string, string | number>) => string) => {
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);
  const [generatedRecapText, setGeneratedRecapText] = useState('');
  
  const { loading: recapLoading, generateRecap, saveRecapToLetterBox } = useRecapOperations(userData, language, t);

  const handleGenerateRecap = async (notesCount: number) => {
    const recap = await generateRecap(notesCount);
    if (recap) {
      setGeneratedRecapText(recap);
      setIsRecapModalOpen(true);
    }
  };

  const handleSaveRecapToLetterBox = async () => {
    const success = await saveRecapToLetterBox(generatedRecapText);
    if (success) {
      setIsRecapModalOpen(false);
    }
    return success;
  };

  return {
    recapLoading,
    isRecapModalOpen,
    generatedRecapText,
    setIsRecapModalOpen,
    handleGenerateRecap,
    handleSaveRecapToLetterBox
  };
};
