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
    // Explicitly use en-GB as it defaults to numeric day/month
    const formatter = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: timeZone
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;

    if (!year || !month || !day) {
      return date.toISOString().split('T')[0];
    }

    return `${year}-${month}-${day}`;
  } catch {
    return date.toISOString().split('T')[0];
  }
};

/**
 * Normalizes a date-like input into a strictly numeric YYYYMMDD string.
 */
export const normalizeDateString = (dateInput: string | Date | { toDate: () => Date } | null | undefined): string => {
  if (!dateInput) return '';

  try {
    // Handle Date objects
    if (dateInput instanceof Date) {
      return normalizeDateString(formatDateInTimeZone(dateInput, 'UTC'));
    }

    // Handle Firestore Timestamps
    if (typeof dateInput === 'object' && 'toDate' in dateInput) {
      return normalizeDateString(dateInput.toDate());
    }

    // Handle strings (ISO or formatted)
    const str = String(dateInput);
    const digits = str.replace(/\D/g, '');
    
    // If it's a long timestamp string (e.g. ISO digits), just take the date part
    if (digits.length >= 8) {
      return digits.substring(0, 8);
    }
    
    return digits;
  } catch {
    return '';
  }
};
