import en from './en.js';
import ja from './ja.js';
import es from './es.js';
import pt from './pt.js';
import ko from './ko.js';
import zho from './zho.js';
import vi from './vi.js';
import tl from './tl.js';
import sw from './sw.js';
import th from './th.js';

export interface LocaleDefinition {
    scriptures?: Record<string, string>;
    noteLabels?: Record<string, string>;
    placeholders?: Record<string, string>;
    groupChat?: Record<string, unknown>;
    books?: Record<string, string>;
}

export const LOCALES_BY_CODE: Record<string, LocaleDefinition> = {
    en, ja, es, pt, ko, zho, vi, tl, sw, th
};

export const ALL_LOCALES: LocaleDefinition[] = Object.values(LOCALES_BY_CODE);
