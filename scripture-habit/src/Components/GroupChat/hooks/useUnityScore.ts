import { useMemo, useEffect } from 'react';
import { doc, collection, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../../../firebase';
import { safeStorage } from '../../../Utils/storage';
import confetti from 'canvas-confetti';
import { Message, GroupData } from '../../../types/chat';
import { UserData } from '../../../types/user';

export const useUnityScore = (
  groupId: string,
  userData: UserData,
  groupData: GroupData | null,
  messages: Message[]
) => {
  const unityPercentage = useMemo(() => {
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

    if (groupData.memberLastActive) {
      Object.entries(groupData.memberLastActive).forEach(([uid, ts]: [string, any]) => {
        let activeTime = 0;
        if (ts?.toDate) activeTime = ts.toDate().getTime();
        else if (ts?.seconds) activeTime = ts.seconds * 1000;
        if (activeTime >= todayTime) uniquePosters.add(uid);
      });
    }

    messages.forEach(msg => {
      let msgTime = 0;
      if (msg.createdAt?.toDate) msgTime = msg.createdAt.toDate().getTime();
      else if (msg.createdAt?.seconds) msgTime = msg.createdAt.seconds * 1000;
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
      let joinedTime = 0;
      if (joinedTs?.toDate) joinedTime = joinedTs.toDate().getTime();
      else if (joinedTs?.seconds) joinedTime = joinedTs.seconds * 1000;
      return joinedTime < todayTime;
    });

    if (eligibleMembers.length === 0) return 0;

    const eligiblePostersCount = [...uniquePosters].filter(uid => eligibleMembers.includes(uid)).length;
    const score = Math.round((eligiblePostersCount / eligibleMembers.length) * 100);
    return Math.min(100, Math.max(0, score));
  }, [messages, groupData, groupId, userData?.timeZone]);

  useEffect(() => {
    if (!userData?.uid || !groupId || unityPercentage !== 100) return;

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

      const groupRef = doc(db, 'groups', groupId);
      const checkAndSendAnnouncement = async () => {
        try {
          await runTransaction(db, async (transaction) => {
            const groupSnap = await transaction.get(groupRef);
            if (!groupSnap.exists()) return;
            const lastAnnouncementDate = groupSnap.data()?.lastUnityAnnouncementDate;
            if (lastAnnouncementDate !== todayStr) {
              transaction.update(groupRef, { lastUnityAnnouncementDate: todayStr });
              const messageRef = doc(collection(groupRef, 'messages'));
              transaction.set(messageRef, {
                senderId: 'system',
                isSystemMessage: true,
                messageType: 'unityAnnouncement',
                createdAt: serverTimestamp()
              });
            }
          });
        } catch (err) {
          console.error("Error sending unity announcement:", err);
        }
      };
      checkAndSendAnnouncement();
    }
  }, [unityPercentage, groupId, userData?.uid, userData?.timeZone]);

  return unityPercentage;
};
