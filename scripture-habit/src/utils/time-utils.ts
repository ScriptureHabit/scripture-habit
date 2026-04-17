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
 * Normalizes a date string to a purely numeric representation (YYYYMMDD)
 * for safe lexicographical comparison. Handles strings and potentially 
 * Timestamp-like objects by converting to string first.
 */
export const normalizeDateString = (dateInput: string | Date | { toDate: () => Date } | null | undefined): string => {
  if (!dateInput) return '';
  
  // Handle Firestore Timestamp or Date objects if passed directly
  if (dateInput && typeof dateInput === 'object') {
    if ('toDate' in dateInput && typeof dateInput.toDate === 'function') {
      // It's a Firestore Timestamp
      return normalizeDateString(formatDateInTimeZone(dateInput.toDate(), 'UTC'));
    }
    if (dateInput instanceof Date) {
      return normalizeDateString(formatDateInTimeZone(dateInput, 'UTC'));
    }
  }

  const str = String(dateInput);
  return str.replace(/\D/g, '');
};
