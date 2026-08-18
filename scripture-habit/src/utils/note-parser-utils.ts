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

const KNOWN_SCRIPTURES = [
    'Doctrine and Covenants', 'Ordinances and Proclamations', 'Pearl of Great Price', 'General Conference',
    'Book of Mormon', 'Old Testament', 'New Testament', 'BYU Speeches', 'Other',
    '教義と聖約', '儀式と宣言', '高価な真珠', '総大会', 'モルモン書', '旧約聖書', '新約聖書', 'その他',
    'Doctrina y Convenios', 'Ordenanzas y Declaraciones', 'La Perla de Gran Precio', 'Conferencia General',
    'El Libro de Mormón', 'Antiguo Testamento', 'Nuevo Testamento', 'Otros',
    'Doutrina e Convênios', 'Ordenanças e Declarações', 'Pérola de Grande Valor', 'Conferência Geral',
    'O Livro de Mórmon', 'Velho Testamento', 'Novo Testamento', 'Outros',
    '교리와 성약', '의식 및 선언', '값진 진주', '연차 대회', '몰몬경', '구약전書', '구약전서', '신약전서', '기타',
    '教義和聖約', '儀式與宣言', '無價珍珠', '總會大會', '摩爾門經', '舊約', '新約', '其他',
    'Giáo Lý và Giao Ước', 'Các Giáo Lễ và Tuyên Ngôn', 'Trân Châu Vô Giá', 'Đại Hội Trung Ương', 'Sách Mặc Môn', 'Cựu Ước', 'Tân Ước', 'Khác',
    'หลักคำสอนและพันธสัญญา', 'พิธีการและถ้อยแถลง', 'ไข่มุกอันล้ำค่า', 'การประชุมใหญ่สามัญ', 'พระคัมภีร์มอรมอน', 'พันธสัญญาเดิม', 'พันธสัญญาใหม่', 'อื่นๆ',
    'Doktrina at mga Tipan', 'Mga Ordenansa at Pagpapahayag', 'Mahalagang Perlas', 'Pangkalahatang Kumperensya', 'Mga Talumpati sa BYU', 'Aklat ni Mormon', 'Lumang Tipan', 'Bagong Tipan', 'Iba pa',
    'Mafundisho na Maagano', 'Ibada na Matangazo', 'Lulu ya Thamani Kuu', 'Mkutano Mkuu', 'Kitabu cha Mormoni', 'Agano la Kale', 'Agano Jipya', 'Nyingine'
];

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

const SCRIPTURE_LABEL_REGEX = /^(?:\*\*|)\s*(?:groupChat\.|noteLabels\.|)(?:Category|Scripture|カテゴリ|聖句|Categoría|Escritura|성구|經文|经文|Banal\s+na\s+Kasulatan|Thánh\s+thư|Andiko|พระคัมภีร์)\s*(?:\*\*|)\s*[:：]/i;
const CHAPTER_LABEL_REGEX = /^(?:\*\*|)\s*(?:groupChat\.|noteLabels\.|)(?:Chapter|章|Capítulo|장|章節|章节|Kabanata|Chương|Sura|บท)\s*(?:\*\*|)\s*[:：]/i;
const COMMENT_LABEL_REGEX = /^(?:\*\*|)\s*(?:groupChat\.|noteLabels\.|)(?:Comment|コメント|Comentario|Comentário|코멘트|評論|评论|Komento|Nhận\s+xét|Maoni|ความคิดเห็น)\s*(?:\*\*|)\s*[:：]/i;
const GENERAL_LABEL_REGEX = /^(?:\*\*|)\s*(?:groupChat\.|noteLabels\.|)(?:Talk|Speech|Title|お話|スピーチ|タイトル|Discurso|Título|Mga\s+Talumpati)\s*(?:\*\*|)\s*[:：]/i;

const KV_LINE_REGEX = /^(?:\*\*|)\s*(?:groupChat\.|noteLabels\.|)(?:Category|Scripture|Chapter|Comment|Talk|Speech|Title|カテゴリ|聖句|章|コメント|お話|スピーチ|タイトル|Categoría|Capítulo|Comentario|Discurso|Título|Escritura|Comentário|성구|장|코멘트|經文|章節|評論|经文|章节|评论|Banal\s+na\s+Kasulatan|Kabanata|Komento|Thánh\s+thư|Chương|Nhận\s+xét|Andiko|Sura|Maoni|พระคัมภีร์|บท|ความคิดเห็น)\s*(?:\*\*|)\s*[:：]/im;

const IS_LABEL_HEADER_REGEX = /^(?:groupChat\.|noteLabels\.|)(?:Category|Scripture|Chapter|Comment|Talk|Speech|Title|カテゴリ|聖句|章|コメント|お話|スピーチ|タイトル|Categoría|Capítulo|Comentario|Discurso|Título|Escritura|Comentário|성구|장|코멘特?|코멘트|經文|章節|評論|经文|章节|评论|Banal\s+na\s+Kasulatan|Kabanata|Komento|Thánh\s+thư|Chương|Nhận\s+xét|Andiko|Sura|Maoni|พระคัมภีร์|บท|ความคิดเห็น)\s*[:：]?$/i;

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
