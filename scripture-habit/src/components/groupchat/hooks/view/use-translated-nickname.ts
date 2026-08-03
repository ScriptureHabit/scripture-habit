import { useState, useEffect } from 'react';
import apiClient from '../../../../utils/api-client';
import { isLikelyAlreadyInLanguage, getCachedUserNickname, setCachedUserNickname } from '../../../../utils/language-utils';

/**
 * Custom hook for automatically translating member nicknames asynchronously
 * with local caching support. Follows React 19 best practices.
 */
export const useTranslatedNickname = (
  senderId: string | undefined,
  originalNickname: string,
  language: string
) => {
  const shouldTranslateNick = originalNickname && !isLikelyAlreadyInLanguage(originalNickname, language);
  const cached = shouldTranslateNick ? getCachedUserNickname(senderId || '', language, originalNickname) : null;

  const [asyncNickname, setAsyncNickname] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldTranslateNick || cached) return;

    let active = true;
    apiClient.post('/api/ai/translate', {
      text: originalNickname,
      targetLanguage: language,
      updateType: 'user_nickname'
    }).then(res => {
      if (active && res.data?.translatedText) {
        const result = res.data.translatedText;
        setAsyncNickname(result);
        setCachedUserNickname(senderId || '', language, originalNickname, result);
      }
    }).catch(e => console.error('Failed to translate nickname in message item:', e));

    return () => {
      active = false;
    };
  }, [senderId, originalNickname, shouldTranslateNick, cached, language]);

  if (!shouldTranslateNick) return originalNickname;
  if (cached) return cached;
  return asyncNickname || originalNickname;
};
