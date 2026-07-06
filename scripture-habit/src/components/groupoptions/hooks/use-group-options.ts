import { useState, useEffect } from 'react';
import { auth, db } from '../../../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { UserData } from '../../../types/user';

export function useGroupOptions() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showWelcomeStory, setShowWelcomeStory] = useState(false);
  const [showTour, setShowTour] = useState(false);
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

            // Show welcome story if not seen yet
            if (data.hasSeenWelcomeStory === undefined) {
              setTimeout(() => setShowWelcomeStory(true), 100);
            }
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

    if (!loading && userData && userData.uid && 
        userData.hasSeenWelcomeStory === true && 
        userData.hasSeenGroupOptionsTour !== true) {
      const timer = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(timer);
    }
  }, [userData, loading]);

  const handleCloseWelcomeStory = async () => {
    setShowWelcomeStory(false);
    if (user && userData && userData.hasSeenWelcomeStory === undefined) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          hasSeenWelcomeStory: true
        });
      } catch (error) {
        console.error("Error marking welcome story as seen:", error);
      }
    }
  };

  const handleCloseTour = async () => {
    setShowTour(false);
    if (user && userData && userData.hasSeenGroupOptionsTour !== true) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          hasSeenGroupOptionsTour: true
        });
      } catch (error) {
        console.error("[GroupOptions] Error marking group options tour as seen:", error);
      }
    }
  };

  return {
    user,
    userData,
    showWelcomeStory,
    showTour,
    loading,
    handleCloseWelcomeStory,
    handleCloseTour
  };
}
