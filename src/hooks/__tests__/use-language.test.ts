import { createElement } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { LanguageContext, LanguageContextType } from '../../context/language-context';
import { useLanguage } from '../use-language';

const mockContext: LanguageContextType = {
    language: 'en',
    setLanguage: () => {},
    t: (key: string) => key,
    tArray: () => [],
    isLoaded: true,
    translateBookName: (value) => value || '',
    translateChapterField: (value) => value || '',
    bookTranslations: {}
};

describe('useLanguage', () => {
    it('throws when used outside LanguageProvider', () => {
        expect(() => renderHook(() => useLanguage())).toThrow('useLanguage must be used within a LanguageProvider');
    });

    it('returns context when wrapped by LanguageContext.Provider', () => {
        const wrapper = ({ children }: { children: ReactNode }) =>
            createElement(LanguageContext.Provider, { value: mockContext }, children);

        const { result } = renderHook(() => useLanguage(), { wrapper });
        expect(result.current).toBe(mockContext);
    });
});
