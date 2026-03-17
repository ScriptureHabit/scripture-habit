/**
 * type-safe localStorage wrapper with error handling for private modes or full storage.
 */
export const safeStorage = {
  /**
   * Retrieves an item from localStorage and optionally parses it as JSON.
   */
  get: <T = string>(key: string, defaultValue: T | null = null): T | null => {
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return defaultValue;

      // Try to parse as JSON, if it fails, return as string (if T permits)
      try {
        return JSON.parse(item) as T;
      } catch {
        return item as unknown as T;
      }
    } catch (e) {
      console.warn(`localStorage.get failed for key "${key}":`, e);
      return defaultValue;
    }
  },

  /**
   * Sets an item in localStorage. Objects are automatically stringified.
   */
  set: (key: string, value: any): boolean => {
    try {
      const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
      window.localStorage.setItem(key, valueToStore);
      return true;
    } catch (e) {
      console.warn(`localStorage.set failed for key "${key}":`, e);
      return false;
    }
  },

  /**
   * Removes an item from localStorage.
   */
  remove: (key: string): boolean => {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn(`localStorage.remove failed for key "${key}":`, e);
      return false;
    }
  },

  /**
   * Clears all items from localStorage.
   */
  clear: (): void => {
    try {
      window.localStorage.clear();
    } catch (e) {
      console.warn('localStorage.clear failed:', e);
    }
  }
};
