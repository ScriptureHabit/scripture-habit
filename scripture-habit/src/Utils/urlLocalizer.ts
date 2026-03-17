/**
 * LDS.org (ChurchofJesusChrist.org) URL localizer.
 * Synchronizes the 'lang' parameter with the app's current language setting.
 */

const LDS_LANG_MAP: Record<string, string> = {
  'ja': 'jpn',
  'en': 'eng',
  'es': 'spa',
  'pt': 'por',
  'ko': 'kor',
  'zho': 'zho',
  'vi': 'vie',
  'th': 'tha',
  'tl': 'tgl',
  'sw': 'swa'
};

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
  const targetLang = LDS_LANG_MAP[langCode] || 'eng';

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
