/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { translations } from '../Data/Translations.js';
import { safeStorage } from '../Utils/storage';

export type Language = 'en' | 'ja' | 'pt' | 'zho' | 'es' | 'vi' | 'th' | 'ko' | 'tl' | 'sw';

interface LanguageContextType {
    language: Language;
    setLanguage: (newLanguage: Language) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
    tArray: (key: string) => string[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const SUPPORTED_LANGUAGES: Language[] = ['en', 'ja', 'pt', 'zho', 'es', 'vi', 'th', 'ko', 'tl', 'sw'];

interface LanguageProviderProps {
    children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
    const navigate = useNavigate();
    
    // Helper to get initial language
    const getInitialLanguage = (): Language => {
        // 1. Check URL path
        const pathParts = window.location.pathname.split('/');
        const urlLang = pathParts[1] as Language;
        if (SUPPORTED_LANGUAGES.includes(urlLang)) {
            return urlLang;
        }

        // 2. Check localStorage
        const saved = safeStorage.get('language') as Language;
        if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;

        // 3. Auto-detect browser language
        const browserLang = navigator.language;
        const shortLang = browserLang ? browserLang.split('-')[0].toLowerCase() : 'en';

        if (shortLang === 'zh') return 'zho'; // Map Chinese
        if (SUPPORTED_LANGUAGES.includes(shortLang as Language)) return shortLang as Language;

        return 'en';
    };

    const [language, setLanguageState] = useState<Language>(getInitialLanguage);

    // Sync language with URL if it changes via something other than setLanguage (e.g. back button)
    useEffect(() => {
        const handlePathChange = () => {
            const pathParts = window.location.pathname.split('/');
            const urlLang = pathParts[1] as Language;
            if (SUPPORTED_LANGUAGES.includes(urlLang) && urlLang !== language) {
                setLanguageState(urlLang);
            }
        };

        window.addEventListener('popstate', handlePathChange);
        return () => window.removeEventListener('popstate', handlePathChange);
    }, [language]);

    // Wrapper to save to localStorage and optionally update URL
    const setLanguage = React.useCallback((newLanguage: Language) => {
        if (!SUPPORTED_LANGUAGES.includes(newLanguage)) return;

        safeStorage.set('language', newLanguage);
        setLanguageState(newLanguage);

        // Update URL to include language prefix if not already there
        const pathParts = window.location.pathname.split('/');
        const currentPrefix = pathParts[1] as Language;

        if (SUPPORTED_LANGUAGES.includes(currentPrefix)) {
            pathParts[1] = newLanguage;
        } else {
            pathParts.splice(1, 0, newLanguage);
        }

        let newPath = pathParts.join('/') || '/';
        if (!newPath.endsWith('/')) {
            newPath += '/';
        }
        navigate(newPath + window.location.search);
    }, [navigate]);

    const t = React.useCallback((key: string, replacements: Record<string, string | number> = {}): string => {
        const keys = key.split('.');
        let value = (translations as any)[language];
        for (const k of keys) {
            if (value && value[k] !== undefined) {
                value = value[k];
            } else {
                return key; // Return key if translation not found
            }
        }

        // Handle variable replacement
        if (typeof value === 'string' && replacements) {
            let result = value;
            Object.keys(replacements).forEach(replaceKey => {
                result = result.replace(`{${replaceKey}}`, replacements[replaceKey].toString());
            });
            return result;
        }

        return typeof value === 'string' ? value : key;
    }, [language]);

    // Separate function for array-type translations (e.g. randomized placeholders)
    const tArray = React.useCallback((key: string): string[] => {
        const keys = key.split('.');
        let value = (translations as any)[language];
        for (const k of keys) {
            if (value && value[k] !== undefined) {
                value = value[k];
            } else {
                return [];
            }
        }
        return Array.isArray(value) ? value : [String(value)];
    }, [language]);

    const contextValue = React.useMemo(() => ({
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
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
