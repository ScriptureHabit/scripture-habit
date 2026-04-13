import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserData } from '../types/user';

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  error: Error | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    let unsubUserData: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      console.log(`[DEBUG] AuthContext: onAuthStateChanged fired. User: ${currentUser?.uid}, Email: ${currentUser?.email}`);
      setLoading(true); // Reset loading state when auth changes
      // Clean up previous user data listener
      if (unsubUserData) {
        unsubUserData();
        unsubUserData = null;
      }

      setUser(currentUser);

      if (currentUser) {
        // Start listening to user document in Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        unsubUserData = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              setUserData({ uid: currentUser.uid, ...docSnap.data() } as UserData);
            } else {
              setUserData(null);
            }
            setLoading(false);
          },
          (err) => {
            console.error('Error listening to user data:', err);
            // Ignore permission-denied errors that often happen during sign out, but ONLY in production
            if (err.code !== 'permission-denied' || !import.meta.env.PROD) {
              setError(err as Error);
            }
            setLoading(false);
          }
        );
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubUserData) unsubUserData();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
