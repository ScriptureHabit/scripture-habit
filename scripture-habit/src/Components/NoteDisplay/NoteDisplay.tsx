import { useMemo, FC } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../Context/LanguageContext';
import { useUrlMetadata } from '../../hooks/useUrlMetadata';
import { NOTE_HEADER_REGEX, removeNoteHeader } from '../../Utils/noteUtils';
import LinkPreview from '../LinkPreview/LinkPreview';

/**
 * Checks if a string is a URL or a GC-style shortcode.
 */
const isGCUrl = (str: string | undefined): boolean => {
    if (!str) return false;
    const clean = str.trim();
    if (clean.toLowerCase().startsWith('http')) return true;
    return /^\d{4}\/\d{2}\/.+$/.test(clean);
};

const extractUrls = (text: string | undefined): string[] => {
    if (!text) return [];
    const urlPattern = /https?:\/\/[^\s"']+/gi;
    const matches = text.match(urlPattern);
    if (!matches) return [];

    const seen = new Set<string>();
    return matches.map(url => url.replace(/[.,:;"')\]]+$/, '')).filter(url => {
        if (seen.has(url)) return false;
        seen.add(url);
        return true;
    });
};

// Map scripture names to translation keys
const translateScriptureName = (name: string, t: (key: string) => string): string => {
    if (!name) return '';
    const map: Record<string, string> = {
        'Old Testament': 'scriptures.oldTestament',
        'New Testament': 'scriptures.newTestament',
        'Book of Mormon': 'scriptures.bookOfMormon',
        'Doctrine and Covenants': 'scriptures.doctrineAndCovenants',
        'Pearl of Great Price': 'scriptures.pearlOfGreatPrice',
        'Ordinances and Proclamations': 'scriptures.ordinancesAndProclamations',
        'General Conference': 'scriptures.generalConference',
        'BYU Speeches': 'scriptures.byuSpeeches',
        'Other': 'scriptures.other',
        'その他': 'scriptures.other'
    };
    const key = map[name];
    return key ? t(key) : name;
};

/**
 * Renders rich content (Titles, Labels)
 */
interface GCNoteRendererProps {
    scriptureValue: string;
    comment: string;
    url: string;
    language: string;
    t: (key: string) => string;
    isSent: boolean;
    linkColor?: string;
    translatedText?: string;
    translateChapterField: (url: string) => string;
}

const GCNoteRenderer: FC<GCNoteRendererProps> = ({ scriptureValue, comment, url, language, t, isSent, linkColor, translatedText, translateChapterField }) => {
    const { data, loading } = useUrlMetadata(url, language);
    const scripLower = (scriptureValue || '').toLowerCase();
    const isOther = scripLower.includes('other') || scripLower.includes('その他') || scriptureValue === '';
    const isBYU = scripLower.includes('byu');

    const constructedMd = useMemo(() => {
        const tWithFall = (k: string, lang: string) => {
            const v = t(k);
            const isEng = /Category|Chapter|Comment|Scripture|Talk|Speech|Title/.test(v);
            if (lang !== 'en' && (v === k || isEng)) {
                const defaults: Record<string, Record<string, string>> = {
                    ja: { 'noteLabels.scripture': 'カテゴリ', 'noteLabels.chapter': '章', 'noteLabels.comment': 'コメント', 'noteLabels.newStudyNote': '新しい学習ノート', 'noteLabels.talk': 'お話', 'noteLabels.title': 'タイトル', 'noteLabels.speech': 'スピーチ' },
                    es: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentario', 'noteLabels.newStudyNote': 'Nueva Nota', 'noteLabels.talk': 'Discurso', 'noteLabels.title': 'Título', 'noteLabels.speech': 'Discurso' },
                    pt: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentário', 'noteLabels.newStudyNote': 'Nova Nota', 'noteLabels.talk': 'Discurso', 'noteLabels.title': 'Título', 'noteLabels.speech': 'Discurso' },
                    ko: { 'noteLabels.scripture': '성구', 'noteLabels.chapter': '장', 'noteLabels.comment': '코멘트', 'noteLabels.newStudyNote': '새 노트' },
                    zho: { 'noteLabels.scripture': '經文', 'noteLabels.chapter': '章節', 'noteLabels.comment': '評論', 'noteLabels.newStudyNote': '新筆記' },
                    tl: { 'noteLabels.scripture': 'Banal na Kasulatan', 'noteLabels.chapter': 'Kabanata', 'noteLabels.comment': 'Komento', 'noteLabels.newStudyNote': 'Bagong Tala' },
                    vi: { 'noteLabels.scripture': 'Thánh thư', 'noteLabels.chapter': 'Chương', 'noteLabels.comment': 'Nhận xét', 'noteLabels.newStudyNote': 'Ghi chú mới' },
                    sw: { 'noteLabels.scripture': 'Andiko', 'noteLabels.chapter': 'Sura', 'noteLabels.comment': 'Maoni', 'noteLabels.newStudyNote': 'Dokezo Jipya' },
                    th: { 'noteLabels.scripture': 'พระคัมภีร์', 'noteLabels.chapter': 'บท', 'noteLabels.comment': 'ความคิดเห็น', 'noteLabels.newStudyNote': 'โน้ตใหม่' }
                };
                return defaults[lang]?.[k] || v;
            }
            return v;
        };

        const scriptureLabel = tWithFall('noteLabels.scripture', language);
        const scriptName = translateScriptureName(scriptureValue, t);

        let fieldLabel = tWithFall('noteLabels.talk', language);
        if (isOther) fieldLabel = tWithFall('noteLabels.title', language);
        else if (isBYU) fieldLabel = tWithFall('noteLabels.speech', language);

        let fieldValue = translateChapterField(url);
        if (loading) {
            fieldValue = `_${tWithFall('noteLabels.fetchingInfo', language)}_`;
        } else if (data && data.title) {
            fieldValue = (data.speaker && !isOther) ? `${data.title} - ${data.speaker}` : data.title;
        }

        const commentLabel = tWithFall('noteLabels.comment', language);
        const cleanComment = (comment || '').split('\n').filter(l => l.trim() !== '**').join('\n').replace(/^\s*\*\*\s*/, '').replace(/\s*\*\*\s*$/, '').trim();
        const commentWithLinks = cleanComment.replace(/(https?:\/\/[^\s]+)/g, '[$1]($1)');

        return [`**${scriptureLabel}:** ${scriptName}`, `**${fieldLabel}:** ${fieldValue}`].join('\n') + `\n\n**${commentLabel}:**\n${commentWithLinks}`;
    }, [data, loading, scriptureValue, comment, t, url, isOther, isBYU, language]);

    return (
        <div style={{ textAlign: 'left' }}>
            <ReactMarkdown components={{
                a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" style={{ color: linkColor || (isSent ? 'white' : 'var(--purple)'), textDecoration: 'none' }} onClick={(e) => e.stopPropagation()} />,
                p: ({ node, ...p }) => <p {...p} style={{ margin: '0.4rem 0', lineHeight: '1.5', whiteSpace: 'pre-wrap' }} />
            }}>
                {constructedMd}
            </ReactMarkdown>
            {translatedText && (
                <div style={{ marginTop: '0.8rem', borderTop: '1px dashed #ccc', paddingTop: '0.6rem' }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 'bold' }}>✨ AI {t('groupChat.translated')}</div>
                    <ReactMarkdown components={{ p: ({ node, ...p }) => <p {...p} style={{ margin: '0.3rem 0' }} /> }}>{translatedText}</ReactMarkdown>
                </div>
            )}
        </div>
    );
};

interface NoteDisplayProps {
    text: string;
    isSent: boolean;
    linkColor?: string;
    translatedText?: string;
    scripture?: string;
    chapter?: string;
}

const NoteDisplay: FC<NoteDisplayProps> = ({ text, isSent, linkColor, translatedText, scripture, chapter }) => {
    const { language, t, translateChapterField } = useLanguage();

    // 1. Structure Check
    const headerMatch = text.match(NOTE_HEADER_REGEX);
    const hasStructuredLabel = /^(?:\*\*|)\s*(Category|Categoría|Categoria|Categoriza|카테고리|類別|分類|Jamii|Kundi|หมวดหมู่|Scripture|カテゴリ|聖句|Escritura|성구|經文|Kinh Thánh|Thánh thư|Kasulatan|Banal na Kasulatan|Andiko|พระคัมภีร์|章|Chapter|Capítulo|장|章節|Chương|Kabanata|Sura|บท|Title|Talk|Speech|Título|Discurso|제목|標題|Tiêu đề|Pamagat|Mensahe|リンク|Url)\s*(?:\*\*|)\s*[:：]/mi.test(text);

    if (!headerMatch && !hasStructuredLabel) {
        const simpleUrls = extractUrls(text);
        const processedText = (text || '').replace(/(\]\()?https?:\/\/[^\s]+/g, (match, p1) => {
            if (p1) return match;
            return `[${match}](${match})`;
        });
        return (
            <div style={{ textAlign: 'left' }}>
                <ReactMarkdown components={{
                    a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" style={{ color: linkColor || (isSent ? 'white' : 'var(--purple)'), textDecoration: 'none' }} onClick={e => e.stopPropagation()} />,
                    p: ({ node, ...p }) => <p {...p} style={{ margin: '0.2rem 0', whiteSpace: 'pre-wrap' }} />
                }}>
                    {processedText}
                </ReactMarkdown>
                {translatedText && (
                    <div style={{ marginTop: '0.4rem', borderTop: '1px dashed #ccc', paddingTop: '0.4rem' }}>
                        <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 'bold' }}>✨ AI {t('groupChat.translated')}</div>
                        <ReactMarkdown components={{ p: ({ node, ...p }) => <p {...p} style={{ margin: '0.2rem 0', whiteSpace: 'pre-wrap' }} /> }}>{translatedText}</ReactMarkdown>
                    </div>
                )}
                {simpleUrls.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>{simpleUrls.map((u, i) => <LinkPreview key={i} url={u} isSent={isSent} language={language || 'en'} t={t} />)}</div>
                )}
            </div>
        );
    }

    // 2. Parse Structured Note
    const contentBody = headerMatch ? removeNoteHeader(text) : text;
    // Split by newlines initially
    const initialLines = contentBody.split('\n');
    const lines: string[] = [];

    // Expanded label markers for all supported languages to ensure cross-language parsing
    const labelMarkers = [
        // English
        'Category:', 'Chapter:', 'Scripture:', 'Title:', 'Talk:', 'Speech:', 'Comment:', 'Url:',
        // Japanese
        'カテゴリ:', 'カテゴリ：', '章:', '章：', '聖句:', '聖句：', 'タイトル:', 'タイトル：', 'お話:', 'お話：', 'スピーチ:', 'スピーチ：', 'コメント:', 'コメント：', 'Url：',
        // Spanish / Portuguese
        'Categoría:', 'Categoria:', 'Escritura:', 'Capítulo:', 'Título:', 'Comentario:', 'Comentário:', 'Discurso:',
        // Korean
        '카테고리:', '성구:', '장:', '제목:', '코멘트:',
        // Chinese
        '類別:', '分類:', '經文:', '章節:', '標題:', '評論:',
        // Vietnamese
        'Kinh Thánh:', 'Thánh thư:', 'Chương:', 'Tiêu đề:', 'Bình luận:',
        // Tagalog
        'Kasulatan:', 'Banal na Kasulatan:', 'Kabanata:', 'Pamagat:', 'Mensahe:', 'Komento:',
        // Swahili
        'Andiko:', 'Sura:', 'Jamii:', 'Kundi:', 'Maoni:',
        // Thai
        'พระคัมภีร์:', 'บท:', 'หมวดหมู่:', 'ความคิดเห็น:',
    ];

    initialLines.forEach(line => {
        const currentLine = line;
        // Check for subsequent labels on the same line
        const foundPos: { pos: number; marker: string }[] = [];
        labelMarkers.forEach(marker => {
            const pos = currentLine.indexOf(marker);
            // Ignore if it's at the very beginning (already handled by split)
            if (pos > 5) {
                foundPos.push({ pos, marker });
            }
        });

        if (foundPos.length > 0) {
            // Sort by position
            foundPos.sort((a, b) => a.pos - b.pos);
            let lastIdx = 0;
            foundPos.forEach(fp => {
                lines.push(currentLine.substring(lastIdx, fp.pos).trim());
                lastIdx = fp.pos;
            });
            lines.push(currentLine.substring(lastIdx).trim());
        } else {
            lines.push(line);
        }
    });

    let scriptureValue = scripture || '';
    let chapterValue = chapter || '';
    const commentLines: string[] = [];

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Skip "New Study Note" headers from older versions or data
        if (trimmed.includes('New Study Note') || trimmed.includes('新しい学習ノート') || trimmed.includes('📖')) {
            // Only skip if it's likely a header (no colon and contains known header text)
            if (!trimmed.includes(':') && !trimmed.includes('：')) {
                return;
            }
        }

        const dividerIndex = trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : trimmed.indexOf('：');

        if (dividerIndex !== -1 && dividerIndex < 60) {
            const labelRaw = trimmed.substring(0, dividerIndex).replace(/\*/g, '').trim().toLowerCase();
            const value = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();

            if (labelRaw.includes('category') || labelRaw.includes('scripture') || labelRaw.includes('カテゴリ') || labelRaw.includes('categoría') || labelRaw.includes('categoria') || labelRaw.includes('jamii') || labelRaw.includes('kundi') || labelRaw.includes('หมวดหมู่') || labelRaw.includes('escritura') || labelRaw.includes('성구') || labelRaw.includes('카테고리') || labelRaw.includes('經文') || labelRaw.includes('類別') || labelRaw.includes('kinh thánh') || labelRaw.includes('thánh thư') || labelRaw.includes('kasulatan') || labelRaw.includes('banal na kasulatan') || labelRaw.includes('andiko') || labelRaw.includes('พระคัมภีร์')) {
                scriptureValue = value;
            } else if (
                labelRaw.includes('chapter') || labelRaw.includes('url') || labelRaw.includes('title') ||
                labelRaw.includes('章') || labelRaw.includes('링크') || labelRaw.includes('speech') ||
                labelRaw.includes('talk') || labelRaw.includes('capítulo') || labelRaw.includes('título') ||
                labelRaw.includes('discurso') || labelRaw.includes('제목') || labelRaw.includes('標題') ||
                labelRaw.includes('tiêu đề') || labelRaw.includes('pamagat') || labelRaw.includes('kabanata') ||
                labelRaw.includes('chương') || labelRaw.includes('章節') || labelRaw.includes('sura') ||
                labelRaw.includes('บท') || labelRaw.includes('mensahe')
            ) {
                // If chapterValue is already a URL, don't overwrite it with a Talk/Speech title
                const valIsUrl = isGCUrl(value);
                const currentIsUrl = isGCUrl(chapterValue);
                if (!chapterValue || valIsUrl || !currentIsUrl) {
                    chapterValue = value;
                }
            } else if (labelRaw.includes('comment') || labelRaw.includes('コメント') || labelRaw.includes('comentario') || labelRaw.includes('comentário') || labelRaw.includes('코멘트') || labelRaw.includes('評論') || labelRaw.includes('bình luận') || labelRaw.includes('komento') || labelRaw.includes('maoni') || labelRaw.includes('ความคิดเห็น')) {
                if (value) commentLines.push(value);
            } else {
                commentLines.push(trimmed);
            }
        } else {
            commentLines.push(trimmed);
        }
    });

    // Clean comment: remove lines that are just '**' and strip leading/trailing '**'
    const commentRaw = commentLines.join('\n').trim();
    const comment = commentRaw
        .split('\n')
        .filter(line => line.trim() !== '**')
        .join('\n')
        .replace(/^\s*\*\*\s*/, '')
        .replace(/\s*\*\*\s*$/, '')
        .trim();

    const allUrls = extractUrls(text);
    const primaryUrl = isGCUrl(chapterValue) ? chapterValue : (allUrls[0] || null);

    const scripLower = (scriptureValue || '').toLowerCase();
    const isOther = scripLower.includes('other') || scripLower.includes('その他') || scriptureValue === '';
    const isGC = scripLower.includes('general') || scripLower.includes('総大会');
    const isBYU = scripLower.includes('byu');

    if (primaryUrl && (isGC || isOther || isBYU)) {
        return (
            <GCNoteRenderer
                scriptureValue={scriptureValue}
                comment={comment}
                url={primaryUrl}
                language={language} t={t} isSent={isSent} linkColor={linkColor} translatedText={translatedText}
                translateChapterField={translateChapterField}
            />
        );
    }

    const tWithFall = (k: string, lang: string) => {
        const val = t(k);
        const isEng = /Category|Chapter|Comment|Scripture|Talk|Speech|Title/.test(val);
        if (lang !== 'en' && (val === k || isEng)) {
            const defaults: Record<string, Record<string, string>> = {
                ja: { 'noteLabels.scripture': 'カテゴリ', 'noteLabels.chapter': '章', 'noteLabels.comment': 'コメント', 'noteLabels.newStudyNote': '新しい学習ノート' },
                es: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentario', 'noteLabels.newStudyNote': 'Nueva Nota' },
                pt: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentário', 'noteLabels.newStudyNote': 'Nova Nota' },
                ko: { 'noteLabels.scripture': '성구', 'noteLabels.chapter': '장', 'noteLabels.comment': '코มน트', 'noteLabels.newStudyNote': '새 노트' },
                zho: { 'noteLabels.scripture': '經文', 'noteLabels.chapter': '章節', 'noteLabels.comment': '評論', 'noteLabels.newStudyNote': '新筆記' },
                tl: { 'noteLabels.scripture': 'Banal na Kasulatan', 'noteLabels.chapter': 'Kabanata', 'noteLabels.comment': 'Komento', 'noteLabels.newStudyNote': 'Bagong Tala' },
                vi: { 'noteLabels.scripture': 'Thánh thư', 'noteLabels.chapter': 'Chương', 'noteLabels.comment': 'Nhận xét', 'noteLabels.newStudyNote': 'Ghi chú mới' },
                sw: { 'noteLabels.scripture': 'Andiko', 'noteLabels.chapter': 'Sura', 'noteLabels.comment': 'Maoni', 'noteLabels.newStudyNote': 'Dokezo Jipya' },
                th: { 'noteLabels.scripture': 'พระคัมภีร์', 'noteLabels.chapter': 'บท', 'noteLabels.comment': 'ความคิดเห็น', 'noteLabels.newStudyNote': 'โน้ตใหม่' }
            };
            return defaults[lang]?.[k] || val;
        }
        return val;
    };

    const scriptureNameTrans = translateScriptureName(scriptureValue, t);
    const displayChapter = translateChapterField(chapterValue) || chapterValue;
    const chapterLine = displayChapter ? `**${tWithFall('noteLabels.chapter', language)}:** ${displayChapter}` : null;
    const finalMd = [
        `**${tWithFall('noteLabels.scripture', language)}:** ${scriptureNameTrans}`,
        chapterLine,
        `\n**${tWithFall('noteLabels.comment', language)}:**\n${comment.replace(/(https?:\/\/[^\s]+)/g, '[$1]($1)')}`
    ].filter(Boolean).join('\n');

    return (
        <div style={{ textAlign: 'left' }}>
            <ReactMarkdown components={{
                a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" style={{ color: linkColor || (isSent ? 'white' : 'var(--purple)'), textDecoration: 'none' }} onClick={e => e.stopPropagation()} />,
                p: ({ node, ...p }) => <p {...p} style={{ margin: '0.4rem 0', whiteSpace: 'pre-wrap', lineHeight: '1.5' }} />
            }}>
                {finalMd}
            </ReactMarkdown>
            {translatedText && (
                <div style={{ marginTop: '0.6rem', borderTop: '1px dashed #ccc', paddingTop: '0.4rem' }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 'bold' }}>✨ AI {t('groupChat.translated')}</div>
                    <ReactMarkdown components={{ p: ({ node, ...p }) => <p {...p} style={{ margin: '0.2rem 0', whiteSpace: 'pre-wrap' }} /> }}>{translatedText}</ReactMarkdown>
                </div>
            )}
        </div>
    );
};

export default NoteDisplay;
