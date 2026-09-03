import { useCallback } from 'react';
import { User } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import apiClient from '../../../utils/api-client';
import { UserData } from '../../../types/user';

export const useDashboardActions = (user: User | null, userData: UserData | null) => {
  const markWelcomeStorySeen = useCallback(async (): Promise<boolean> => {
    if (!user?.uid || !userData || userData.hasSeenWelcomeStory === true) return false;

    try {
      await apiClient.post('/api/auth/update-profile', {
        hasSeenWelcomeStory: true
      });
      return true;
    } catch (error) {
      console.error('Error marking welcome story as seen:', error);
      return false;
    }
  }, [user, userData]);

  const markTourSeen = useCallback(async (seen: boolean = true): Promise<boolean> => {
    if (!user?.uid || !userData) return false;

    try {
      await apiClient.post('/api/auth/update-profile', {
        hasSeenTour: seen
      });
      return true;
    } catch (error) {
      console.error('Error marking tour as seen:', error);
      return false;
    }
  }, [user, userData]);

  const updateNickname = useCallback(async (nickname: string): Promise<boolean> => {
    if (!user?.uid || !nickname.trim()) return false;

    try {
      await setDoc(doc(db, 'users', user.uid), {
        nickname: nickname.trim()
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error updating nickname:', error);
      return false;
    }
  }, [user]);

  /**
   * TRUTH: Synchronizes message read status with the backend. 
   * This ensures that "Read by X" logic and unread badge dismissal works accurately.
   */
  const updateGroupReadStatus = useCallback(async (groupId: string, totalMessages: number): Promise<boolean> => {
    if (!user?.uid || !groupId || totalMessages < 0) return false;

    try {
      // 1. Latency Compensation (Direct Write via setDoc with merge)
      // Must use setDoc with merge: true because the groupStates subcollection doc might not exist yet!
      await setDoc(doc(db, 'users', user.uid, 'groupStates', groupId), {
        readMessageCount: totalMessages,
        lastReadAt: serverTimestamp()
      }, { merge: true });

      // 2. Background Sync (API via centralized apiClient)
      // The API updates group.memberLastReadAt[uid] so the unread badge is accurately cleared across devices.
      const performApiSync = async () => {
        try {
          await apiClient.post('/api/groups/update-read-status', {
            groupId,
            readMessageCount: totalMessages
          });
        } catch (error) {
          console.warn('[updateGroupReadStatus] API sync failed:', error);
        }
      };

      // Fire and forget
      performApiSync();

      return true;
    } catch (error) {
      console.error('Immediate read status update failed:', error);
      return false;
    }
  }, [user]);

  const clearLastRecentGroup = useCallback(async (): Promise<boolean> => {
    if (!user?.uid) return false;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        lastRecentGroup: deleteField()
      });
      return true;
    } catch (error) {
      console.error('Error clearing lastRecentGroup:', error);
      return false;
    }
  }, [user]);

  return { markWelcomeStorySeen, markTourSeen, updateNickname, updateGroupReadStatus, clearLastRecentGroup };
};
