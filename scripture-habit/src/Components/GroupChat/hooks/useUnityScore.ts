import { useMemo, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { auth, appCheck } from '../../../firebase';
import { getToken } from 'firebase/app-check';
import { safeStorage } from '../../../Utils/storage';
import confetti from 'canvas-confetti';
import { Message, GroupData } from '../../../types/chat';
import { parseTimestampToMillis } from '../../../Utils/timeUtils';
import { UserData } from '../../../types/user';

export const useUnityScore = (
  groupId: string,
  userData: UserData,
  groupData: GroupData | null,
  messages: Message[]
): number => {
  const unityPercentage = useMemo<number>(() => {
    if (!groupData?.members || groupData.members.length === 0 || groupData?._groupId !== groupId) return 0;

    const effectiveTimeZone = groupData?.timeZone || userData?.timeZone || 'UTC';
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: effectiveTimeZone });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const uniquePosters = new Set<string>();

    if (groupData.dailyActivity?.activeMembers && (groupData.dailyActivity.date === todayStr || groupData.dailyActivity.date === new Date().toDateString())) {
      groupData.dailyActivity.activeMembers.forEach(uid => uniquePosters.add(uid));
    }


    messages.forEach(msg => {
      const msgTime = parseTimestampToMillis(msg.createdAt);
      if (msgTime >= todayTime && msg.senderId !== 'system' && !msg.isSystemMessage && msg.isNote) {
        uniquePosters.add(msg.senderId!);
      }
    });

    // Exclude members who joined today UNLESS they have already posted
    const memberJoinedAt = groupData.memberJoinedAt || {};
    const eligibleMembers = groupData.members.filter(uid => {
      if (uniquePosters.has(uid)) return true; // Posted today -> count
      const joinedTs = memberJoinedAt[uid];
      if (!joinedTs) return true;
      const joinedTime = parseTimestampToMillis(joinedTs);
      return joinedTime < todayTime;
    });

    if (eligibleMembers.length === 0) return 0;
    const eligiblePostersCount = [...uniquePosters].filter(uid => eligibleMembers.includes(uid)).length;
    const score = Math.round((eligiblePostersCount / eligibleMembers.length) * 100);
    return Math.min(100, Math.max(0, score));
  }, [messages, groupData, groupId, userData?.timeZone]);

  useEffect(() => {
    // Only proceed if unity is reached AND user is still a member of this specific group
    if (!userData?.uid || !groupId || unityPercentage !== 100) return;
    if (!groupData?.members?.includes(userData.uid)) return;

    const effectiveTimeZone = groupData?.timeZone || userData?.timeZone || 'UTC';
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: effectiveTimeZone });
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
            const appCheckTokenResponse = await getToken(appCheck, false);
            appCheckToken = appCheckTokenResponse.token;
          } catch (e) {
            console.warn('[useUnityScore] AppCheck token failed:', e);
          }

          const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
          const response = await fetch(`${API_BASE}/api/announce-unity`, {
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
  }, [unityPercentage, groupId, userData?.uid, userData?.timeZone]);

  return unityPercentage;
};
