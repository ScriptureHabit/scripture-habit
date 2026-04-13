import { createContext } from 'react';
import { Language } from '../config/languages';

export interface LanguageContextType {
    language: Language;
    setLanguage: (newLanguage: Language) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
    tArray: (key: string) => string[];
    isLoaded: boolean;
    translateBookName: (bookName: string | null | undefined) => string;
    translateChapterField: (chapterText: string | null | undefined) => string;
    bookTranslations: Record<string, string>;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
