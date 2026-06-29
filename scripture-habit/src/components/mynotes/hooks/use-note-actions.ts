import { auth, appCheck } from '../../../firebase';
import { getToken } from 'firebase/app-check';
import { Note } from '../../../types/note';
import { UserData } from '../../../types/user';

const API_BASE = '';

export const useNoteActions = (userData: UserData | null) => {
  const deleteNote = async (note: Note): Promise<boolean> => {
    if (!userData?.uid || !note?.id) return false;

    try {
      const user = auth?.currentUser;
      if (!user) throw new Error('No user logged in');

      const idToken = await user.getIdToken();
      let appCheckToken = '';
      if (appCheck) {
        try {
          const appCheckTokenResponse = await getToken(appCheck, false);
          appCheckToken = appCheckTokenResponse.token;
        } catch (e) {
          console.warn('[useNoteActions] AppCheck token failed:', e);
        }
      }

      const response = await fetch(`${API_BASE}/api/groups/delete-note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {})
        },
        body: JSON.stringify({ noteId: note.id })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to delete note');
      }

      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      return false;
    }
  };

  return { deleteNote };
};
