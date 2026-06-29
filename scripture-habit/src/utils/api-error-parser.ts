import axios from 'axios';

/**
 * Resolves a user-friendly error message from an Axios error or generic error,
 * using translation mappings if available.
 */
export function getApiErrorMessage(
  error: unknown,
  fallbackKey: string,
  t: (key: string) => string
): string {
  // 1. Detect Offline or Network connectivity issues
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const isNetworkError = axios.isAxiosError(error) && (error.message === 'Network Error' || error.code === 'ERR_NETWORK');

  if (isOffline || isNetworkError) {
    const translated = t('apiErrors.NETWORK_ERROR');
    if (translated !== 'apiErrors.NETWORK_ERROR') {
      return translated;
    }
    return 'Network error. Please check your internet connection.';
  }

  if (axios.isAxiosError(error) && error.response) {
    const data = error.response.data;
    if (data && typeof data === 'object') {
      const dataObj = data as Record<string, unknown>;
      const code = dataObj.code;
      if (code && typeof code === 'string') {
        const translationKey = `apiErrors.${code}`;
        const translated = t(translationKey);
        
        // If localized translation for this code exists, return it
        if (translated !== translationKey) {
          return translated;
        }
      }
      const rawError = dataObj.error;
      if (rawError && typeof rawError === 'string') {
        return rawError;
      }
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return t(fallbackKey);
}
