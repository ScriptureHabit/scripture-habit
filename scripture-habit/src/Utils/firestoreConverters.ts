import { 
  FirestoreDataConverter, 
  QueryDocumentSnapshot, 
  SnapshotOptions,
  WithFieldValue,
  DocumentData
} from 'firebase/firestore';
import { UserData } from '../types/user';
import { Group, Message } from '../types/chat';
import { Note } from '../types/note';
import { normalizeScriptureCategory, buildNoteSearchTokens } from './searchTokenUtils';

/**
 * Creates a generic converter that ensures the ID is included in the object
 * and provides basic type safety for Firestore operations.
 */
const createConverter = <T extends { id?: string; uid?: string }>(
  idField: 'id' | 'uid' = 'id'
): FirestoreDataConverter<T> => ({
  toFirestore(data: WithFieldValue<T>): DocumentData {
    // Remove the ID field from the data being sent to Firestore
    const payload = { ...data } as Record<string, unknown>;
    delete payload[idField];
    return payload as DocumentData;
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
    const data = snapshot.data(options) as Record<string, unknown>;
    const scripture = normalizeScriptureCategory(data.scripture);
    const title = typeof data.title === 'string' ? data.title : null;
    const speaker = typeof data.speaker === 'string' ? data.speaker : null;
    const comment = typeof data.comment === 'string' ? data.comment : '';
    const searchTokens = Array.isArray(data.searchTokens)
      ? data.searchTokens.filter((value): value is string => typeof value === 'string')
      : buildNoteSearchTokens({ scripture, chapter: typeof data.chapter === 'string' ? data.chapter : '', comment, title, speaker });

    const convertedData = {
      ...data,
      [idField]: snapshot.id,
      scripture,
      searchTokens,
    } as const;

    return convertedData as unknown as T;
  }
});

export const userConverter = createConverter<UserData>('uid');
export const groupConverter = createConverter<Group>('id');
export const messageConverter = createConverter<Message>('id');
export const noteConverter = createConverter<Note>('id');
export const groupMemberConverter = createConverter<import('../../types/firestore').GroupMemberDocument>('uid');

/**
 * Helper to add a converter to a collection reference
 */
export const withConverter = <T extends { id?: string; uid?: string }>(
  idField: 'id' | 'uid' = 'id'
) => createConverter<T>(idField);
