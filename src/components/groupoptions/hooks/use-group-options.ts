import { useState, useEffect } from 'react';
import { auth, db } from '../../../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { UserData } from '../../../types/user';
import { GroupService } from '../../../services/group-service';
import apiClient from '../../../utils/api-client';

export function useGroupOptions() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [hasAiGroup, setHasAiGroup] = useState(false);
  const [showWelcomeStory, setShowWelcomeStory] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth!, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData({ uid: currentUser.uid, ...data } as UserData);
          }
          setLoading(false);
        }, (err) => {
          if (err.code !== 'permission-denied') {
            console.error("[GroupOptions] User data listener error:", err);
          }
          setLoading(false);
        });
        return () => unsubUser();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubGroups = GroupService.subscribeUserGroups(
      user.uid,
      (fetchedGroups) => {
        const hasAi = fetchedGroups.some((g) => Boolean(g.isAiGroup || g.aiCompanionUid === 'ai-partner-bot'));
        setHasAiGroup(hasAi);
      },
      (err) => {
        if ((err as { code?: string })?.code !== 'permission-denied') {
          console.error("[GroupOptions] User groups listener error:", err);
        }
      }
    );

    return () => {
      unsubGroups();
      setHasAiGroup(false);
    };
  }, [user?.uid]);

  useEffect(() => {
    const isE2E = typeof navigator !== 'undefined' && navigator.webdriver;
    if (isE2E) return;

    if (!loading && userData && userData.uid) {
      const sessionWelcomeSeen = sessionStorage.getItem(`welcome_seen_${userData.uid}`) === 'true';

      // Step 1: Check Welcome Story
      const needsWelcomeStory = !sessionWelcomeSeen && (userData.hasSeenWelcomeStory === false || userData.hasSeenWelcomeStory === undefined);
      if (needsWelcomeStory) {
        const timer = setTimeout(() => setShowWelcomeStory(true), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [userData, loading]);

  const handleCloseWelcomeStory = async () => {
    setShowWelcomeStory(false);
    if (userData?.uid) {
      sessionStorage.setItem(`welcome_seen_${userData.uid}`, 'true');
    }
    if (user && userData && userData.hasSeenWelcomeStory !== true) {
      try {
        await apiClient.post('/api/auth/update-profile', {
          hasSeenWelcomeStory: true
        });
      } catch (error) {
        console.error("Error marking welcome story as seen:", error);
      }
    }
  };

  return {
    user,
    userData,
    hasAiGroup,
    showWelcomeStory,
    loading,
    handleCloseWelcomeStory
  };
}
