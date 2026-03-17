/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { translations } from '../Data/Translations.js';
import { safeStorage } from '../Utils/storage';

export type Language = 'en' | 'ja' | 'pt' | 'zho' | 'es' | 'vi' | 'th' | 'ko' | 'tl' | 'sw';

export const SUPPORTED_LANGUAGES: Language[] = ['en', 'ja', 'pt', 'zho', 'es', 'vi', 'th', 'ko', 'tl', 'sw'];
const DEFAULT_LANGUAGE: Language = 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (newLanguage: Language) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
    tArray: (key: string) => string[];
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

    // Sync state with URL changes (e.g., back button)
    useEffect(() => {
        const pathLang = getLanguageFromPath(location.pathname);
        if (pathLang && pathLang !== language) {
            setLanguageInternal(pathLang);
        }
    }, [location.pathname, language]);

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
        let current: any = (translations as any)[language];
        
        for (const k of keys) {
            if (current && current[k] !== undefined) {
                current = current[k];
            } else {
                return null;
            }
        }
        return current;
    }, [language]);

    const t = useCallback((key: string, replacements: Record<string, string | number> = {}): string => {
        const value = getValueFromPath(key);
        
        if (typeof value !== 'string') return key;

        let result = value;
        Object.entries(replacements).forEach(([k, v]) => {
            // Global replacement
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
        tArray
    }), [language, setLanguage, t, tArray]);

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
