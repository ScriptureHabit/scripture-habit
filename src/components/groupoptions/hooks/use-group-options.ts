import { useState, useEffect } from 'react';
import { auth, db } from '../../../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { UserData } from '../../../types/user';
import apiClient from '../../../utils/api-client';

export function useGroupOptions() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
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
    showWelcomeStory,
    loading,
    handleCloseWelcomeStory
  };
}
