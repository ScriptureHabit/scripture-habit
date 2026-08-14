import { Language } from '../config/languages';
import en from './en';
import enBooks from './books/en';

const uiModules = import.meta.glob<{ default: Record<string, unknown> }>('./*.ts');
const bookModules = import.meta.glob<{ default: Record<string, unknown> }>('./books/*.ts');

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
  if (lang === 'en') {
    return enBooks as unknown as Record<string, unknown>;
  }
  const loader = bookModules[`./books/${lang}.ts`];
  if (loader) {
    const module = await loader();
    return module.default;
  }
  return enBooks as unknown as Record<string, unknown>;
};
