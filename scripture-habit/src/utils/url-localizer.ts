import { getLdsLanguageCode } from '../config/languages';

/**
 * Replaces or adds the language parameter in a Church URL.
 * Example: lang=jpn -> lang=eng
 * 
 * @param url The original URL string
 * @param langCode The current app language code (e.g. 'ja', 'en')
 * @returns The localized URL string
 */
export const localizeLdsUrl = (url: string | null | undefined, langCode: string): string | null | undefined => {
  if (!url) return url;

  // Map app lang code to LDS lang parameter
  const targetLang = getLdsLanguageCode(langCode);

  try {
    const urlObj = new URL(url);
    
    // Only process URLs that already have a lang param or are from church domains
    if (url.includes('lang=') || urlObj.hostname.includes('churchofjesuschrist.org')) {
      urlObj.searchParams.set('lang', targetLang);
      return urlObj.toString();
    }
    
    return url;
  } catch {
    // If and not a valid absolute URL, try basic string replacement
    if (url.includes('lang=')) {
      return url.replace(/lang=[a-z]{3}/, `lang=${targetLang}`);
    }
    return url;
  }
};
