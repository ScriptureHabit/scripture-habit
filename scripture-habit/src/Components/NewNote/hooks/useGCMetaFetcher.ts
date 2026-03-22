import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { auth, appCheck } from '../../../firebase';
import { getToken } from 'firebase/app-check';

/**
 * Hook to fetch metadata for General Conference talks during note creation.
 */
export const useGCMetaFetcher = (chapter: string, scripture: string, language: string = 'en') => {
    const [gcMeta, setGcMeta] = useState<{ title: string; speaker?: string } | null>(null);
    const [gcLoading, setGcLoading] = useState(false);

    useEffect(() => {
        const fetchGcMeta = async () => {
            const isUrl = typeof chapter === 'string' && chapter.startsWith('http');
            if (isUrl && (scripture === 'General Conference' || scripture === 'BYU Speeches' || scripture === 'Other')) {
                setGcLoading(true);
                try {
                    const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
                    
                    // Map app language to API lang
                    const LAN_MAP: Record<string, string> = { 'ja': 'jpn', 'en': 'eng', 'pt': 'por', 'es': 'spa', 'zho': 'zho', 'ko': 'kor', 'vi': 'vie', 'th': 'tha', 'tl': 'tgl', 'sw': 'swa' };
                    const apiLang = LAN_MAP[language] || 'eng';

                    const url = `${API_BASE}/api/fetch-gc-metadata/?url=${encodeURIComponent(chapter)}&lang=${apiLang}`;

                    const headers: Record<string, string> = { 'Accept': 'application/json' };
                    
                    if (auth?.currentUser) {
                        try {
                            const idToken = await auth.currentUser.getIdToken();
                            headers['Authorization'] = `Bearer ${idToken}`;
                        } catch (e) { console.warn("[useGCMetaFetcher] Auth token failed", e); }
                    }

                    if (appCheck) {
                        try {
                            const acToken = await getToken(appCheck, false);
                            if (acToken?.token) headers['X-Firebase-AppCheck'] = acToken.token;
                        } catch (e) { console.warn("[useGCMetaFetcher] AppCheck token failed", e); }
                    }

                    const response = await fetch(url, { headers });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const data = await response.json();
                    if (data && data.title) {
                        setGcMeta({
                            title: data.title,
                            speaker: data.speaker
                        });
                    }
                } catch (error) {
                    console.error("Error fetching GC meta:", error);
                    setGcMeta(null);
                } finally {
                    setGcLoading(false);
                }
            } else {
                setGcMeta(null);
            }
        };

        const timer = setTimeout(fetchGcMeta, 500);
        return () => clearTimeout(timer);
    }, [chapter, scripture, language, auth?.currentUser?.uid]);

    return { gcMeta, gcLoading };
};

