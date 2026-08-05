import { useMemo, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useUrlMetadata } from '../../../hooks/use-url-metadata';
import { getNoteLabelFallback, translateScriptureName, isPlaceholderValue } from '../utils/note-translations';
import { isGCUrl } from '../../../utils/note-utils';
import '../note-display.css';

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

const GCNoteRenderer = ({ 
    scriptureValue, comment, url, language, t, isSent, linkColor, 
    translatedText, translateChapterField, isTranslating, onRetranslate 
}: GCNoteRendererProps) => {
    const { data, loading } = useUrlMetadata(url, language);
    const [showOriginal, setShowOriginal] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (translatedText) {
            queueMicrotask(() => {
                setShowOriginal(false);
            });
        }
    }, [translatedText]);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.setProperty('--current-link-color', linkColor || (isSent ? 'white' : 'var(--purple)'));
        }
    }, [linkColor, isSent]);

    const isTranslated = !!translatedText && !showOriginal;

    const constructedMd = useMemo(() => {
        const scripLower = (scriptureValue || '').toLowerCase();
        const isOther = scripLower.includes('other') || scripLower.includes('その他') || scriptureValue === '';
        const isBYU = scripLower.includes('byu');

        const scriptureLabel = getNoteLabelFallback('noteLabels.scripture', language, t('noteLabels.scripture'));
        const scriptName = translateScriptureName(scriptureValue, t);

        let fieldLabel = getNoteLabelFallback('noteLabels.talk', language, t('noteLabels.talk'));
        if (isOther) fieldLabel = getNoteLabelFallback('noteLabels.title', language, t('noteLabels.title'));
        else if (isBYU) fieldLabel = getNoteLabelFallback('noteLabels.speech', language, t('noteLabels.speech'));

        let fieldValue = translateChapterField(url);
        if (loading) {
            fieldValue = `_${getNoteLabelFallback('noteLabels.fetchingInfo', language, t('noteLabels.fetchingInfo'))}_`;
        } else if (data && data.title) {
            fieldValue = (data.speaker && !isOther) ? `${data.title} - ${data.speaker}` : data.title;
        }

        const commentLabel = getNoteLabelFallback('noteLabels.comment', language, t('noteLabels.comment'));
        
        let displayComment = comment;
        if (isTranslated && translatedText) {
            const parts = translatedText.split(/Comment|コメント|Comentario|Comentário|評論|코멘트|Bình luận|Maoni/i);
            const rawComment = parts.length > 1 ? parts.pop()! : translatedText;

            const cleanLines = rawComment.split('\n').filter(line => {
                const l = line.trim().toLowerCase();
                if (!l) return false;
                if (l.includes('churchofjesuschrist.org') || l.includes('byu.edu')) return false;
                if (url) {
                    const cleanUrl = url.toLowerCase().replace(/[.,:;"')\]*_]+$/, '');
                    if (l.includes(cleanUrl)) return false;
                }
                const isHeader = /^(category|scripture|talk|title|speech|chapter|url|general|conference|カテゴリ|聖句|章|タイトル|お話|総大会|スピーチ|제목|標題|tiêu đề|kabanata|sura|บท|mensahe)/i.test(l);
                if (isHeader) {
                    if (l.includes(':') || l.includes('：')) return false;
                    if (l.includes('general') || l.includes('conference') || l.includes('総大会')) return false;
                }
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

        const scriptureLine = !isPlaceholderValue(scriptureValue) 
            ? `**${scriptureLabel}:** ${scriptName}` 
            : null;

        return [scriptureLine, `**${fieldLabel}:** ${fieldValue}`].filter(Boolean).join('\n') + `\n\n**${commentLabel}:**\n${commentWithLinks}`;
    }, [data, loading, scriptureValue, comment, t, url, language, isTranslated, translatedText, translateChapterField]);

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
                        a: ({ ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} />,
                        p: ({ ...p }) => <p {...p} />
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

export default GCNoteRenderer;
