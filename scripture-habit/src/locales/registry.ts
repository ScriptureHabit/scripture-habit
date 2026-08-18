import en from './en';
import ja from './ja';
import es from './es';
import pt from './pt';
import ko from './ko';
import zho from './zho';
import vi from './vi';
import tl from './tl';
import sw from './sw';
import th from './th';

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
