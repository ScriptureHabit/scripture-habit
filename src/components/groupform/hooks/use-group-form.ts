import { useState, useEffect } from 'react';
import { auth } from '../../../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { GroupService } from '../../../services/group-service';

export function useGroupForm() {
  const [user, setUser] = useState<User | null>(auth?.currentUser || null);
  const [hasExistingFamilyGroup, setHasExistingFamilyGroup] = useState(false);

  useEffect(() => {
    if (!auth) return;

    let unsubGroups: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.uid) {
        unsubGroups = GroupService.subscribeUserGroups(
          currentUser.uid,
          (groups) => {
            const hasFam = groups.some((g) => g.isFamilySyncEnabled && !g.isDeleted);
            setHasExistingFamilyGroup(hasFam);
          },
          (err) => {
            if ((err as { code?: string })?.code !== 'permission-denied') {
              console.error("[GroupForm] Failed to subscribe user groups:", err);
            }
          }
        );
      } else {
        setHasExistingFamilyGroup(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubGroups) unsubGroups();
    };
  }, []);

  return {
    user,
    hasExistingFamilyGroup
  };
}
