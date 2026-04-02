import { ScriptureCategory, SCRIPTURE_CATEGORIES } from '../types/scripture';

export const DEFAULT_SCRIPTURE_CATEGORY: ScriptureCategory = 'Other';

export const normalizeSearchText = (text: string): string => {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ');
};

export const createSearchTokens = (text: string): string[] => {
  const normalized = normalizeSearchText(text);
  return Array.from(new Set(normalized.split(' ').filter(Boolean)));
};

export const normalizeScriptureCategory = (value: unknown): ScriptureCategory => {
  if (typeof value === 'string' && SCRIPTURE_CATEGORIES.includes(value as ScriptureCategory)) {
    return value as ScriptureCategory;
  }
  return DEFAULT_SCRIPTURE_CATEGORY;
};

export const buildNoteSearchTokens = (note: {
  scripture?: string;
  chapter?: string;
  comment?: string;
  title?: string | null;
  speaker?: string | null;
}) => {
  const parts = [note.scripture || '', note.chapter || '', note.comment || '', note.title || '', note.speaker || ''];
  return createSearchTokens(parts.join(' '));
};
