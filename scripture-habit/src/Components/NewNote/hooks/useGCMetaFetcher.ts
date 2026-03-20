import { useState, useEffect } from 'react';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';

export const useGCMetaFetcher = (chapter: string, scripture: string) => {
    const [gcMeta, setGcMeta] = useState<{ title: string; speaker?: string } | null>(null);
    const [gcLoading, setGcLoading] = useState(false);

    useEffect(() => {
        const fetchGcMeta = async () => {
            const isUrl = typeof chapter === 'string' && chapter.startsWith('http');
            if (isUrl && (scripture === 'General Conference' || scripture === 'BYU Speeches' || scripture === 'Other')) {
                setGcLoading(true);
                try {
                    const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';
                    const response = await axios.post(`${API_BASE}/api/fetch-gc-meta`, { url: chapter });
                    if (response.data && response.data.title) {
                        setGcMeta({
                            title: response.data.title,
                            speaker: response.data.speaker
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
    }, [chapter, scripture]);

    return { gcMeta, gcLoading };
};
