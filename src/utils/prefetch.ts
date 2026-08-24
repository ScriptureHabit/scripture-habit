/**
 * Utility for intelligent route and component prefetching.
 * Respects user Data Saver preferences and avoids prefetching on 2G/slow networks.
 */

export const shouldPrefetch = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const conn = (navigator as unknown as {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;

  if (conn) {
    if (conn.saveData) return false;
    if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') return false;
  }
  return true;
};

const prefetchedCache = new Set<string>();

/**
 * Prefetches a dynamic import loader during idle time or user hover.
 * @param key Unique key identifying the chunk
 * @param loader Dynamic import factory function (e.g. () => import('./page'))
 */
export const prefetchComponent = (key: string, loader: () => Promise<unknown>): void => {
  if (!shouldPrefetch() || prefetchedCache.has(key)) return;
  prefetchedCache.add(key);

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(
      () => {
        void loader().catch(() => {
          prefetchedCache.delete(key); // Allow retry on failure
        });
      },
      { timeout: 4000 }
    );
  } else if (typeof window !== 'undefined') {
    setTimeout(() => {
      void loader().catch(() => {
        prefetchedCache.delete(key);
      });
    }, 100);
  }
};
