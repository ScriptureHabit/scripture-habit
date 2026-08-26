/// <reference types="vite/client" />
import { useEffect, useState, ReactNode, ReactElement } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { isEmulator } from '../config/firebase-config';
import { UserData } from '../types/user';
import { syncFcmTokenFlag } from '../utils/notification-helper';

import { AuthContext, AuthContextType } from './auth-context';


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(() => {
    try {
      const lastUid = typeof window !== 'undefined' ? localStorage.getItem('last_active_uid') : null;
      if (lastUid) {
        const cached = localStorage.getItem(`cached_user_data_${lastUid}`);
        if (cached) return JSON.parse(cached) as UserData;
      }
    } catch {
      // Ignore parse/storage errors
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(() => !auth || !db ? false : true); // Auth loading
  const [dataLoading, setDataLoading] = useState(false); // Data loading
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      return;
    }

    let unsubUserData: (() => void) | null = null;
    let unsubAuth: (() => void) | null = null;

    const setupListener = () => {
      if (!auth || !db) return;
      unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
        // Clean up previous user data listener
        if (unsubUserData) {
          unsubUserData();
          unsubUserData = null;
        }

        setUser(currentUser);
        setLoading(false); // Auth state is now determined

      if (currentUser) {
        setDataLoading(true);
        try {
          const { doc, onSnapshot } = await import('firebase/firestore');
          // Start listening to user document in Firestore
          const userDocRef = doc(db, 'users', currentUser.uid);
          unsubUserData = onSnapshot(
            userDocRef,
            (docSnap) => {
              if (docSnap.exists()) {
                const data = { uid: currentUser.uid, ...docSnap.data() } as UserData;
                setUserData(data);
                try {
                  localStorage.setItem(`cached_user_data_${currentUser.uid}`, JSON.stringify(data));
                  localStorage.setItem('last_active_uid', currentUser.uid);
                } catch {
                  // Ignore storage quota errors
                }
                
                // Ensure existing users with tokens have the hasFcmToken flag correctly set
                syncFcmTokenFlag(currentUser.uid, data.hasFcmToken);
              } else {
                setUserData(null);
                try {
                  localStorage.removeItem(`cached_user_data_${currentUser.uid}`);
                } catch {
                  // Ignore
                }
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
        } catch (err) {
          console.error('Failed to dynamically import firestore:', err);
          setDataLoading(false);
        }
      } else {
        console.log('[AuthProvider] no current user, clearing userData');
        setUserData(null);
        setDataLoading(false);
        try {
          localStorage.removeItem('last_active_uid');
        } catch {
          // Ignore
        }

        // Automatic dev login in emulator mode if not explicitly logged out
        if (isEmulator && import.meta.env.DEV && typeof window !== 'undefined' && auth) {
          const isDevSignedOut = sessionStorage.getItem('sh_dev_signed_out') === 'true';
          const isPlaywright = Boolean(window.navigator?.userAgent?.includes('Playwright') || (window as unknown as { __playwright?: boolean }).__playwright);
          if (!isDevSignedOut && !isPlaywright) {
            signInWithEmailAndPassword(auth, 'demo-user@example.com', 'password123')
              .catch((loginErr) => {
                console.warn('[AuthProvider] Auto dev login failed:', loginErr);
              });
          }
        }
      }
    });
    };

    queueMicrotask(setupListener);

    return () => {
      if (unsubAuth) unsubAuth();
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


