import { useContext } from 'react';
import { LanguageContext } from '../Context/language-context';

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
