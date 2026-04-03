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

export const buildNoteSearchTokens = (note: {
  scripture?: string | null;
  chapter?: string | null;
  comment?: string | null;
  title?: string | null;
  speaker?: string | null;
}) => {
  const parts = [
    note.scripture || '',
    note.chapter || '',
    note.comment || '',
    note.title || '',
    note.speaker || ''
  ];
  return createSearchTokens(parts.join(' '));
};
