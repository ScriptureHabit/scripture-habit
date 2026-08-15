import { NOTE_HEADER_REGEX, removeNoteHeader, isGCUrl, extractUrls } from './note-utils';

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

// Language-independent structural Key-Value detector (e.g. "**Label:** Value" or "Label: Value")
const KV_LINE_REGEX = /^(?:\*\*|)[^\n:：]{1,40}(?:\*\*|)\s*[:：](?!\/\/)\s*.+/m;

/**
 * Parses note text into structured components based purely on document structure and layout.
 * Completely language-agnostic: zero dictionaries, zero maintenance for new languages!
 */
export const parseStructuredNoteText = (
    text: string,
    translatedText?: string,
    isTranslated: boolean = false
): ParsedNote => {
    // 1. Structural Detection
    const hm = text.match(NOTE_HEADER_REGEX);
    const isStructured = !!hm || KV_LINE_REGEX.test(text);

    // 2. Simple View (Non-structured plain notes or chat messages)
    if (!isStructured) {
        const sourceContent = isTranslated ? (translatedText || '') : text;
        const urls = extractUrls(isTranslated ? `${text} ${translatedText}` : text);
        const content = (sourceContent || '').replace(/(\]\()?https?:\/\/[^\s]+/g, (match: string, p1: string) => {
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
    }

    // 3. Structured Note Parsing (Positional & Layout-driven)
    const sourceText = isTranslated ? (translatedText || '') : text;
    const contentBody = hm ? removeNoteHeader(sourceText) : sourceText;
    const lines = contentBody.split('\n');

    let sVal = '';
    let cVal = '';
    const cLines: string[] = [];
    let kvCount = 0;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const idxColon = trimmed.indexOf(':');
        const idxFullColon = trimmed.indexOf('：');
        const dividerIndex = (idxColon !== -1 && idxFullColon !== -1)
            ? Math.min(idxColon, idxFullColon)
            : (idxColon !== -1 ? idxColon : idxFullColon);

        const isUrlProtocol = idxColon !== -1 && trimmed.substring(idxColon, idxColon + 3) === '://';

        if (dividerIndex !== -1 && dividerIndex < 40 && !isUrlProtocol) {
            const value = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();

            if (kvCount === 0 && !sVal) {
                // 1st Key-Value pair -> Scripture / Category
                sVal = value;
                kvCount++;
            } else if ((kvCount === 1 && !cVal) || isGCUrl(value)) {
                // 2nd Key-Value pair -> Chapter / Reference / URL
                cVal = value;
                kvCount++;
            } else {
                // 3rd+ Key-Value pair -> Comment / Body
                if (value) cLines.push(value);
            }
        } else {
            // Unlabeled content lines belong to the comment body
            cLines.push(trimmed);
        }
    });

    const comm = cLines.join('\n').trim();
    const allUrls = extractUrls(text);
    const pUrl = isGCUrl(cVal) ? cVal : (allUrls[0] || null);

    return {
        isOriginalStructured: true,
        scriptureValue: sVal,
        chapterValue: cVal,
        comment: comm,
        primaryUrl: pUrl,
        headerMatch: hm,
        simpleUrls: allUrls,
        finalSimpleContent: ''
    };
};
