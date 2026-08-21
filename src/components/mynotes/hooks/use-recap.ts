import { useState } from 'react';
import apiClient from '../../../utils/api-client';
import { db } from '../../../firebase';
import { serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { UserData } from '../../../types/user';
import { parseTimestampToDate } from '../../../utils/time-utils';

/**
 * Hook for the business logic of generating and saving recaps.
 * Separated from UI state for better maintainability.
 */
export const useRecapOperations = (userData: UserData, language: string, t: (k: string, options?: Record<string, string | number>) => string) => {
  const [loading, setLoading] = useState(false);

  const generateRecap = async (notesCount: number): Promise<{ text: string; fromCache: boolean } | null> => {
    // 1. Rate Limit / Cached View Checks
    const isWithinCooldown = userData?.lastRecapGeneratedAt && (() => {
      const lastGenerated = parseTimestampToDate(userData.lastRecapGeneratedAt);
      const now = new Date();
      const diffTime = now.getTime() - lastGenerated.getTime();
      const cooldownMs = 6 * 24 * 60 * 60 * 1000; // 6 days in milliseconds
      return diffTime < cooldownMs;
    })();

    if (!isWithinCooldown && notesCount === 0) {
      toast.info(t('myNotes.noNotesForRecap'));
      return null;
    }

    // 2. API Call
    setLoading(true);
    toast.info(isWithinCooldown ? (t('myNotes.fetchingRecentRecap') || "Retrieving recent recap...") : t('myNotes.generatingRecap'));
    try {
      const response = await apiClient.post('/api/ai/generate-personal-weekly-recap', {
        uid: userData.uid,
        language: language
      }, {
        timeout: 45000 // 45s timeout for AI recap generation
      });

      if (response.data.recap) {
        toast.success(t('myNotes.recapSuccess'));
        return {
          text: response.data.recap as string,
          fromCache: !!response.data.fromCache
        };
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

      toast.success(t('myNotes.letterSaveSuccess') || "Saved to Letter Box!");
      return true;
    } catch (error) {
      console.error("Error saving to letter box:", error);
      toast.error(t('myNotes.letterSaveError') || "Error saving to Letter Box");
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
  const [isFromCache, setIsFromCache] = useState(false);
  
  const { loading: recapLoading, generateRecap, saveRecapToLetterBox } = useRecapOperations(userData, language, t);

  const handleGenerateRecap = async (notesCount: number) => {
    const result = await generateRecap(notesCount);
    if (result) {
      setGeneratedRecapText(result.text);
      setIsFromCache(result.fromCache);
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
    isFromCache,
    setIsRecapModalOpen,
    handleGenerateRecap,
    handleSaveRecapToLetterBox
  };
};
