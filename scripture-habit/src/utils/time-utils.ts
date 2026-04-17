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
    // sv-SE locale is known for its YYYY-MM-DD format (ISO 8601 style)
    // Most modern browsers and environments support the timeZone option in toLocaleDateString.
    // We also replace slashes with dashes just in case some browser uses YYYY/MM/DD for sv-SE.
    return date.toLocaleDateString('sv-SE', { timeZone }).replace(/\//g, '-');
  } catch (e) {
    console.warn(`[timeUtils] toLocaleDateString failed for ${timeZone}, falling back to UTC ISO string`, e);
    // Fallback for extremely old/limited environments
    const iso = date.toISOString(); // This is UTC
    return iso.split('T')[0];
  }
};

/**
 * Strips any non-numeric and non-dash characters from a date string.
 * Used to ensure consistency against hidden characters from Intl API.
 */
export const normalizeDateString = (dateStr: string): string => {
  return dateStr.replace(/[^\d-]/g, '');
};
