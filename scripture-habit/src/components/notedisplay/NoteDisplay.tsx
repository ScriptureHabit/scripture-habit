import { useMemo, FC, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../context/LanguageContext';
import { useUrlMetadata } from '../../hooks/useUrlMetadata';
import { NOTE_HEADER_REGEX, removeNoteHeader } from '../../utils/noteUtils';
import LinkPreview from '../linkpreview/LinkPreview';
import './NoteDisplay.css';

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
    return matches.map(url => url.replace(/[.,:;"')\]*_]+$/, '')).filter(url => {
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
    isTranslating?: boolean;
    onRetranslate?: () => void;
}

const GCNoteRenderer: FC<GCNoteRendererProps> = ({ scriptureValue, comment, url, language, t, isSent, linkColor, translatedText, translateChapterField, isTranslating, onRetranslate }) => {
    const { data, loading } = useUrlMetadata(url, language);
    const [showOriginal, setShowOriginal] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync state: if new translatedText arrives, hide original
    useEffect(() => {
        if (translatedText) setShowOriginal(false);
    }, [translatedText]);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.setProperty('--current-link-color', linkColor || (isSent ? 'white' : 'var(--purple)'));
        }
    }, [linkColor, isSent]);

    const scripLower = (scriptureValue || '').toLowerCase();
    const isOther = scripLower.includes('other') || scripLower.includes('その他') || scriptureValue === '';
    const isBYU = scripLower.includes('byu');

    const tWithFall = (k: string, lang: string) => {
        const v = t(k);
        const isEng = /Category|Chapter|Comment|Scripture|Talk|Speech|Title/.test(v);
        if (lang !== 'en' && (v === k || isEng)) {
            const defaults: Record<string, Record<string, string>> = {
                ja: { 'noteLabels.scripture': 'カテゴリ', 'noteLabels.chapter': '章', 'noteLabels.comment': 'コメント', 'noteLabels.talk': 'お話', 'noteLabels.title': 'タイトル', 'noteLabels.speech': 'スピーチ' },
                es: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentario', 'noteLabels.talk': 'Discurso', 'noteLabels.title': 'Título', 'noteLabels.speech': 'Discurso' },
                pt: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentário', 'noteLabels.talk': 'Discurso', 'noteLabels.title': 'Título', 'noteLabels.speech': 'Discurso' },
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

    const isTranslated = !!translatedText && !showOriginal;
    
    // Core Logic: Even if translated, we construct the structure manually to KEEP Titles/Speakers from MetaData
    const constructedMd = useMemo(() => {
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
        
        // If translated, we use the translated text as the "Comment", but we strip headers from it if any
        let displayComment = comment;
        if (isTranslated && translatedText) {
            // 1. Try splitting by common Comment labels
            const parts = translatedText.split(/Comment|コメント|Comentario|Comentário|評論|코멘트|Bình luận|Maoni/i);
            const rawComment = parts.length > 1 ? parts.pop()! : translatedText;

            // 2. Aggressively remove lines that look like Category/Talk/Chapter or contain the URL
            const cleanLines = rawComment.split('\n').filter(line => {
                const l = line.trim().toLowerCase();
                if (!l) return false;

                // Remove lines containing scripture source domains (Metadata duplicates)
                if (l.includes('churchofjesuschrist.org') || l.includes('byu.edu')) return false;

                // Remove lines containing the primary URL
                if (url) {
                    const cleanUrl = url.toLowerCase().replace(/[.,:;"')\]*_]+$/, '');
                    if (l.includes(cleanUrl)) return false;
                }

                // Expanded header keywords (including General Conference variations)
                const isHeader = /^(category|scripture|talk|title|speech|chapter|url|general|conference|カテゴリ|聖句|章|タイトル|お話|総大会|스피치|제목|標題|tiêu đề|kabanata|sura|บท|mensahe)/i.test(l);
                // If it starts with a keyword AND contains a divider OR is a standalone keyword line for GC
                if (isHeader) {
                    if (l.includes(':') || l.includes('：')) return false;
                    if (l.includes('general') || l.includes('conference') || l.includes('総大会')) return false;
                }

                // Also remove standalone GC links or shortcodes
                if (isGCUrl(l)) return false;
                return true;
            });
            displayComment = cleanLines.join('\n');
        }

        const cleanComment = (displayComment || '').split('\n').filter(l => l.trim() !== '**').join('\n').replace(/^\s*\*\*\s*/, '').replace(/\s*\*\*\s*$/, '').trim();
        const commentWithLinks = cleanComment.replace(/(https?:\/\/[^\s]+)/g, (match: string) => {
            const cleanUrl = match.replace(/[.,:;"')\]*_]+$/, '');
            const trailing = match.substring(cleanUrl.length);
            return `[${cleanUrl}](${cleanUrl})${trailing}`;
        });

        return [`**${scriptureLabel}:** ${scriptName}`, `**${fieldLabel}:** ${fieldValue}`].join('\n') + `\n\n**${commentLabel}:**\n${commentWithLinks}`;
    }, [data, loading, scriptureValue, comment, t, url, isOther, isBYU, language, isTranslated, translatedText]);

    return (
        <div className="note-display-container" ref={containerRef}>
            {isTranslated && (
              <div className="note-ai-translated-header">
                <span>✨ AI {t('groupChat.translated')}</span>
                <div className="note-header-buttons">
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRetranslate?.(); }}
                    className={`note-toggle-btn re-translate ${isTranslating ? 'spinning' : ''}`}
                    title={t('groupChat.reTranslate') || 'Refresh translation'}
                    disabled={isTranslating}
                  >
                    {isTranslating ? '⏳' : '🔄'}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowOriginal(true); }}
                    className="note-toggle-btn show-original"
                  >
                    {t('groupChat.showOriginal') || 'See original'}
                  </button>
                </div>
              </div>
            )}
            <div className="note-markdown">
                <ReactMarkdown 
                    components={{
                        a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} />,
                        p: ({ node, ...p }) => <p {...p} />
                    }}
                >
                    {constructedMd}
                </ReactMarkdown>
            </div>
            {showOriginal && (
               <button 
                onClick={(e) => { e.stopPropagation(); setShowOriginal(false); }}
                className="note-toggle-btn show-translation"
              >
                {t('groupChat.showTranslation') || 'Translate'}
              </button>
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
    isTranslating?: boolean;
    onRetranslate?: () => void;
}

const NoteDisplay: FC<NoteDisplayProps> = ({ text, isSent, linkColor, translatedText, scripture, chapter, isTranslating, onRetranslate }) => {
    const { language, t, translateChapterField } = useLanguage();
    const [showOriginal, setShowOriginal] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (translatedText) setShowOriginal(false);
    }, [translatedText]);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.setProperty('--current-link-color', linkColor || (isSent ? 'white' : 'var(--purple)'));
        }
    }, [linkColor, isSent]);

    const isTranslated = !!translatedText && !showOriginal;

    // --- Structural Detection (Memoized) ---
    const { isOriginalStructured, headerMatch } = useMemo(() => {
        const hm = text.match(NOTE_HEADER_REGEX);
        const hasFixedLabel = /^(?:\*\*|)\s*(Category|Categoría|Scripture|カテゴリ|聖句|성구|經文|Thánh thư|Kinh Thánh|Kasulatan|Andiko|พระคัมภีร์|章|Chapter|Capítulo|장|章節|Chương|Kabanata|Sura|บท|Title|Talk|Speech|Discurso|Discurso|제목|標題|Tiêu đề|Pamagat|Mensahe|リンク|Url)\s*(?:\*\*|)\s*[:：]/mi.test(text);
        return { isOriginalStructured: !!hm || hasFixedLabel, headerMatch: hm };
    }, [text]);

    // --- Simple View Content (Memoized) ---
    const { finalContent, simpleUrls } = useMemo(() => {
        if (isOriginalStructured) return { finalContent: '', simpleUrls: [] as string[] };
        const sourceContent = isTranslated ? translatedText! : text;
        const urls = extractUrls(isTranslated ? `${text} ${translatedText}` : text);
        const content = (sourceContent || '').replace(/(\]\()?https?:\/\/[^\s]+/g, (match: string, p1: string) => {
            if (p1) return match;
            const cleanUrl = match.replace(/[.,:;"')\]*_]+$/, '');
            const trailing = match.substring(cleanUrl.length);
            return `[${cleanUrl}](${cleanUrl})${trailing}`;
        });
        return { finalContent: content, simpleUrls: urls };
    }, [isOriginalStructured, isTranslated, translatedText, text]);

    if (!isOriginalStructured) {
        return (
            <div className="note-display-container" ref={containerRef}>
                {isTranslated && (
                  <div className="note-ai-translated-header">
                    <span>✨ AI {t('groupChat.translated')}</span>
                    <div className="note-header-buttons">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onRetranslate?.(); }}
                        className={`note-toggle-btn re-translate ${isTranslating ? 'spinning' : ''}`}
                        title={t('groupChat.reTranslate') || 'Refresh translation'}
                        disabled={isTranslating}
                      >
                        {isTranslating ? '⏳' : '🔄'}
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setShowOriginal(true); }}
                        className="note-toggle-btn show-original"
                      >
                        {t('groupChat.showOriginal') || 'See original'}
                      </button>
                    </div>
                  </div>
                )}
                <div className="note-markdown">
                    <ReactMarkdown 
                        components={{
                            a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} />,
                            p: ({ node, ...p }) => <p {...p} />
                        }}
                    >
                        {finalContent}
                    </ReactMarkdown>
                </div>
                {showOriginal && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowOriginal(false); }}
                    className="note-toggle-btn show-translation simple"
                  >
                    {t('groupChat.showTranslation') || 'Translate'}
                  </button>
                )}
                {simpleUrls.length > 0 && (
                    <div className="link-previews-container">{simpleUrls.map((u, i) => <LinkPreview key={i} url={u} isSent={isSent} language={language || 'en'} t={t} />)}</div>
                )}
            </div>
        );
    }

    // --- Structured Parsing Flow (Memoized for Extreme Performance) ---
    const { scriptureValue, chapterValue, comment, primaryUrl } = useMemo(() => {
        const sourceText = isTranslated ? translatedText! : text;
        const contentBody = headerMatch ? removeNoteHeader(sourceText) : sourceText;
        const initialLines = contentBody.split('\n');
        const lines: string[] = [];

        const labelMarkers = [
            'Category:', 'Chapter:', 'Scripture:', 'Title:', 'Talk:', 'Speech:', 'Comment:', 'Url:',
            'カテゴリ:', 'カテゴリ：', '章:', '章：', '聖句:', '聖句：', 'タイトル:', 'タイトル：', 'お話:', 'お話：', 'スピーチ:', 'スピーチ：', 'コメント:', 'コメント：', 'Url：',
            'Categoría:', 'Categoria:', 'Escritura:', 'Capítulo:', 'Título:', 'Comentario:', 'Comentário:', 'Discurso:',
            '카테고리:', '성구:', '장:', '제목:', '코メント:',
            '類別:', '分類:', '經文:', '章節:', '標題:', '評論:',
            'Kinh Thánh:', 'Thánh thư:', 'Chương:', 'Tiêu đề:', 'Bình luận:',
            'Kasulatan:', 'Banal na Kasulatan:', 'Kabanata:', 'Pamagat:', 'Mensahe:', 'Komento:',
            'Andiko:', 'Sura:', 'Jamii:', 'Kundi:', 'Maoni:',
            'พระคัมภีร์:', 'บท:', 'หมวดหมู่:', 'ความคิดเห็น:',
        ];

        initialLines.forEach(line => {
            const foundPos: { pos: number; marker: string }[] = [];
            labelMarkers.forEach(marker => {
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

        let sVal = scripture || '';
        let cVal = chapter || '';
        const cLines: string[] = [];

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const dividerIndex = trimmed.indexOf(':') !== -1 ? trimmed.indexOf(':') : trimmed.indexOf('：');

            if (dividerIndex !== -1 && dividerIndex < 60) {
                const labelRaw = trimmed.substring(0, dividerIndex).replace(/\*/g, '').trim().toLowerCase();
                const value = trimmed.substring(dividerIndex + 1).replace(/\*\*/g, '').trim();

                if (/category|scripture|カテゴリ|categoría|categoria|jamii|kundi|หมวดหมู่|escritura|성구|카테고리|經文|類別|kinh thánh|thánh thư|kasulatan|andiko|พระคัมภีร์/i.test(labelRaw)) {
                    sVal = value;
                } else if (/chapter|url|title|章|リンク|speech|talk|capítulo|título|discurso|제목|標題|tiêu đề|pamagat|kabanata|chương|章節|sura|บท|mensahe/i.test(labelRaw)) {
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

        return { scriptureValue: sVal, chapterValue: cVal, comment: comm, primaryUrl: pUrl };
    }, [text, isTranslated, translatedText, headerMatch, scripture, chapter]);

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
                language={language} 
                t={t} 
                isSent={isSent} 
                linkColor={linkColor} 
                translatedText={isTranslated ? translatedText : undefined}
                translateChapterField={translateChapterField}
                isTranslating={isTranslating}
                onRetranslate={onRetranslate}
            />
        );
    }

    const tWithFall = (k: string, lang: string) => {
        const val = t(k);
        const isEng = /Category|Chapter|Comment|Scripture|Talk|Speech|Title/.test(val);
        if (lang !== 'en' && (val === k || isEng)) {
            const defaults: Record<string, Record<string, string>> = {
                ja: { 'noteLabels.scripture': 'カテゴリ', 'noteLabels.chapter': '章', 'noteLabels.comment': 'コメント' },
                es: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentario' },
                pt: { 'noteLabels.scripture': 'Escritura', 'noteLabels.chapter': 'Capítulo', 'noteLabels.comment': 'Comentário' },
                ko: { 'noteLabels.scripture': '성구', 'noteLabels.chapter': '장', 'noteLabels.comment': '코メント' },
                zho: { 'noteLabels.scripture': '經文', 'noteLabels.chapter': '章節', 'noteLabels.comment': '評論' },
                tl: { 'noteLabels.scripture': 'Banal na Kasulatan', 'noteLabels.chapter': 'Kabanata', 'noteLabels.comment': 'Komento' },
                vi: { 'noteLabels.scripture': 'Thánh thư', 'noteLabels.chapter': 'Chương', 'noteLabels.comment': 'Nhận xét' },
                sw: { 'noteLabels.scripture': 'Andiko', 'noteLabels.chapter': 'Sura', 'noteLabels.comment': 'Maoni' },
                th: { 'noteLabels.scripture': 'พระคัมภีร์', 'noteLabels.chapter': 'บท', 'noteLabels.comment': 'ความคิดเห็น' }
            };
            return defaults[lang]?.[k] || val;
        }
        return val;
    };

    const finalMd = useMemo(() => {
        const scriptureNameTrans = translateScriptureName(scriptureValue, t);
        const displayChapter = translateChapterField(chapterValue) || chapterValue;
        const chapterLine = displayChapter ? `**${tWithFall('noteLabels.chapter', language)}:** ${displayChapter}` : null;
        
        return [
            `**${tWithFall('noteLabels.scripture', language)}:** ${scriptureNameTrans}`,
            chapterLine,
            `\n**${tWithFall('noteLabels.comment', language)}:**\n${comment.replace(/(https?:\/\/[^\s]+)/g, (match: string) => {
                const cleanUrl = match.replace(/[.,:;"')\]*_]+$/, '');
                const trailing = match.substring(cleanUrl.length);
                return `[${cleanUrl}](${cleanUrl})${trailing}`;
            })}`
        ].filter(Boolean).join('\n');
    }, [scriptureValue, t, translateChapterField, chapterValue, language, comment]);

    return (
        <div className="note-display-container" ref={containerRef}>
            {isTranslated && (
                <div className="note-ai-translated-header">
                    <span>✨ AI {t('groupChat.translated')}</span>
                    <div className="note-header-buttons">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onRetranslate?.(); }}
                            className={`note-toggle-btn re-translate ${isTranslating ? 'spinning' : ''}`}
                            title={t('groupChat.reTranslate') || 'Refresh translation'}
                            disabled={isTranslating}
                        >
                            {isTranslating ? '⏳' : '🔄'}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowOriginal(true); }}
                            className="note-toggle-btn show-original"
                        >
                            {t('groupChat.showOriginal') || 'See original'}
                        </button>
                    </div>
                </div>
            )}
            <div className="note-markdown">
                <ReactMarkdown 
                    components={{
                        a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} />,
                        p: ({ node, ...p }) => <p {...p} />
                    }}
                >
                    {finalMd}
                </ReactMarkdown>
            </div>
            {showOriginal && (
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowOriginal(false); }}
                    className="note-toggle-btn show-translation"
                >
                    {t('groupChat.showTranslation') || 'Translate'}
                </button>
            )}
        </div>
    );
};

export default NoteDisplay;
