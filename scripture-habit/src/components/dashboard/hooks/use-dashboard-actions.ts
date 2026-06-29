import { useCallback } from 'react';

import { User } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, appCheck, db } from '../../../firebase';
import { getToken } from 'firebase/app-check';
import { UserData } from '../../../types/user';

export const useDashboardActions = (user: User | null, userData: UserData | null) => {
  const markWelcomeStorySeen = useCallback(async (): Promise<boolean> => {
    if (!user?.uid || !userData || userData.hasSeenWelcomeStory !== undefined) return false;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
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
      await updateDoc(doc(db, 'users', user.uid), {
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
      await updateDoc(doc(db, 'users', user.uid), {
        nickname: nickname.trim()
      });
      return true;
    } catch (error) {
      console.error('Error updating nickname:', error);
      return false;
    }
  }, [user]);

  /**
   * TRUTH: Synchronizes message read status with the backend. 
   * This ensures that "Read by X" logic works accurately for other members.
   */
  const updateGroupReadStatus = useCallback(async (groupId: string, totalMessages: number): Promise<boolean> => {
    if (!user?.uid || !groupId || totalMessages < 0) return false;

    try {
      // 1. Latency Compensation (Direct Write)
      // This ensures the UI (unread count badge) updates immediately even if offline.
      // Firestore will sync this field automatically when back online.
      await updateDoc(doc(db, 'users', user.uid, 'groupStates', groupId), {
        readMessageCount: totalMessages,
        lastReadAt: serverTimestamp()
      });

      // 2. Background Sync (API)
      // The API performs additional "Truth Recovery" (counter healing) and updates
      // global member/group metadata for other users.
      // We run this in the background and don't block the UI result on its success.
      const performApiSync = async () => {
        try {
          const idToken = await auth?.currentUser?.getIdToken();
          if (!idToken) return;

          let appCheckToken = '';
          try {
            if (appCheck) {
              const appCheckTokenResponse = await getToken(appCheck!, false);
              appCheckToken = appCheckTokenResponse.token;
            }
          } catch (e) {
            console.warn('[useDashboardActions] AppCheck token failed:', e);
          }

          const API_BASE = '';
          const response = await fetch(`${API_BASE}/api/groups/update-read-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
              ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {})
            },
            body: JSON.stringify({ groupId, readMessageCount: totalMessages })
          });

          if (!response.ok) {
            console.warn('Background read status API sync failed:', await response.text());
          }
        } catch (error) {
          console.error('Background read status API sync failed:', error);
        }
      };

      // Fire and forget (or handle errors silently in production)
      performApiSync();

      return true;
    } catch (error) {
      console.error('Immediate read status update failed:', error);
      return false;
    }
  }, [user]);

  return { markWelcomeStorySeen, markTourSeen, updateNickname, updateGroupReadStatus };
};
