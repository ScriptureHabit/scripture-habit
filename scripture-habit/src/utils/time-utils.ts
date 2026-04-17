import { FirebaseTimestamp } from '../types/chat.js';

export const parseTimestampToDate = (ts?: FirebaseTimestamp | null): Date => {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
  if ('toDate' in ts && typeof ts.toDate === 'function') return ts.toDate();
  if ('seconds' in ts && typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  return new Date();
};

export const parseTimestampToMillis = (ts?: FirebaseTimestamp | null): number => {
  if (!ts) return Date.now(); // TRUTH: Default to current time for pending server timestamps
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts).getTime();
  
  if (typeof ts === 'object' && ts !== null) {
    if ('toMillis' in ts && typeof ts.toMillis === 'function') return ts.toMillis();
    if ('seconds' in ts && typeof ts.seconds === 'number') return ts.seconds * 1000;
  }
  
  return Date.now(); // TRUTH: Fallback to now to prevent UI jumps
};

export const formatDateInTimeZone = (date: Date, timeZone: string): string => {
  try {
    // We use Intl.DateTimeFormat with formatToParts to guarantee a consistent YYYY-MM-DD structure
    // regardless of the environment's default locale behavior for 'sv-SE'.
    const formatter = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone
    });

    const parts = formatter.formatToParts(date);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;

    if (y && m && d) {
      return `${y}-${m}-${d}`;
    }

    // Fallback if parts are missing
    return date.toLocaleDateString('sv-SE', { timeZone }).replace(/\//g, '-');
  } catch (e) {
    console.warn(`[timeUtils] formatDateInTimeZone failed for ${timeZone}, falling back to UTC ISO`, e);
    return date.toISOString().split('T')[0];
  }
};

/**
 * Strips all non-numeric characters from a date string.
 * This ensures that strings like "2026-04-17" and "2026/04/17" both become "20260417",
 * allowing for reliable numeric-like string comparison.
 */
export const normalizeDateString = (dateStr: string): string => {
  if (!dateStr) return '';
  return dateStr.replace(/\D/g, '');
};
