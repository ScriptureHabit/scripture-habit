import { Language } from '../config/languages';
import en from './en';
import enBooks from './books/en';

const loaders: Record<Language, () => Promise<{ default: Record<string, unknown> }>> = {
  en: async () => ({ default: en as unknown as Record<string, unknown> }),
  ja: () => import('./ja'),
  pt: () => import('./pt'),
  zho: () => import('./zho'),
  es: () => import('./es'),
  vi: () => import('./vi'),
  th: () => import('./th'),
  ko: () => import('./ko'),
  tl: () => import('./tl'),
  sw: () => import('./sw'),
};

const bookLoaders: Record<Language, () => Promise<{ default: Record<string, unknown> }>> = {
  en: async () => ({ default: enBooks as unknown as Record<string, unknown> }),
  ja: () => import('./books/ja'),
  pt: () => import('./books/pt'),
  zho: () => import('./books/zho'),
  es: () => import('./books/es'),
  vi: () => import('./books/vi'),
  th: () => import('./books/th'),
  ko: () => import('./books/ko'),
  tl: () => import('./books/tl'),
  sw: () => import('./books/sw'),
};

export const loadTranslations = async (lang: Language) => {
  const module = await loaders[lang]();
  return module.default;
};

export const loadBookTranslations = async (lang: Language) => {
  const module = await bookLoaders[lang]();
  return module.default;
};

