import { useMemo } from 'react';
import { parseStructuredNoteText, ParsedNote } from '../../../utils/note-parser-utils';

export type { ParsedNote };

export const useNoteParser = (text: string, translatedText?: string, isTranslated: boolean = false): ParsedNote => {
    return useMemo(() => {
        return parseStructuredNoteText(text, translatedText, isTranslated);
    }, [text, translatedText, isTranslated]);
};
