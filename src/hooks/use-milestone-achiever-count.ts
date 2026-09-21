import { useState, useEffect } from 'react';
import apiClient from '../utils/api-client';

// In-memory cache to avoid duplicate counts in the same session
const countCache: Record<number, number> = {};

export function useMilestoneAchieverCount(targetDays: number, enabled: boolean = true) {
  const isCached = targetDays > 0 && countCache[targetDays] !== undefined;
  const currentKey = enabled && targetDays > 0 ? `${targetDays}` : null;

  const [count, setCount] = useState<number | null>(countCache[targetDays] ?? null);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !targetDays || targetDays <= 0 || isCached) {
      return;
    }

    let isMounted = true;

    const fetchCount = async () => {
      try {
        const response = await apiClient.get('/api/auth/milestone-count', {
          params: { days: targetDays }
        });
        const total = typeof response.data?.count === 'number' ? response.data.count : null;

        if (total !== null) {
          countCache[targetDays] = total;
        }
        if (isMounted) {
          setCount(total);
          setResolvedKey(currentKey);
        }
      } catch (err) {
        console.warn('Failed to fetch milestone achiever count:', err);
        if (isMounted) {
          setCount(null);
          setResolvedKey(currentKey);
        }
      }
    };

    fetchCount();

    return () => {
      isMounted = false;
    };
  }, [targetDays, enabled, isCached, currentKey]);

  const effectiveCount = targetDays > 0 ? (countCache[targetDays] ?? count) : null;
  const loading = currentKey !== null && !isCached && resolvedKey !== currentKey;

  return {
    count: effectiveCount,
    loading,
    hasEnoughAchievers: effectiveCount !== null && effectiveCount >= 3
  };
}
