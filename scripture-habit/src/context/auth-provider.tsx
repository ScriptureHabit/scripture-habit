/// <reference types="vite/client" />
import { useEffect, useState, ReactNode, ReactElement } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserData } from '../types/user';
import { syncFcmTokenFlag } from '../utils/notification-helper';

import { AuthContext, AuthContextType } from './auth-context';


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !auth || !db ? false : true); // Auth loading
  const [dataLoading, setDataLoading] = useState(false); // Data loading
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      return;
    }

    let unsubUserData: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      // Clean up previous user data listener
      if (unsubUserData) {
        unsubUserData();
        unsubUserData = null;
      }

      setUser(currentUser);
      setLoading(false); // Auth state is now determined

      if (currentUser) {
        setDataLoading(true);
        // Start listening to user document in Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        unsubUserData = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = { uid: currentUser.uid, ...docSnap.data() } as UserData;
              setUserData(data);
              
              // Ensure existing users with tokens have the hasFcmToken flag correctly set
              syncFcmTokenFlag(currentUser.uid, data.hasFcmToken);
            } else {
              setUserData(null);
            }
            setDataLoading(false);
          },
          (err) => {
            console.error('Error listening to user data:', err);
            // Ignore permission-denied errors that often happen during sign out, but ONLY in production
            if (err.code !== 'permission-denied' || !import.meta.env.PROD) {
              setError(err as Error);
            }
            setDataLoading(false);
          }
        );
      } else {
        console.log('[AuthProvider] no current user, clearing userData');
        setUserData(null);
        setDataLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubUserData) unsubUserData();
    };
  }, []);

  // Background visibility listener for automatic ID token renewal on mobile app resume (throttled to 5 mins)
  useEffect(() => {
    let lastRefreshedAt = 0;
    const COOLDOWN_MS = 5 * 60 * 1000;

    const handleVisibilityChange = async () => {
      const now = Date.now();
      if (document.visibilityState === 'visible' && auth?.currentUser && (now - lastRefreshedAt > COOLDOWN_MS)) {
        try {
          lastRefreshedAt = now;
          await auth.currentUser.getIdToken(true);
          console.log('[AuthProvider] ID token refreshed on app resume (throttled)');
        } catch (e) {
          console.warn('[AuthProvider] Failed to refresh ID token on app resume:', e);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const ContextProvider = AuthContext.Provider as (props: { value: AuthContextType | undefined; children?: ReactNode }) => ReactElement | null;

  return (
    <ContextProvider value={{ user, userData, loading, dataLoading, error }}>
      {children}
    </ContextProvider>
  );
};


