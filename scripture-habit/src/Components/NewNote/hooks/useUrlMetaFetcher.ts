import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { auth, appCheck } from '../../../firebase';
import { getToken } from 'firebase/app-check';

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
                    const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
                    
                    // Map app language to API lang
                    const LAN_MAP: Record<string, string> = { 'ja': 'jpn', 'en': 'eng', 'pt': 'por', 'es': 'spa', 'zho': 'zho', 'ko': 'kor', 'vi': 'vie', 'th': 'tha', 'tl': 'tgl', 'sw': 'swa' };
                    const apiLang = LAN_MAP[language] || 'eng';

                    let targetUrl = chapter;
                    if (!targetUrl.startsWith('http')) {
                        targetUrl = `https://www.churchofjesuschrist.org${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
                    }

                    const url = `${API_BASE}/api/fetch-church-metadata/?url=${encodeURIComponent(targetUrl)}&lang=${apiLang}`;

                    const headers: Record<string, string> = { 'Accept': 'application/json' };
                    
                    if (auth?.currentUser) {
                        try {
                            const idToken = await auth.currentUser.getIdToken();
                            headers['Authorization'] = `Bearer ${idToken}`;
                        } catch (e) { console.warn("[useUrlMetaFetcher] Auth token failed", e); }
                    }

                    if (appCheck) {
                        try {
                            const acToken = await getToken(appCheck, false);
                            if (acToken?.token) headers['X-Firebase-AppCheck'] = acToken.token;
                        } catch (e) { console.warn("[useUrlMetaFetcher] AppCheck token failed", e); }
                    }

                    const response = await fetch(url, { headers });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const data = await response.json();
                    if (data && data.title) {
                        setUrlMeta({
                            title: data.title,
                            speaker: data.speaker
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

