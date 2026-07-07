/// <reference types="vite/client" />
import React, { useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserData } from '../types/user';
import { syncFcmTokenFlag } from '../utils/notification-helper';

import { AuthContext } from './auth-context';


export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true); // Auth loading
  const [dataLoading, setDataLoading] = useState(false); // Data loading
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    let unsubUserData: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      console.log('[AuthProvider] onAuthStateChanged', {
        uid: currentUser?.uid || null,
        email: currentUser?.email || null,
        providerId: currentUser?.providerId || null,
      });

      // Clean up previous user data listener
      if (unsubUserData) {
        unsubUserData();
        unsubUserData = null;
      }

      setUser(currentUser);
      setLoading(false); // Auth state is now determined
      console.log('[AuthProvider] auth loading finished', { user: !!currentUser });

      if (currentUser) {
        setDataLoading(true);
        // Start listening to user document in Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        unsubUserData = onSnapshot(
          userDocRef,
          (docSnap) => {
            console.log('[AuthProvider] userDoc snapshot received', { exists: docSnap.exists(), uid: currentUser.uid });
            if (docSnap.exists()) {
              const data = { uid: currentUser.uid, ...docSnap.data() } as UserData;
              setUserData(data);
              
              // Ensure existing users with tokens have the hasFcmToken flag correctly set
              syncFcmTokenFlag(currentUser.uid, data.hasFcmToken);
            } else {
              console.log('[AuthProvider] userDoc does not exist for uid', currentUser.uid);
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

  return (
    <AuthContext.Provider value={{ user, userData, loading, dataLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
};


