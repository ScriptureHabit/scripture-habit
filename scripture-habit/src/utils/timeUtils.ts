import { FirebaseTimestamp } from '../types/chat';

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
