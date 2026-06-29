import { useMemo, useEffect } from 'react';

import { auth, appCheck } from '../../../../firebase';
import { getToken } from 'firebase/app-check';
import { safeStorage } from '../../../../utils/storage';
import confetti from 'canvas-confetti';
import { Message, GroupData, MembersMap } from '../../../../types/chat';
import { UserData } from '../../../../types/user';

import { calculateUnityPercentage } from '../../../../utils/unity-utils';
import { useToday } from '../../../../hooks/use-today';
import { useUnityMidnightReset } from '../../../../hooks/use-unity-midnight-reset';

export const useUnityScore = (
  groupId: string,
  userData: UserData,
  groupData: GroupData | null,
  messages: Message[],
  membersMap: MembersMap
): number => {
  const today = useToday();
  const unityPercentage = useMemo<number>(() => {
    // today is used as a dependency to trigger re-calculation at midnight
    if (!groupId || !groupData || groupData.id !== groupId || !today) return 0;
    const result = calculateUnityPercentage(groupData, messages, new Date(), membersMap);
    if (groupData.name?.includes('Persistence')) {
      if (import.meta.env.DEV) {
        console.log(`[useUnityScore] ${groupData.name}: calculated=${result}%, msgCount=${messages.length}`);
      }
    }
    return result;
  }, [messages, groupData, groupId, today, membersMap]);

  // Handle midnight reset for Unity Percentage
  useUnityMidnightReset({
    groupId,
    groupTimeZone: groupData?.timeZone || 'UTC',
    dailyActivityDate: groupData?.dailyActivity?.date || null,
    onReset: () => {
      // Force refresh group data when reset occurs
      // This will be handled by the parent component's onSnapshot listener
      if (import.meta.env.DEV) {
        console.log('[useUnityScore] Midnight reset triggered, refreshing...');
      }
    }
  });

  useEffect(() => {
    // Only proceed if unity is reached AND user is still a member of this specific group
    if (!userData?.uid || !groupId || unityPercentage !== 100) return;
    if (!groupData?.members?.includes(userData.uid)) return;

    const todayStr = new Date().toLocaleDateString('sv-SE');
    const storageKey = `unity_firework_${groupId}_${userData.uid}`;
    const lastSeen = safeStorage.get(storageKey);

    if (lastSeen !== todayStr) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      safeStorage.set(storageKey, todayStr);

      const checkAndSendAnnouncement = async () => {
        try {
          const user = auth?.currentUser;
          if (!user) return;

          const idToken = await user.getIdToken();
          let appCheckToken = '';
          try {
            if (appCheck) {
              const appCheckTokenResponse = await getToken(appCheck, false);
              appCheckToken = appCheckTokenResponse.token;
            }
          } catch (e) {
            console.warn('[useUnityScore] AppCheck token failed:', e);
          }

          const API_BASE = '';
          const response = await fetch(`${API_BASE}/api/groups/announce-unity`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
              ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {})
            },
            body: JSON.stringify({ groupId })
          });

          if (!response.ok) {
            console.error('Error sending unity announcement:', await response.text());
          }
        } catch (err) {
          console.error("Error sending unity announcement:", err);
        }
      };
      checkAndSendAnnouncement();
    }
  }, [unityPercentage, groupId, userData?.uid, groupData?.members, groupData?.timeZone]);

  return unityPercentage;
};
