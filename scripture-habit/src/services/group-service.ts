import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Group } from '../types/chat';

export const GroupService = {
  subscribeUserGroups(
    userId: string,
    onUpdate: (groups: Group[]) => void,
    onError: (error: Error) => void
  ): () => void {
    const groupsQuery = query(
      collection(db, 'groups'),
      where('members', 'array-contains', userId)
    );

    return onSnapshot(
      groupsQuery,
      (snapshot) => {
        const fetchedGroups = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        } as Group));
        onUpdate(fetchedGroups);
      },
      onError
    );
  },
};
