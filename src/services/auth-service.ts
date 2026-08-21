import { auth, appCheck } from '../firebase';
import { getToken } from 'firebase/app-check';

export const AuthService = {
  async getIdToken(): Promise<string | null> {
    return auth?.currentUser?.getIdToken() || null;
  },
  async getAppCheckToken(): Promise<string | null> {
    if (!appCheck) return null;
    try {
      const result = await getToken(appCheck);
      return result.token;
    } catch (err) {
      console.warn("Failed to get App Check token:", err);
      return null;
    }
  }
};
