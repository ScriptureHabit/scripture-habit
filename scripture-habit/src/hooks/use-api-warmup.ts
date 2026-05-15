import { useEffect } from 'react';

const API_BASE = ''; // Always use relative paths on web to support proxy/emulator
const WARMUP_INTERVAL_MS = 8 * 60 * 1000; // 8 minutes (Vercel idles after ~10 min)
const IS_PROD = import.meta.env.PROD;

/**
 * Keeps the Vercel Serverless Function warm to prevent cold start delays.
 * Pings /api/health on mount and periodically to avoid the ~10-min idle timeout.
 * This is a free alternative to paid "always-on" instances.
 * Only runs in production to avoid noise during local development.
 */
export function useApiWarmup() {
    useEffect(() => {
        // Only warm up in production — the local API server may not be running
        if (!IS_PROD) return;

        const warmup = () => {
            fetch(`${API_BASE}/api/health`, {
                method: 'GET',
                // Low priority so it doesn't compete with real requests
                // Cast is needed because 'priority' is not yet in all TS lib typings
                ...(({ priority: 'low' }) as Record<string, string>),
            }).catch(() => {
                // Silently ignore — this is best-effort only
            });
        };

        // Warm up immediately on mount (after a short delay to not compete with auth)
        const initialTimer = setTimeout(warmup, 3000);

        // Keep warm periodically
        const intervalTimer = setInterval(warmup, WARMUP_INTERVAL_MS);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(intervalTimer);
        };
    }, []);
}

