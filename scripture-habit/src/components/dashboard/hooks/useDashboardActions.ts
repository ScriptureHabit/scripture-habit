import { useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
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
      const idToken = await auth?.currentUser?.getIdToken();
      if (!idToken) return false;

      let appCheckToken = '';
      try {
        const appCheckTokenResponse = await getToken(appCheck, false);
        appCheckToken = appCheckTokenResponse.token;
      } catch (e) {
        console.warn('[useDashboardActions] AppCheck token failed:', e);
      }

      const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
      const response = await fetch(`${API_BASE}/api/update-read-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {})
        },
        body: JSON.stringify({ groupId, readMessageCount: totalMessages })
      });

      if (!response.ok) {
        console.error('Background read status update failed:', await response.text());
        return false;
      }

      return true;
    } catch (error) {
      console.error('Background read status update failed:', error);
      return false;
    }
  }, [user]);

  return { markWelcomeStorySeen, updateNickname, updateGroupReadStatus };
};
