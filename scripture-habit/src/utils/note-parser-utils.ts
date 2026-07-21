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

const LABEL_MARKERS = [
    'Category:', 'Chapter:', 'Scripture:', 'Title:', 'Talk:', 'Speech:', 'Comment:', 'Url:',
    'カテゴリ:', 'カテゴリ：', '章:', '章：', '聖句:', '聖句：', 'タイトル:', 'タイトル：', 'お話:', 'お話：', 'スピーチ:', 'スピーチ：', 'コメント:', 'コメント：', 'Url：',
    'Categoría:', 'Categoria:', 'Escritura:', 'Capítulo:', 'Título:', 'Comentario:', 'Comentário:', 'Discurso:',
    '카테고리:', '성구:', '장:', '제목:', '코멘트:', '댓글:',
    '類別:', '分類:', '經文:', '章節:', '標題:', '評論:',
    'Kinh Thánh:', 'Thánh thư:', 'Chương:', 'Tiêu đề:', 'Bình luận:',
    'Kasulatan:', 'Banal na Kasulatan:', 'Kabanata:', 'Pamagat:', 'Mensahe:', 'Komento:',
    'Andiko:', 'Sura:', 'Jamii:', 'Kundi:', 'Maoni:',
    'พระคัมภีร์:', 'บท:', 'หมวดหมู่:', 'ความคิดเห็น:',
];

export const parseStructuredNoteText = (text: string, translatedText?: string, isTranslated: boolean = false): ParsedNote => {
    // 1. Initial Structural Detection
    const hm = text.match(NOTE_HEADER_REGEX);
    const hasFixedLabel = /^(?:\*\*|)\s*(Category|Categoría|Scripture|カテゴリ|聖句|성구|經文|Thánh thư|Kinh Thánh|Kasulatan|Andiko|พระคัมภีร์|章|Chapter|Capítulo|장|章節|Chương|Kabanata|Sura|บท|Title|Talk|Speech|Discurso|Discurso|제목|標題|Tiêu đề|Pamagat|Mensahe|リンク|Url)\s*(?:\*\*|)\s*[:：]/mi.test(text);
    const isStructured = !!hm || hasFixedLabel;

    // 2. Simple View Logic
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

    // 3. Structured Parsing Flow
    const sourceText = isTranslated ? (translatedText || '') : text;
    const contentBody = hm ? removeNoteHeader(sourceText) : sourceText;
    const initialLines = contentBody.split('\n');
    const lines: string[] = [];

    initialLines.forEach((line: string) => {
        const foundPos: { pos: number; marker: string }[] = [];
        LABEL_MARKERS.forEach(marker => {
            const pos = line.indexOf(marker);
            if (pos > 5) foundPos.push({ pos, marker });
        });

        if (foundPos.length > 0) {
            foundPos.sort((a, b) => a.pos - b.pos);
            let lastIdx = 0;
            foundPos.forEach(fp => {
                lines.push(line.substring(lastIdx, fp.pos).trim());
                lastIdx = fp.pos;
            });
            lines.push(line.substring(lastIdx).trim());
        } else {
            lines.push(line);
        }
    });

    let sVal = '';
    let cVal = '';
    const cLines: string[] = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const idxColon = trimmed.indexOf(':');
        const idxFullColon = trimmed.indexOf('：');
        const dividerIndex = (idxColon !== -1 && idxFullColon !== -1)
            ? Math.min(idxColon, idxFullColon)
            : (idxColon !== -1 ? idxColon : idxFullColon);

        if (dividerIndex !== -1 && dividerIndex < 60) {
            const labelRaw = trimmed.substring(0, dividerIndex).replace(/\*/g, '').trim().toLowerCase();
            const value = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();

            if (/category|scripture|カテゴリ|聖句|categoría|categoria|jamii|kundi|หมวดหมู่|escritura|성구|카테고리|經文|類別|kinh thánh|thánh thư|kasulatan|andiko|พระคัมภีร์/i.test(labelRaw)) {
                sVal = value;
            } else if (/chapter|url|title|章|リンク|speech|talk|capítulo|título|discurso|제목|장|章節|標題|tiêu đề|pamagat|kabanata|chương|章節|sura|บท|mensahe/i.test(labelRaw)) {
                if (!cVal || isGCUrl(value)) cVal = value;
            } else if (/comment|コメント|comentario|comentário|코メント|評論|bình luận|komento|maoni|ความคิดเห็น/i.test(labelRaw)) {
                if (value) cLines.push(value);
            } else {
                cLines.push(trimmed);
            }
        } else {
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
