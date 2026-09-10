import { useState, useEffect } from 'react';
import apiClient from '../../../utils/api-client';
import { auth } from '../../../firebase';
import { getLdsLanguageCode } from '../../../config/languages';
import { safeStorage } from '../../../utils/storage';

interface UrlMeta {
    title: string;
    speaker?: string;
}

const memoryCache: Record<string, UrlMeta> = {};

/**
 * Hook to fetch metadata for Church URLs (GC, Liahona, etc.) or external URLs during note creation.
 */
export const useUrlMetaFetcher = (chapter: string, scripture: string, language: string = 'en') => {
    const [urlMeta, setUrlMeta] = useState<UrlMeta | null>(null);
    const [urlLoading, setUrlLoading] = useState(false);
    const currentUserUid = auth?.currentUser?.uid;

    useEffect(() => {
        let active = true;
        const fetchUrlMeta = async () => {
            const isUrl = typeof chapter === 'string' && (chapter.startsWith('http') || chapter.startsWith('/'));
            const isShortcode = typeof chapter === 'string' && /^\d{4}\/\d{2}/.test(chapter);
            
            if ((isUrl || isShortcode) && (scripture === 'General Conference' || scripture === 'BYU Speeches' || scripture === 'Other')) {
                let targetUrl = chapter;
                if (!targetUrl.startsWith('http')) {
                    targetUrl = `https://www.churchofjesuschrist.org${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
                }

                let parsedHost = '';
                try {
                    parsedHost = new URL(targetUrl).hostname.toLowerCase();
                } catch {
                    // Ignore invalid URLs
                }

                const isChurchUrl = parsedHost === 'churchofjesuschrist.org' || 
                                    parsedHost === 'www.churchofjesuschrist.org' || 
                                    parsedHost.endsWith('.churchofjesuschrist.org');

                const apiLang = getLdsLanguageCode(language);
                const cacheKey = `url_meta_${apiLang}_${targetUrl}`;

                const cached = memoryCache[cacheKey] || safeStorage.get<UrlMeta>(cacheKey);
                if (cached) {
                    memoryCache[cacheKey] = cached;
                    if (active) {
                        setUrlMeta(cached);
                        setUrlLoading(false);
                    }
                    return;
                }

                if (active) setUrlLoading(true);
                try {
                    const endpoint = isChurchUrl ? '/api/preview/fetch-church-metadata' : '/api/preview/url-preview';
                    const response = await apiClient.get(endpoint, {
                        params: {
                            url: targetUrl,
                            lang: apiLang
                        }
                    });

                    if (active && response.data && response.data.title) {
                        const meta: UrlMeta = {
                            title: response.data.title,
                            speaker: response.data.speaker || undefined
                        };
                        memoryCache[cacheKey] = meta;
                        safeStorage.set(cacheKey, meta);
                        setUrlMeta(meta);
                    }
                } catch (error) {
                    console.error("Error fetching content meta:", error);
                    if (active) setUrlMeta(null);
                } finally {
                    if (active) setUrlLoading(false);
                }
            } else {
                if (active) {
                    setUrlMeta(null);
                    setUrlLoading(false);
                }
            }
        };

        const timer = setTimeout(fetchUrlMeta, 500);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [chapter, scripture, language, currentUserUid]);

    return { urlMeta, urlLoading };
};

