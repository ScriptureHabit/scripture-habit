import { useState, useEffect } from 'react';

/**
 * A hook that returns the current date string (YYYY-MM-DD) 
 * and updates it automatically when the day changes.
 * Default interval is 60 seconds.
 */
export const useToday = (intervalMs: number = 60000) => {
  const getTodayStr = () => new Date().toLocaleDateString('sv-SE');
  
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
