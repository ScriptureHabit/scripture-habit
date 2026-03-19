import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeStorage } from '../Utils/storage';
import { loadTranslations, loadBookTranslations } from '../locales/i18n';
import { identifyBookKey } from '../Utils/bookRefMapper';

// Static en for initial load/fallback
import enTranslations from '../locales/en';
import enBooks from '../locales/books/en';

export type Language = 'en' | 'ja' | 'pt' | 'zho' | 'es' | 'vi' | 'th' | 'ko' | 'tl' | 'sw';

export const SUPPORTED_LANGUAGES: Language[] = ['en', 'ja', 'pt', 'zho', 'es', 'vi', 'th', 'ko', 'tl', 'sw'];
const DEFAULT_LANGUAGE: Language = 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (newLanguage: Language) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
    tArray: (key: string) => string[];
    isLoaded: boolean;
    translateBookName: (bookName: string | null | undefined) => string;
    translateChapterField: (chapterText: string | null | undefined) => string;
    bookTranslations: Record<string, string>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// --- Helpers ---

const getLanguageFromPath = (pathname: string): Language | null => {
    const parts = pathname.split('/');
    const lang = parts[1] as Language;
    return SUPPORTED_LANGUAGES.includes(lang) ? lang : null;
};

const detectInitialLanguage = (): Language => {
    // 1. Path
    const pathLang = getLanguageFromPath(window.location.pathname);
    if (pathLang) return pathLang;

    // 2. Storage
    const saved = safeStorage.get('language') as Language;
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;

    // 3. Browser
    const browserLang = navigator.language?.split('-')[0].toLowerCase();
    if (browserLang === 'zh') return 'zho';
    if (SUPPORTED_LANGUAGES.includes(browserLang as Language)) return browserLang as Language;

    return DEFAULT_LANGUAGE;
};

interface LanguageProviderProps {
    children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const [language, setLanguageInternal] = useState<Language>(detectInitialLanguage);
    const [translations, setTranslations] = useState<any>(enTranslations);
    const [bookTranslations, setBookTranslations] = useState<any>(enBooks);
    const [isLoaded, setIsLoaded] = useState(false);

    // Sync state with URL changes (e.g., back button)
    useEffect(() => {
        const pathLang = getLanguageFromPath(location.pathname);
        if (pathLang && pathLang !== language) {
            setLanguageInternal(pathLang);
        }
    }, [location.pathname, language]);

    useEffect(() => {
        const load = async () => {
            setIsLoaded(false);
            try {
                if (language === 'en') {
                    setTranslations(enTranslations);
                    setBookTranslations(enBooks);
                    setIsLoaded(true);
                } else {
                    // Load BOTH together to ensure they stay in sync
                    const [trans, books] = await Promise.all([
                        loadTranslations(language),
                        loadBookTranslations(language)
                    ]);
                    
                    // Use functional updates to prevent stale state issues
                    setTranslations(trans);
                    setBookTranslations(books);
                    setIsLoaded(true);
                }
            } catch (error) {
                console.error('Failed to load translations for:', language, error);
                setTranslations(enTranslations);
                setBookTranslations(enBooks);
                setIsLoaded(true);
            }
        };
        load();
    }, [language]);

    const translateBookName = useCallback((bookName: string | null | undefined): string => {
        if (!bookName) return '';
        
        const langBooks = bookTranslations || enBooks;
        
        // Try current language
        if (langBooks[bookName]) {
            return langBooks[bookName];
        }

        // Try global identity map
        const englishKey = identifyBookKey(bookName);
        if ((langBooks as any)[englishKey]) return (langBooks as any)[englishKey];

        // Try English fallback
        if (language !== 'en') {
            if ((enBooks as any)[englishKey]) return (enBooks as any)[englishKey];
            if ((enBooks as any)[bookName]) {
                return (enBooks as any)[bookName];
            }
            const lowerKey = englishKey.toLowerCase();
            for (const [englishName, translatedName] of Object.entries(enBooks)) {
                if (englishName.toLowerCase() === lowerKey) {
                    return translatedName as string;
                }
            }
        }

        return bookName;
    }, [bookTranslations, language]);

