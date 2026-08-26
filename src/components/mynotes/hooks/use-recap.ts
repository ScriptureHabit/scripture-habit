import { useState } from 'react';
import apiClient from '../../../utils/api-client';
import { db } from '../../../firebase';
import { serverTimestamp, collection, addDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { UserData } from '../../../types/user';
import { useLetterAvailability } from '../../../hooks/use-letter-availability';

export interface GeneratedRecapResult {
  text: string;
  title: string;
  fromCache: boolean;
}

/**
 * Hook for the business logic of generating and saving recaps/letters.
 * Separated from UI state for better maintainability.
 */
export const useRecapOperations = (userData: UserData, language: string, t: (k: string, options?: Record<string, string | number>) => string) => {
  const [loading, setLoading] = useState(false);

  const hasPreviousLetter = !!(userData?.lastLetterGeneratedAt || userData?.lastRecapGeneratedAt);

  const generateRecap = async (
    canGenerateOrNotesCount: boolean | number = true,
    hasPrevious: boolean = hasPreviousLetter
  ): Promise<GeneratedRecapResult | null> => {
    const canGenerate = typeof canGenerateOrNotesCount === 'boolean' 
      ? canGenerateOrNotesCount 
      : canGenerateOrNotesCount >= 2;

    if (!canGenerate && !hasPrevious) {
      toast.info(t('myNotes.noNotesForRecap'));
      return null;
    }

    // API Call
    setLoading(true);
    toast.info(!canGenerate ? (t('myNotes.fetchingRecentRecap') || "Retrieving recent recap...") : t('myNotes.generatingRecap'));
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
          title: (response.data.title as string) || t('letterBox.defaultTitle') || "Weekly Recap",
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

  const saveRecapToLetterBox = async (recapText: string, customTitle?: string) => {
    try {
      const lettersRef = collection(db, 'users', userData.uid, 'letters');
      const lines = recapText.split('\n');
      let title = customTitle || t('letterBox.defaultTitle') || "Weekly Recap";

      if (!customTitle) {
        const titleLine = lines.find(line => line.toLowerCase().includes('title:') || line.includes('タイトル：'));
        if (titleLine) {
          title = titleLine.replace(/Title:|タイトル：/i, '').replace(/\*/g, '').trim();
        }
      }

      const expiresAt = Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await addDoc(lettersRef, {
        content: recapText,
        title: title,
        createdAt: serverTimestamp(),
        expiresAt,
        type: 'study_letter',
        read: true
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
 * Orchestrator hook that combines business logic with UI state (modals, results, unlock counts).
 */
export const useRecap = (userData: UserData, language: string, t: (k: string, options?: Record<string, string | number>) => string) => {
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);
  const [generatedRecapText, setGeneratedRecapText] = useState('');
  const [generatedRecapTitle, setGeneratedRecapTitle] = useState('');
  const [isFromCache, setIsFromCache] = useState(false);
  
  const lastGenAt = userData?.lastLetterGeneratedAt || userData?.lastRecapGeneratedAt;
  const hasPreviousLetter = !!lastGenAt;

  const { isLetterAvailable: canGenerateRecap, newNotesCount } = useLetterAvailability(userData);
  const notesRemaining = Math.max(0, 2 - newNotesCount);

  const { loading: recapLoading, generateRecap, saveRecapToLetterBox } = useRecapOperations(userData, language, t);

  const handleGenerateRecap = async (canGenerate: boolean = canGenerateRecap, hasPrevious: boolean = hasPreviousLetter) => {
    const result = await generateRecap(canGenerate, hasPrevious);
    if (result) {
      setGeneratedRecapText(result.text);
      setGeneratedRecapTitle(result.title);
      setIsFromCache(result.fromCache);
      setIsRecapModalOpen(true);
    }
  };

  const handleSaveRecapToLetterBox = async () => {
    const success = await saveRecapToLetterBox(generatedRecapText, generatedRecapTitle);
    if (success) {
      setIsRecapModalOpen(false);
    }
    return success;
  };

  return {
    recapLoading,
    isRecapModalOpen,
    generatedRecapText,
    generatedRecapTitle,
    isFromCache,
    canGenerateRecap,
    notesRemaining,
    hasPreviousLetter,
    setIsRecapModalOpen,
    handleGenerateRecap,
    handleSaveRecapToLetterBox
  };
};
