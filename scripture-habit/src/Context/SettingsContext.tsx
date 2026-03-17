/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { safeStorage } from '../Utils/storage';

export type FontSize = 'small' | 'medium' | 'large' | 'extraLarge';

export const FONT_SIZE_MAP: Record<FontSize, string> = {
    'small': '14px',
    'medium': '16px',
    'large': '18px',
    'extraLarge': '20px'
};

const DEFAULT_FONT_SIZE: FontSize = 'medium';

interface SettingsContextType {
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// --- Helpers ---

const detectInitialFontSize = (): FontSize => {
    const saved = safeStorage.get('fontSize') as FontSize;
    if (saved && Object.keys(FONT_SIZE_MAP).includes(saved)) {
        return saved;
    }
    return DEFAULT_FONT_SIZE;
};

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [fontSize, setFontSizeInternal] = useState<FontSize>(detectInitialFontSize);

    // Apply font size change to the document root and persist
    useEffect(() => {
        safeStorage.set('fontSize', fontSize);
        
        const sizeValue = FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP[DEFAULT_FONT_SIZE];
        document.documentElement.style.fontSize = sizeValue;
    }, [fontSize]);

    const setFontSize = useCallback((size: FontSize) => {
        if (size === fontSize) return;
        setFontSizeInternal(size);
    }, [fontSize]);

    const contextValue = useMemo(() => ({
        fontSize,
        setFontSize
    }), [fontSize, setFontSize]);

    return (
        <SettingsContext.Provider value={contextValue}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
