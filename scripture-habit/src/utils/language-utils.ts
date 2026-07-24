/**
 * Helper to skip translation for texts (messages or nicknames) already in the target language.
 */
export const isLikelyAlreadyInLanguage = (text: string, targetLang: string): boolean => {
  if (!text) return true;
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  const hasKorean = /[\uAC00-\uD7A3\u3130-\u318F]/.test(text);
  const hasThai = /[\u0E00-\u0E7F]/.test(text);
  const hasChinese = /[\u4E00-\u9FFF]/.test(text);

  if (targetLang === 'ja' && hasJapanese) return true;
  if (targetLang === 'ko' && hasKorean) return true;
  if (targetLang === 'th' && hasThai) return true;
  if (targetLang === 'zho' && hasChinese && !hasJapanese) return true;

  const isLatinBased = ['en', 'es', 'pt', 'tl', 'sw', 'vi'].includes(targetLang);
  if (isLatinBased && !hasJapanese && !hasKorean && !hasThai && /[a-zA-Z]/.test(text)) {
    return true;
  }

  return false;
};

/**
 * Simple string hash function to generate cache signatures and invalidate stale translations.
 */
export const getTranslationHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

/**
 * Retrieves the cached translated user nickname by checking the exact key with a content hash.
 */
export const getCachedUserNickname = (userId: string, language: string, originalNickname: string): string | null => {
  const hash = getTranslationHash(originalNickname);
  return sessionStorage.getItem(`trans_user_nick_${userId}_${language}_${hash}`);
};

/**
 * Saves a translated user nickname to the session cache with a content hash.
 */
export const setCachedUserNickname = (userId: string, language: string, originalNickname: string, translatedName: string) => {
  const hash = getTranslationHash(originalNickname);
  sessionStorage.setItem(`trans_user_nick_${userId}_${language}_${hash}`, translatedName);
};
