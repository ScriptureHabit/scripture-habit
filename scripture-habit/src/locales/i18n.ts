import { Language } from '../config/languages';
import en from './en';

const uiModules = import.meta.glob<{ default: Record<string, unknown> }>('./*.ts');

export const loadTranslations = async (lang: Language): Promise<Record<string, unknown>> => {
  if (lang === 'en') {
    return en as unknown as Record<string, unknown>;
  }
  const loader = uiModules[`./${lang}.ts`];
  if (loader) {
    const module = await loader();
    return module.default;
  }
  return en as unknown as Record<string, unknown>;
};

export const loadBookTranslations = async (lang: Language): Promise<Record<string, unknown>> => {
  const trans = await loadTranslations(lang);
  return (trans.books as Record<string, unknown>) || (en.books as unknown as Record<string, unknown>);
};
