import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';

// In-memory cache to avoid duplicate counts in the same session
const countCache: Record<number, number> = {};

export function useMilestoneAchieverCount(targetDays: number) {
  const [count, setCount] = useState<number | null>(countCache[targetDays] ?? null);
  const [loading, setLoading] = useState<boolean>(!countCache[targetDays] && targetDays > 0);

  useEffect(() => {
    if (!targetDays || targetDays <= 0 || countCache[targetDays] !== undefined) {
      return;
    }

    let isMounted = true;

    const fetchCount = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('daysStudiedCount', '>=', targetDays));
        const snapshot = await getCountFromServer(q);
        const total = snapshot.data().count;

        countCache[targetDays] = total;
        if (isMounted) {
          setCount(total);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to fetch milestone achiever count:', err);
        if (isMounted) {
          setCount(null);
          setLoading(false);
        }
      }
    };

    fetchCount();

    return () => {
      isMounted = false;
    };
  }, [targetDays]);

  const effectiveCount = targetDays > 0 ? (countCache[targetDays] ?? count) : null;

  return {
    count: effectiveCount,
    loading,
    hasEnoughAchievers: effectiveCount !== null && effectiveCount >= 3
  };
}
