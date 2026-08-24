import { NOTE_HEADER_REGEX, removeNoteHeader, isGCUrl, extractUrls } from './note-utils.js';
import { ALL_LOCALES } from '../locales/registry.js';

export interface ParsedNote {
    isOriginalStructured: boolean;
    scriptureValue: string;
    chapterValue: string;
    comment: string;
    primaryUrl: string | null;
    headerMatch: RegExpMatchArray | null;
    simpleUrls: string[];
    finalSimpleContent: string;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

function collectUniqueStrings(...arrays: (string | undefined | null)[][]): string[] {
    const set = new Set<string>();
    for (const arr of arrays) {
        for (const item of arr) {
            if (typeof item === 'string') {
                const trimmed = item.trim();
                if (trimmed.length > 0) set.add(trimmed);
            }
        }
    }
    return Array.from(set);
}

// 1. Automatically collect all scripture category names across all locales (SSOT)
export const KNOWN_SCRIPTURES = collectUniqueStrings(
    ALL_LOCALES.flatMap(l => Object.values(l.scriptures || {})),
    ALL_LOCALES.flatMap(l => [
        l.books?.['Doctrine and Covenants'],
        l.books?.['D&C'],
        l.books?.['The Living Christ'],
        l.books?.['The Family Proclamation']
    ]),
    ['Doctrine and Covenants', 'D&C', 'BYU Speeches', 'General Conference', 'Book of Mormon', 'Old Testament', 'New Testament', 'Pearl of Great Price', 'Ordinances and Proclamations']
).sort((a, b) => b.length - a.length);

export const splitHeaderScriptureAndChapter = (headerText: string): { scriptureValue: string; chapterValue: string } => {
    const trimmed = headerText.trim();
    for (const scrip of KNOWN_SCRIPTURES) {
        if (trimmed.toLowerCase().startsWith(scrip.toLowerCase())) {
            const remainder = trimmed.substring(scrip.length).trim();
            return {
                scriptureValue: scrip,
                chapterValue: remainder
            };
        }
    }
    return {
        scriptureValue: '',
        chapterValue: trimmed
    };
};

// 2. Automatically collect label tokens across all locales (SSOT)
const scriptureLabels = collectUniqueStrings(
    ALL_LOCALES.map(l => l.noteLabels?.scripture),
    ALL_LOCALES.map(l => typeof l.groupChat?.category === 'string' ? l.groupChat.category : undefined),
    ['Category', 'Scripture', 'カテゴリ', '聖句', 'Categoría', 'Escritura']
);

const chapterLabels = collectUniqueStrings(
    ALL_LOCALES.map(l => l.noteLabels?.chapter),
    ALL_LOCALES.map(l => typeof l.groupChat?.chapter === 'string' ? l.groupChat.chapter : undefined),
    ['Chapter', '章', 'Capítulo', '장', '章節', '章节', 'Kabanata', 'Chương', 'Sura', 'บท']
);

const commentLabels = collectUniqueStrings(
    ALL_LOCALES.map(l => l.noteLabels?.comment),
    ALL_LOCALES.map(l => typeof l.groupChat?.comment === 'string' ? l.groupChat.comment : undefined),
    ['Comment', 'コメント', 'Comentario', 'Comentário', '코멘트', '評論', '评论', 'Komento', 'Nhận xét', 'Maoni', 'ความคิดเห็น']
);

const generalLabels = collectUniqueStrings(
    ALL_LOCALES.map(l => l.noteLabels?.talk),
    ALL_LOCALES.map(l => l.noteLabels?.speech),
    ALL_LOCALES.map(l => l.noteLabels?.title),
    ['Talk', 'Speech', 'Title', 'お話', 'スピーチ', 'タイトル', 'Discurso', 'Título']
);

const allLabels = collectUniqueStrings(
    scriptureLabels,
    chapterLabels,
    commentLabels,
    generalLabels
);

function buildPrefixRegex(words: string[], flags = 'i'): RegExp {
    const pattern = words.sort((a, b) => b.length - a.length).map(escapeRegex).join('|');
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    return new RegExp(`^(?:\\*\\*|)\\s*(?:groupChat\\.|noteLabels\\.|)(?:${pattern})\\s*(?:\\*\\*|)\\s*[:：]`, flags);
}

function buildExactLabelRegex(words: string[], flags = 'i'): RegExp {
    const pattern = words.sort((a, b) => b.length - a.length).map(escapeRegex).join('|');
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    return new RegExp(`^(?:groupChat\\.|noteLabels\\.|)(?:${pattern})\\s*[:：]?$`, flags);
}

// Dynamically generated Regexes adhering to DRY principles
export const SCRIPTURE_LABEL_REGEX = buildPrefixRegex(scriptureLabels);
export const CHAPTER_LABEL_REGEX   = buildPrefixRegex(chapterLabels);
export const COMMENT_LABEL_REGEX   = buildPrefixRegex(commentLabels);
export const GENERAL_LABEL_REGEX   = buildPrefixRegex(generalLabels);

export const KV_LINE_REGEX         = buildPrefixRegex(allLabels, 'im');
export const IS_LABEL_HEADER_REGEX = buildExactLabelRegex(allLabels);

const getDividerIndex = (line: string): number => {
    const idxColon = line.indexOf(':');
    const idxFullColon = line.indexOf('：');
    return (idxColon !== -1 && idxFullColon !== -1)
        ? Math.min(idxColon, idxFullColon)
        : (idxColon !== -1 ? idxColon : idxFullColon);
};

/**
 * Parses note text into structured components based purely on document structure and layout.
 * Supports standard bold header notes and multi-lingual structured key-value notes.
 */
export const parseStructuredNoteText = (
    text: string,
    translatedText?: string,
    isTranslated: boolean = false
): ParsedNote => {
    const sourceText = isTranslated ? (translatedText || '') : text;
    const hm = text.match(NOTE_HEADER_REGEX);
    const headerText = (hm?.[1] || '').trim();
    const isLabelOnlyHeader = hm ? IS_LABEL_HEADER_REGEX.test(headerText) : false;

    // 1. Standard Note with Bold Header (**Scripture Chapter**\n\nComment or **Scripture Chapter** Comment)
    // Only treat as standard note if header is not just a field label like "**Category:**" or "**カテゴリ**"
    if (hm && !isLabelOnlyHeader) {
        const comment = removeNoteHeader(sourceText).trim();
        const allUrls = extractUrls(sourceText);
        const { scriptureValue, chapterValue } = splitHeaderScriptureAndChapter(headerText);

        return {
            isOriginalStructured: true,
            scriptureValue,
            chapterValue,
            comment,
            primaryUrl: allUrls[0] || null,
            headerMatch: hm,
            simpleUrls: allUrls,
            finalSimpleContent: ''
        };
    }

    // 2. Key-Value Structured Note (e.g. Category: ...\nChapter: ...\nComment: ...)
    const isKVStructured = KV_LINE_REGEX.test(sourceText);
    if (isKVStructured) {
        const lines = sourceText.split('\n');
        let sVal = '';
        let cVal = '';
        const cLines: string[] = [];
        let isInsideComment = false;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            if (isInsideComment) {
                if (SCRIPTURE_LABEL_REGEX.test(trimmed)) {
                    isInsideComment = false;
                    const dividerIndex = getDividerIndex(trimmed);
                    sVal = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();
                } else if (CHAPTER_LABEL_REGEX.test(trimmed)) {
                    isInsideComment = false;
                    const dividerIndex = getDividerIndex(trimmed);
                    cVal = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();
                } else {
                    cLines.push(trimmed);
                }
                return;
            }

            if (SCRIPTURE_LABEL_REGEX.test(trimmed)) {
                const dividerIndex = getDividerIndex(trimmed);
                sVal = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();
            } else if (CHAPTER_LABEL_REGEX.test(trimmed)) {
                const dividerIndex = getDividerIndex(trimmed);
                cVal = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();
            } else if (COMMENT_LABEL_REGEX.test(trimmed)) {
                isInsideComment = true;
                const dividerIndex = getDividerIndex(trimmed);
                const value = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();
                if (value) cLines.push(value);
            } else if (GENERAL_LABEL_REGEX.test(trimmed)) {
                const dividerIndex = getDividerIndex(trimmed);
                const value = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();
                if (!sVal) sVal = value;
                else if (!cVal) cVal = value;
                else if (value) cLines.push(value);
            } else if (isGCUrl(trimmed) && !cVal) {
                cVal = trimmed;
            } else {
                cLines.push(trimmed);
            }
        });

        const comm = cLines.join('\n').trim();
        const allUrls = extractUrls(sourceText);
        const pUrl = isGCUrl(cVal) ? cVal : (allUrls[0] || null);

        return {
            isOriginalStructured: true,
            scriptureValue: sVal,
            chapterValue: cVal,
            comment: comm,
            primaryUrl: pUrl,
            headerMatch: null,
            simpleUrls: allUrls,
            finalSimpleContent: ''
        };
    }

    // 3. Simple View (Non-structured plain notes or chat messages)
    const urls = extractUrls(sourceText);
    const content = (sourceText || '').replace(/(\]\()?https?:\/\/[^\s]+/g, (match: string, p1: string) => {
        if (p1) return match;
        const cleanUrl = match.replace(/[.,:;"')\]*_]+$/, '');
        const trailing = match.substring(cleanUrl.length);
        return `[${cleanUrl}](${cleanUrl})${trailing}`;
    });
    return {
        isOriginalStructured: false,
        scriptureValue: '',
        chapterValue: '',
        comment: '',
        primaryUrl: urls[0] || null,
        headerMatch: null,
        simpleUrls: urls,
        finalSimpleContent: content
    };
};