    const translateChapterField = useCallback((chapterText: string | null | undefined): string => {
        if (!chapterText) return '';

        // Special handling for GC/BYU Speeches
        if (chapterText.includes('general-conference') || /^\d{4}\/\d{2}/.test(chapterText)) {
            const urlMatch = chapterText.match(/general-conference\/(\d{4})\/(\d{2})\/([^?#]+)/);
            if (urlMatch) return `${urlMatch[1]}/${urlMatch[2]}/${urlMatch[3]}`;

            const urlTocMatch = chapterText.match(/general-conference\/(\d{4})\/(\d{2})(?:[?#]|$)/);
            if (urlTocMatch) return `${urlTocMatch[1]}/${urlTocMatch[2]}`;
        }

        if (chapterText.includes('speeches.byu.edu')) {
            const byuMatch = chapterText.match(/speeches\.byu\.edu\/talks\/([^/]+)\/([^/]+)/);
            if (byuMatch) {
                const speaker = byuMatch[1].split('-').map(w => w.length === 1 ? w.toUpperCase() + '.' : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                const title = byuMatch[2].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                return `${title} (${speaker})`;
            }
        }

        const match = chapterText.match(/^((?:\d\s*)?[\p{L}\s—-]+)(?:\s+|(?=\d))(\d+(?::[\d\s,-]+)?)$/u);
        if (match) {
            const bookName = match[1].trim().replace(/—/g, '-');
            const chapterVerse = match[2];
            const translatedBook = translateBookName(bookName);
            return `${translatedBook} ${chapterVerse}`;
        }

        return translateBookName(chapterText);
    }, [translateBookName]);

    const setLanguage = useCallback((newLanguage: Language) => {
        if (!SUPPORTED_LANGUAGES.includes(newLanguage) || newLanguage === language) return;

        safeStorage.set('language', newLanguage);
        setLanguageInternal(newLanguage);

        // Update URL
        const pathParts = location.pathname.split('/');
        const currentPrefix = getLanguageFromPath(location.pathname);

        if (currentPrefix) {
            pathParts[1] = newLanguage;
        } else {
            pathParts.splice(1, 0, newLanguage);
        }

        const newPath = pathParts.join('/') || '/';
        const finalPath = newPath.endsWith('/') ? newPath : `${newPath}/`;
        
        navigate({
            pathname: finalPath,
            search: location.search,
            hash: location.hash
        }, { replace: true });
    }, [language, location, navigate]);

    const getValueFromPath = useCallback((key: string): any => {
        const keys = key.split('.');
        let current: any = translations;
        
        for (const k of keys) {
            if (current && current[k] !== undefined) {
                current = current[k];
            } else {
                if (language !== 'en') {
                    let enCurrent: any = enTranslations;
                    for (const ek of keys) {
                        if (enCurrent && enCurrent[ek] !== undefined) {
                            enCurrent = enCurrent[ek];
                        } else {
                            return null;
                        }
                    }
                    return enCurrent;
                }
                return null;
            }
        }
        return current;
    }, [language, translations]);

    const t = useCallback((key: string, replacements: Record<string, string | number> = {}): string => {
        const value = getValueFromPath(key);
        if (typeof value !== 'string') return key;

        let result = value;
        Object.entries(replacements).forEach(([k, v]) => {
            result = result.split(`{${k}}`).join(String(v));
        });
        
        return result;
    }, [getValueFromPath]);

    const tArray = useCallback((key: string): string[] => {
        const value = getValueFromPath(key);
        if (value === null) return [];
        return Array.isArray(value) ? value : [String(value)];
    }, [getValueFromPath]);

    const contextValue = useMemo(() => ({
        language,
        setLanguage,
        t,
        tArray,
        isLoaded,
        translateBookName,
        translateChapterField,
        bookTranslations
    }), [language, setLanguage, t, tArray, isLoaded, translateBookName, translateChapterField, bookTranslations]);

    return (
        <LanguageContext.Provider value={contextValue}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

