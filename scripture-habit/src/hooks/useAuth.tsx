import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Custom hook to track the current Firebase User.
 * Provides a simple way to access the authenticated user throughout the app.
 * 
 * @returns {User | null | undefined} 
 * - User: Authenticated user object
 * - null: Not authenticated
 * - undefined: Initial loading state
 */
export default function useAuth() {
  const [user, setUser] = useState<User | null | undefined>(auth?.currentUser ?? undefined);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      return;
    }

    // Subscribe to auth state changes
    const unsub = onAuthStateChanged(
      auth, 
      (u) => setUser(u),
      (err) => {
        console.error('Auth state change error:', err);
        setUser(null);
      }
    );

    return () => unsub();
  }, []);

  return user;
}
