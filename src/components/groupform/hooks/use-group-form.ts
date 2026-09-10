import { useState, useEffect } from 'react';
import { auth } from '../../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export function useGroupForm() {
  const [user, setUser] = useState<User | null>(auth?.currentUser || null);

  useEffect(() => {
    if (!auth) return;

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => {
      unsubAuth();
    };
  }, []);

  return {
    user
  };
}
