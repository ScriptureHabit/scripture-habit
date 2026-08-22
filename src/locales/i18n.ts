import { Language } from '../config/languages';

const uiModules = import.meta.glob<{ default: Record<string, unknown> }>(['./*.ts', '!./i18n.ts', '!./registry.ts', '!./scripture-metadata.ts', '!./initial-translations.ts']);

let enCache: Record<string, unknown> | null = null;

export const loadTranslations = async (lang: Language): Promise<Record<string, unknown>> => {
  const loader = uiModules[`./${lang}.ts`];
  if (loader) {
    const module = await loader();
    if (lang === 'en') {
      enCache = module.default;
    }
    return module.default;
  }
  // Fallback to English if loader for requested language doesn't exist
  if (!enCache && uiModules['./en.ts']) {
    const enModule = await uiModules['./en.ts']();
    enCache = enModule.default;
  }
  return enCache || {};
};

export const loadBookTranslations = async (lang: Language): Promise<Record<string, unknown>> => {
  const trans = await loadTranslations(lang);
  if (trans.books) {
    return trans.books as Record<string, unknown>;
  }
  if (!enCache && uiModules['./en.ts']) {
    const enModule = await uiModules['./en.ts']();
    enCache = enModule.default;
  }
  return (enCache?.books as Record<string, unknown>) || {};
};

export default {};
