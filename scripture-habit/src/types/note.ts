import { Timestamp } from 'firebase/firestore';
import { ScriptureCategory } from './scripture';

/**
 * Represents a study note or scripture entry.
 */
export interface Note {
  id: string;
  text?: string;
  chapter?: string;
  scripture?: ScriptureCategory;
  comment?: string;
  title?: string;
  speaker?: string;
  createdAt?: Timestamp | string | number | Date;
  
  // Mapping of group IDs to the message ID where this note was shared
  sharedMessageIds?: Record<string, string>;
  
  imageUrl?: string;
  recap?: string; // AI generated recap for the note
  ponderQuestion?: string; // AI generated ponder question
  searchTokens?: string[];
}
