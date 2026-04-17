import { useState, useEffect } from 'react';
import { formatDateInTimeZone } from '../utils/time-utils';

/**
 * A hook that returns the current date string (YYYY-MM-DD) 
 * and updates it automatically when the day changes.
 * Default interval is 60 seconds.
 */
export const useToday = (intervalMs: number = 60000) => {
  // Use UTC for the baseline 'today' string to avoid local machine drift,
  // since group-specific normalization handles timezones separately.
  const getTodayStr = () => formatDateInTimeZone(new Date(), 'UTC');
  
  const [today, setToday] = useState(getTodayStr());

  useEffect(() => {
    const timer = setInterval(() => {
      const current = getTodayStr();
      if (current !== today) {
        setToday(current);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [today, intervalMs]);

  return today;
};
