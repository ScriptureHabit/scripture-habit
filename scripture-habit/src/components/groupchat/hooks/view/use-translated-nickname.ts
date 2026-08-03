import { useState, useEffect } from 'react';
import apiClient from '../../../../utils/api-client';
import { isLikelyAlreadyInLanguage, getCachedUserNickname, setCachedUserNickname } from '../../../../utils/language-utils';

/**
 * Custom hook for automatically translating member nicknames asynchronously
 * with local caching support.
 */
export const useTranslatedNickname = (
  senderId: string | undefined,
  originalNickname: string,
  language: string
) => {
  const shouldTranslateNick = originalNickname && !isLikelyAlreadyInLanguage(originalNickname, language);
  const [displayNickname, setDisplayNickname] = useState(originalNickname);

  useEffect(() => {
    if (!shouldTranslateNick) {
      setDisplayNickname(originalNickname);
      return;
    }

    const cached = getCachedUserNickname(senderId || '', language, originalNickname);
    if (cached) {
      setDisplayNickname(cached);
    } else {
      let active = true;
      apiClient.post('/api/ai/translate', {
        text: originalNickname,
        targetLanguage: language,
        updateType: 'user_nickname'
      }).then(res => {
        if (active && res.data?.translatedText) {
          const result = res.data.translatedText;
          setDisplayNickname(result);
          setCachedUserNickname(senderId || '', language, originalNickname, result);
        }
      }).catch(e => console.error('Failed to translate nickname in message item:', e));

      return () => {
        active = false;
      };
    }
  }, [senderId, originalNickname, shouldTranslateNick, language]);

  return displayNickname;
};
