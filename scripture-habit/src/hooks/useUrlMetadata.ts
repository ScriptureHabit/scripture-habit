import { useState, useEffect } from 'react';
import { safeStorage } from '../Utils/storage';
import type { Language } from '../Context/LanguageContext';
import { auth, appCheck } from '../firebase';
import { getToken } from 'firebase/app-check';

export interface UrlMetadata {
    title: string;
    speaker: string;
}

interface UseUrlMetadataResult {
    data: UrlMetadata | null;
    loading: boolean;
    error: Error | null;
}

// Map app language codes to Church API language parameters
const LANGUAGE_MAP: Record<string, string> = {
  'en': 'eng',
  'ja': 'jpn',
  'pt': 'por',
  'es': 'spa',
  'zho': 'zho',
  'vi': 'vie',
  'th': 'tha',
  'ko': 'kor',
  'tl': 'tgl',
  'sw': 'swa'
};

// Internal memory cache to avoid unnecessary I/O
const memoryCache: Record<string, UrlMetadata> = {};

/**
 * Hook to fetch and cache metadata (title, speaker) for URLs.
 * Prioritizes memory cache, then localStorage, then API fetch.
 */
export const useUrlMetadata = (
  urlOrSlug: string | null | undefined, 
  language: Language | string
): UseUrlMetadataResult => {
    const [data, setData] = useState<UrlMetadata | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!urlOrSlug || !language) return;

        // Support full URLs, internal paths, and Church shortcodes (e.g., 2024/04/...)
        const isUrl = urlOrSlug.startsWith('http') || urlOrSlug.startsWith('/');
        const isShortcode = /^\d{4}\/\d{2}/.test(urlOrSlug);

        if (!isUrl && !isShortcode) {
            return;
        }

        const cacheKey = `url_meta_${language}_${urlOrSlug}`;

        // 1. Memory Cache
        if (memoryCache[cacheKey]) {
            setData(memoryCache[cacheKey]);
            return;
        }

        // 2. LocalStorage (using refactored safeStorage that handles JSON)
        const cached = safeStorage.get<UrlMetadata>(cacheKey);
        if (cached) {
            memoryCache[cacheKey] = cached;
            setData(cached);
            return;
        }

        // 3. API Fetch
        let active = true;
        const fetchMetadata = async () => {
            setLoading(true);
            setError(null);

            try {
                let targetUrl = urlOrSlug;
                if (!targetUrl.startsWith('http')) {
                    targetUrl = `https://www.churchofjesuschrist.org${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
                }

                const isChurchUrl = targetUrl.includes('churchofjesuschrist.org') || targetUrl.includes('general-conference');
                const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://scripturehabit.app';
                const apiLang = LANGUAGE_MAP[language] || 'eng';
                
                const endpoint = isChurchUrl ? '/api/fetch-church-metadata' : '/api/url-preview';
                
                // Ensure no double slashes or unintentional trailing slash before query
                const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
                const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
                const finalUrl = `${baseUrl}${path}?url=${encodeURIComponent(targetUrl)}&lang=${apiLang}`;

                // --- Security Headers (Auth & AppCheck) ---
                const headers: Record<string, string> = {
                    'Accept': 'application/json'
                };

                // 1. Add Firebase Auth Token
                if (auth?.currentUser) {
                    try {
                        const idToken = await auth.currentUser.getIdToken();
                        headers['Authorization'] = `Bearer ${idToken}`;
                    } catch (e) {
                        console.warn("[useUrlMetadata] Auth token acquisition failed:", e);
                    }
                }

                // 2. Add Firebase App Check Token
                if (appCheck) {
                    try {
                        const acToken = await getToken(appCheck, false);
                        if (acToken?.token) {
                            headers['X-Firebase-AppCheck'] = acToken.token;
                        }
                    } catch (e) {
                        console.warn("[useUrlMetadata] AppCheck token acquisition failed:", e);
                    }
                }

                // Debug log (only in dev/localhost)
                if (window.location.hostname === 'localhost') {
                    console.log(`[useUrlMetadata] Requesting: ${finalUrl}`, {
                        hasAuth: !!headers['Authorization'],
                        hasAppCheck: !!headers['X-Firebase-AppCheck']
                    });
                }

                const response = await fetch(finalUrl, { headers });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: Failed to fetch metadata`);
                }

                const result = await response.json();
                
                if (active) {
                    const meta: UrlMetadata = {
                        title: result.title || '',
                        speaker: result.speaker || ''
                    };

                    // Update Caches
                    safeStorage.set(cacheKey, meta);
                    memoryCache[cacheKey] = meta;
                    setData(meta);
                }
            } catch (err: any) {
                console.error("useUrlMetadata error:", err);
                if (active) setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchMetadata();
        return () => { active = false; };

    }, [urlOrSlug, language, auth?.currentUser?.uid]);


    return { data, loading, error };
};
