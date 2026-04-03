import { useState, useEffect } from 'react';
import apiClient from '../../../utils/apiClient';
import { auth } from '../../../firebase';

/**
 * Hook to fetch metadata for Church URLs (GC, Liahona, etc.) during note creation.
 */
export const useUrlMetaFetcher = (chapter: string, scripture: string, language: string = 'en') => {
    const [urlMeta, setUrlMeta] = useState<{ title: string; speaker?: string } | null>(null);
    const [urlLoading, setUrlLoading] = useState(false);

    useEffect(() => {
        const fetchUrlMeta = async () => {
            const isUrl = typeof chapter === 'string' && (chapter.startsWith('http') || chapter.startsWith('/'));
            const isShortcode = typeof chapter === 'string' && /^\d{4}\/\d{2}/.test(chapter);
            
            if ((isUrl || isShortcode) && (scripture === 'General Conference' || scripture === 'BYU Speeches' || scripture === 'Other')) {
                setUrlLoading(true);
                try {
                    // Map app language to API lang
                    const LAN_MAP: Record<string, string> = { 'ja': 'jpn', 'en': 'eng', 'pt': 'por', 'es': 'spa', 'zho': 'zho', 'ko': 'kor', 'vi': 'vie', 'th': 'tha', 'tl': 'tgl', 'sw': 'swa' };
                    const apiLang = LAN_MAP[language] || 'eng';

                    let targetUrl = chapter;
                    if (!targetUrl.startsWith('http')) {
                        targetUrl = `https://www.churchofjesuschrist.org${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
                    }

                    const response = await apiClient.get(`/api/fetch-church-metadata`, {
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
    }, [chapter, scripture, language, auth?.currentUser?.uid]);

    return { urlMeta, urlLoading };
};
