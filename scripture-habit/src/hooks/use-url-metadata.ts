import { useState, useEffect } from 'react';
import { safeStorage } from '../utils/storage';
import type { Language } from '../context/language-context';
import { auth } from '../firebase';
import apiClient from '../utils/api-client';

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
    const currentUserUid = auth?.currentUser?.uid;

    useEffect(() => {
        if (!urlOrSlug || !language || !auth?.currentUser) return;

        // Support full URLs, internal paths, and Church shortcodes (e.g., 2024/04/...)
        const isUrl = urlOrSlug.startsWith('http') || urlOrSlug.startsWith('/');
        const isShortcode = /^\d{4}\/\d{2}/.test(urlOrSlug);

        if (!isUrl && !isShortcode) {
            return;
        }

        const cacheKey = `url_meta_${language}_${urlOrSlug}`;

        // 1. Memory Cache & LocalStorage
        const cached = memoryCache[cacheKey] || safeStorage.get<UrlMetadata>(cacheKey);
        if (cached) {
            memoryCache[cacheKey] = cached;
            // Use queueMicrotask to ensure state update doesn't trigger synchronous effect warning
            queueMicrotask(() => {
                setData(cached);
            });
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
                const apiLang = LANGUAGE_MAP[language] || 'eng';
                
                const endpoint = isChurchUrl ? '/api/preview/fetch-church-metadata' : '/api/preview/url-preview';
                
                // Debug log (only in dev/localhost)
                if (window.location.hostname === 'localhost') {
                    console.log(`[useUrlMetadata] Requesting: ${endpoint}?url=${encodeURIComponent(targetUrl)}&lang=${apiLang}`);
                }

                const response = await apiClient.get(endpoint, {
                    params: {
                        url: targetUrl,
                        lang: apiLang
                    }
                });
                
                const result = response.data;
                
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
            } catch (err: unknown) {
                console.error("useUrlMetadata error:", err);
                if (active) setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchMetadata();
        return () => { active = false; };

    }, [urlOrSlug, language, currentUserUid]);


    return { data, loading, error };
};
