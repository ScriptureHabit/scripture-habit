import { 
  FirestoreDataConverter, 
  QueryDocumentSnapshot, 
  SnapshotOptions,
  WithFieldValue,
  DocumentData
} from 'firebase/firestore';
import { z } from 'zod';
import { Group, Message } from '../types/chat';
import { Note } from '../types/note';
import { normalizeScriptureCategory, buildNoteSearchTokens } from './search-token-utils';
import { formatNoteText } from './note-logic';
import { 
  MessageSchema, 
  GroupSchema, 
  GroupMemberSchema 
} from '../types/schemas';

/**
 * Creates a generic, type-safe converter with optional Zod validation.
 */
const createConverter = <T extends { id?: string; uid?: string }>(
  idField: 'id' | 'uid' = 'id',
  schema?: z.ZodSchema
): FirestoreDataConverter<T> => ({
  toFirestore(data: WithFieldValue<T>): DocumentData {
    // Basic scrubbing of the ID field before write
    const payload = { ...data } as Record<string, unknown>;
    delete payload[idField];
    return payload as DocumentData;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
    // 1. Get raw data
    const rawData = snapshot.data(options);
    
    // 2. Normalize basic metadata
    const baseData = {
      ...rawData,
      [idField]: snapshot.id,
    };

    // 3. Optional Strict Validation (Zod)
    // If a schema is provided, we parse it. If it fails, we log + fallback to raw data
    // so a single bad document doesn't crash the entire Firestore onSnapshot listener.
    let validatedData: Record<string, unknown>;
    if (schema) {
      try {
        validatedData = schema.parse(baseData) as Record<string, unknown>;
      } catch (err) {
        console.warn('[firestoreConverter] Schema parse failed for doc:', snapshot.id, 'falling back to raw data:', err);
        validatedData = baseData as Record<string, unknown>;
      }
    } else {
      validatedData = baseData as Record<string, unknown>;
    }

    // 4. Custom Transformations (Legacy/Migration logic)
    const scripture = normalizeScriptureCategory(validatedData.scripture);
    const title = typeof validatedData.title === 'string' ? validatedData.title : null;
    const speaker = typeof validatedData.speaker === 'string' ? validatedData.speaker : null;
    const comment = typeof validatedData.comment === 'string' ? validatedData.comment : '';
    const chapter = typeof validatedData.chapter === 'string' ? validatedData.chapter : '';
    const text = typeof validatedData.text === 'string' && validatedData.text.trim() !== ''
      ? validatedData.text
      : formatNoteText(scripture, chapter, comment);
    
    // Build search tokens if they don't exist in DB (Legacy support)
    const searchTokens = Array.isArray(validatedData.searchTokens)
      ? (validatedData.searchTokens as unknown[]).filter((value): value is string => typeof value === 'string')
      : buildNoteSearchTokens({ 
          scripture, 
          chapter, 
          comment, 
          title, 
          speaker 
        });

    return {
      ...validatedData,
      scripture,
      chapter,
      comment,
      text,
      searchTokens,
    } as unknown as T;
  }
});

// Primary Converters with Strict Validation
export const groupConverter = createConverter<Group>('id', GroupSchema);
export const messageConverter = createConverter<Message>('id', MessageSchema);
export const noteConverter = createConverter<Note>('id'); // NoteSchema could be added next
export const groupMemberConverter = createConverter<import('../../types/firestore').GroupMemberDocument>('uid', GroupMemberSchema);

