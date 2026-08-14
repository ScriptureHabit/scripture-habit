import { useState, useEffect } from 'react';
import apiClient from '../../../utils/api-client';
import { auth } from '../../../firebase';
import { getLdsLanguageCode } from '../../../config/languages';

/**
 * Hook to fetch metadata for Church URLs (GC, Liahona, etc.) during note creation.
 */
export const useUrlMetaFetcher = (chapter: string, scripture: string, language: string = 'en') => {
    const [urlMeta, setUrlMeta] = useState<{ title: string; speaker?: string } | null>(null);
    const [urlLoading, setUrlLoading] = useState(false);
    const currentUserUid = auth?.currentUser?.uid;

    useEffect(() => {
        const fetchUrlMeta = async () => {
            const isUrl = typeof chapter === 'string' && (chapter.startsWith('http') || chapter.startsWith('/'));
            const isShortcode = typeof chapter === 'string' && /^\d{4}\/\d{2}/.test(chapter);
            
            if ((isUrl || isShortcode) && (scripture === 'General Conference' || scripture === 'BYU Speeches' || scripture === 'Other')) {
                setUrlLoading(true);
                try {
                    const apiLang = getLdsLanguageCode(language);

                    let targetUrl = chapter;
                    if (!targetUrl.startsWith('http')) {
                        targetUrl = `https://www.churchofjesuschrist.org${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
                    }

                    const response = await apiClient.get(`/api/preview/fetch-church-metadata`, {
                        params: {
                            url: targetUrl,
                            lang: apiLang
                        }
                    });

                    if (response.data && response.data.title) {
                        setUrlMeta({
                            title: response.data.title,
                            speaker: response.data.speaker
                        });
                    }
                } catch (error) {
                    console.error("Error fetching Church content meta:", error);
                    setUrlMeta(null);
                } finally {
                    setUrlLoading(false);
                }
            } else {
                setUrlMeta(null);
            }
        };

        const timer = setTimeout(fetchUrlMeta, 500);
        return () => clearTimeout(timer);
    }, [chapter, scripture, language, currentUserUid]);

    return { urlMeta, urlLoading };
};
