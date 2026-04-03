import { ScriptureCategory, SCRIPTURE_CATEGORIES } from '../types/scripture';

export const DEFAULT_SCRIPTURE_CATEGORY: ScriptureCategory = 'Other';

export const normalizeSearchText = (text: string): string => {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ');
};

export const createSearchTokens = (text: string, maxTokens = 500): string[] => {
  const normalized = normalizeSearchText(text);
  const words = normalized.split(' ').filter(Boolean);
  const tokens = new Set<string>();

  // Add full words as tokens
  for (const word of words) {
    tokens.add(word);
    if (tokens.size >= maxTokens) break;
  }

  // Add bigrams for better partial matching (especially for Japanese)
  if (tokens.size < maxTokens) {
    for (const word of words) {
      if (word.length > 1) {
        for (let i = 0; i < word.length - 1; i++) {
          tokens.add(word.substring(i, i + 2));
          if (tokens.size >= maxTokens) break;
        }
      }
      if (tokens.size >= maxTokens) break;
    }
  }

  return Array.from(tokens);
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
  const comment = note.comment || '';
  // Limit comment to 500 chars for indexing to prevent document bloat
  const indexedComment = comment.length > 500 ? comment.substring(0, 500) : comment;
  const parts = [
    note.scripture || '', 
    note.chapter || '', 
    indexedComment, 
    note.title || '', 
    note.speaker || ''
  ];
  return createSearchTokens(parts.join(' '));
};
