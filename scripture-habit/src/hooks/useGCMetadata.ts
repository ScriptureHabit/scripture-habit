import { useState, useEffect } from 'react';
import { safeStorage } from '../Utils/storage';
import type { Language } from '../Context/LanguageContext';

export interface GCMetadata {
    title: string;
    speaker: string;
}

interface useGCMetadataResult {
    data: GCMetadata | null;
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
const memoryCache: Record<string, GCMetadata> = {};

/**
 * Hook to fetch and cache metadata (title, speaker) for General Conference talks.
 * Prioritizes memory cache, then localStorage, then API fetch.
 */
export const useGCMetadata = (
  urlOrSlug: string | null | undefined, 
  language: Language | string
): useGCMetadataResult => {
    const [data, setData] = useState<GCMetadata | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!urlOrSlug || !language) return;

        // Skip non-church URLs/slugs
        if (!urlOrSlug.startsWith('http') && !urlOrSlug.startsWith('/')) {
            return;
        }

        const cacheKey = `gc_meta_${language}_${urlOrSlug}`;

        // 1. Memory Cache
        if (memoryCache[cacheKey]) {
            setData(memoryCache[cacheKey]);
            return;
        }

        // 2. LocalStorage (using refactored safeStorage that handles JSON)
        const cached = safeStorage.get<GCMetadata>(cacheKey);
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
                
                const endpoint = isChurchUrl ? '/api/fetch-gc-metadata' : '/api/url-preview';
                const finalUrl = `${API_BASE}${endpoint}?url=${encodeURIComponent(targetUrl)}&lang=${apiLang}`;

                const response = await fetch(finalUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch metadata`);

                const result = await response.json();
                
                if (active) {
                    const meta: GCMetadata = {
                        title: result.title || '',
                        speaker: result.speaker || ''
                    };

                    // Update Caches
                    safeStorage.set(cacheKey, meta);
                    memoryCache[cacheKey] = meta;
                    setData(meta);
                }
            } catch (err: any) {
                console.error("useGCMetadata error:", err);
                if (active) setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchMetadata();
        return () => { active = false; };

    }, [urlOrSlug, language]);

    return { data, loading, error };
};
