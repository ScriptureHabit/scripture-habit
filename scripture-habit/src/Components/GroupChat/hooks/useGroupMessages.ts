import { useState, useEffect, useRef } from 'react';
import { db } from '../../../firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc, getDocs, limit, startAfter, startAt, DocumentSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { safeStorage } from '../../../Utils/storage';
import confetti from 'canvas-confetti';
import * as Sentry from "@sentry/react";
import { Message, GroupData, MembersMap, UserProfileBrief } from '../../../types/chat';

export const useGroupMessages = (groupId: string | null, userData: any, t: (key: string) => string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userReadCount, setUserReadCount] = useState<number | null>(null);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [membersMap, setMembersMap] = useState<MembersMap>({});

  const currentGroupIdRef = useRef<string | null>(groupId);

  const prevMessageCountRef = useRef(0);
  const latestMessageRef = useRef<Message | null>(null);


  useEffect(() => {
    if (!groupId) return;

    // Update ref FIRST - this is the source of truth for current group
    currentGroupIdRef.current = groupId;

    // Reset all states when group changes
    setLoading(true);
    setMessages([]);
    setGroupData(null);
    setInitialScrollDone(false);
    setUserReadCount(null);
    setHasMoreOlder(true);
    prevMessageCountRef.current = 0;
    latestMessageRef.current = null;

    let unsubscribeGroup = () => { };
    let unsubscribeNewMessages = () => { };

    const updateReadStatus = async (totalCount: number) => {
      if (!userData?.uid || !groupId || totalCount <= 0) return;
      try {
        const userGroupStateRef = doc(db, 'users', userData.uid, 'groupStates', groupId);
        const groupRef = doc(db, 'groups', groupId);

        await Promise.all([
          setDoc(userGroupStateRef, {
            readMessageCount: totalCount,
            lastReadAt: serverTimestamp()
          }, { merge: true }),
          updateDoc(groupRef, {
            [`memberLastReadAt.${userData.uid}`]: serverTimestamp(),
            [`memberLastActive.${userData.uid}`]: serverTimestamp()
          })
        ]);
        setUserReadCount(totalCount);
      } catch (err) {
        console.error("Failed to update read status:", err);
      }
    };

    const groupRef = doc(db, 'groups', groupId);
    unsubscribeGroup = onSnapshot(groupRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGroupData({ ...data, _groupId: groupId } as GroupData);
        
        // Update read status if there are unread messages and we're looking at the chat
        const totalMsgs = data.messageCount || 0;
        if (totalMsgs > 0 && userReadCount !== null && totalMsgs > userReadCount) {
          updateReadStatus(totalMsgs);
        }
      }
    }, (err) => {
      /* ... existing error handling ... */
      if (err.code === 'permission-denied') return;
      console.error("Error listening to group:", err);
      const isQuota = err.code === 'resource-exhausted' || err.message.toLowerCase().includes('quota exceeded');
      if (isQuota) setError(t('systemErrors.quotaExceededMessage'));
      else { Sentry.captureException(err); setError(err.message); }
    });

    // Initial read status sync
    const fetchInitialState = async () => {
      try {
        const stateRef = doc(db, 'users', userData.uid, 'groupStates', groupId);
        const stateSnap = await getDoc(stateRef);
        const initialReadCount = stateSnap.exists() ? (stateSnap.data().readMessageCount || 0) : 0;
        setUserReadCount(initialReadCount);

        const gSnap = await getDoc(groupRef);
        if (gSnap.exists()) {
          const gData = gSnap.data();
          const totalMsgs = gData.messageCount || 0;
          if (totalMsgs > initialReadCount) {
            updateReadStatus(totalMsgs);
          }
        }
      } catch (e) {
        console.error("Error fetching initial read status:", e);
        setUserReadCount(0);
      }
    };
    if (userData?.uid) fetchInitialState();

    // Fetch members detail whenever group context changes
    const fetchMembersDetails = async (membersArray: string[]) => {
      if (!membersArray || membersArray.length === 0) return;

      const newMap = { ...membersMap };
      const uidsToFetch = membersArray.filter(uid => !newMap[uid]);

      if (uidsToFetch.length === 0) return;

      try {
        const memberSnapshots = await Promise.all(uidsToFetch.map(uid => getDoc(doc(db, 'users', uid))));
        memberSnapshots.forEach(snap => {
          if (snap.exists()) {
            newMap[snap.id] = snap.data() as UserProfileBrief;
          }
        });
        setMembersMap(newMap);
      } catch (err) {
        console.error("Error fetching members details:", err);
      }
    };

    getDoc(groupRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.members) fetchMembersDetails(data.members);
      }
    });

    const initMessages = async () => {
      try {
        const messagesRef = collection(db, 'groups', groupId, 'messages');
        const lastViewedMsgId = userData?.uid ? safeStorage.get(`last_viewed_msg_${groupId}_${userData.uid}`) : null;

        let initialMsgs: Message[] = [];
        let anchorSnapshot: DocumentSnapshot | null = null;

        // Strategy: 
        // 1. Try to fetch the 'last viewed' message to establish an anchor.
        // 2. If it exists, fetch surrounding messages (e.g. 5 before, 15 after).
        // 3. If not, fetch the latest 20 messages.

        if (lastViewedMsgId) {
          try {
            // We need to get the actual document snapshot to use as a cursor
            const anchorRef = doc(db, 'groups', groupId, 'messages', lastViewedMsgId);
            anchorSnapshot = await getDoc(anchorRef);
          } catch (e) {
            console.log("Could not fetch anchor", e);
          }
        }

        if (anchorSnapshot && anchorSnapshot.exists()) {
          // Restoring position from anchor
          // Newer context (including anchor) - "startAt" includes the anchor
          const nextQuery = query(messagesRef, orderBy('createdAt', 'asc'), startAt(anchorSnapshot), limit(15));
          const nextSnaps = await getDocs(nextQuery);
          const nextMsgs = nextSnaps.docs.map(d => ({ id: d.id, ...d.data() } as Message));

          // Older context - "startAfter" excludes anchor (going backwards, so older than anchor)
          // We use 'desc' to get the immediately preceding messages
          const prevQuery = query(messagesRef, orderBy('createdAt', 'desc'), startAfter(anchorSnapshot), limit(5));
          const prevSnaps = await getDocs(prevQuery);
          const prevMsgs = prevSnaps.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();

          initialMsgs = [...prevMsgs, ...nextMsgs];
        } else {
          // Fallback: Latest 20
          // We query descending to get the newest, then reverse to display chronologically
          const latestQuery = query(messagesRef, orderBy('createdAt', 'desc'), limit(20));
          const latestSnaps = await getDocs(latestQuery);
          initialMsgs = latestSnaps.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
        }

        setMessages(initialMsgs);
        setLoading(false);

        // Setup Real-time listener for NEW messages
        // Listen for messages created AFTER the last message in our initial list
        if (initialMsgs.length > 0) {
          const firstMsg = initialMsgs[0];
          latestMessageRef.current = initialMsgs[initialMsgs.length - 1];

          if (firstMsg.createdAt) {
            const newMsgsQuery = query(
              messagesRef,
              orderBy('createdAt', 'asc'),
              startAt(firstMsg.createdAt)
            );

            unsubscribeNewMessages = onSnapshot(newMsgsQuery, (snapshot) => {
              const newIncoming: Message[] = [];
              snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                  const data = change.doc.data();

                  // Trigger confetti for streaks! (only if truly new - within last 30 seconds)
                  const messageTime = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
                  const isTrulyNew = messageTime && (Date.now() - messageTime) < 30000;

                  if (data.messageType === 'streakAnnouncement' && data.messageData?.userId !== userData?.uid && isTrulyNew) {
                    confetti({
                      particleCount: 150,
                      spread: 70,
                      origin: { y: 0.6 },
                      zIndex: 10000
                    });
                  }

                  newIncoming.push({ id: change.doc.id, ...data } as Message);
                }
                if (change.type === "modified") {
                  setMessages(prev => prev.map(m => m.id === change.doc.id ? { id: change.doc.id, ...change.doc.data() } as Message : m));
                }
                if (change.type === "removed") {
                  setMessages(prev => prev.filter(m => m.id !== change.doc.id));
                }
              });

              if (newIncoming.length > 0) {
                setMessages(prev => {
                  const cleanIncoming = newIncoming.filter(n => !prev.some(p => p.id === n.id));
                  return [...prev, ...cleanIncoming];
                });
              }
            }, (err) => {
              if (err.code === 'permission-denied') {
                return;
              }
              console.error("Error listening to new messages:", err);
              if (err.code === 'resource-exhausted' || err.message.toLowerCase().includes('quota exceeded')) {
                setError(t('systemErrors.quotaExceededMessage'));
              }
              // else we don't necessarily want to break the whole chat UI for a sub-listener error unless it's critical
            });
          }
        } else {
          // If no messages at all, simply listen for any new messages
          const allNewQuery = query(messagesRef, orderBy('createdAt', 'asc'));
          unsubscribeNewMessages = onSnapshot(allNewQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const data = change.doc.data();

                // Trigger confetti for streaks (only if truly new - within last 30 seconds)
                const messageTime = data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);
                const isTrulyNew = messageTime && (Date.now() - messageTime) < 30000;

                if (data.messageType === 'streakAnnouncement' && data.messageData?.userId !== userData?.uid && isTrulyNew) {
                  confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    zIndex: 10000
                  });
                }

                setMessages(prev => {
                  if (prev.some(m => m.id === change.doc.id)) return prev;
                  return [...prev, { id: change.doc.id, ...data } as Message];
                });
              }
              if (change.type === "modified") {
                setMessages(prev => prev.map(m => m.id === change.doc.id ? { id: change.doc.id, ...change.doc.data() } as Message : m));
              }
              if (change.type === "removed") {
                setMessages(prev => prev.filter(m => m.id !== change.doc.id));
              }
            });
            setLoading(false);
          }, (err) => {
            if (err.code === 'permission-denied') {
              return;
            }
            console.error("Error listening to all messages:", err);
            if (err.code === 'resource-exhausted' || err.message.toLowerCase().includes('quota exceeded')) {
              setError(t('systemErrors.quotaExceededMessage'));
            }
          });
        }

      } catch (err: any) {
        if (err.code !== 'permission-denied') {
          console.error("Error fetching messages:", err);
          setError("Failed to load messages.");
        }
        setLoading(false);
      }
    };

    initMessages();

    // --- Added Logs when opening Group Chat ---


    return () => {

      unsubscribeGroup();
      unsubscribeNewMessages();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);


  return {
    messages, setMessages,
    groupData, setGroupData,
    loading, setLoading,
    error, setError,
    userReadCount, setUserReadCount,
    initialScrollDone, setInitialScrollDone,
    hasMoreOlder, setHasMoreOlder,
    membersMap, setMembersMap,
    currentGroupIdRef,
    prevMessageCountRef,
    latestMessageRef
  };
};
