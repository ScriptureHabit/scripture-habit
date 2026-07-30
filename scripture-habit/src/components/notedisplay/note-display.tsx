
import { FC, useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../../hooks/use-language';
import { useNoteParser } from './hooks/use-note-parser';
import GCNoteRenderer from './components/gc-note-renderer';
import { getNoteLabelFallback, translateScriptureName, isPlaceholderValue } from './utils/note-translations';
import LinkPreview from '../linkpreview/link-preview';
import './note-display.css';

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

const NoteDisplay: FC<NoteDisplayProps> = ({ 
    text, isSent, linkColor, translatedText, scripture, chapter, isTranslating, onRetranslate 
}) => {
    const { language, t, translateChapterField } = useLanguage();
    const [showOriginal, setShowOriginal] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const isTranslated = !!translatedText && !showOriginal;

    // 1. Parse the note content using our modular hook
    const parsed = useNoteParser(text, translatedText, isTranslated);

    // 2. Sync visual state with translation availability
    useEffect(() => {
        if (translatedText) {
            queueMicrotask(() => {
                setShowOriginal(false);
            });
        }
    }, [translatedText]);

    // 3. Apply custom link colors via CSS variables
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.style.setProperty('--current-link-color', linkColor || (isSent ? 'white' : 'var(--purple)'));
        }
    }, [linkColor, isSent]);

    // --- Specialized View: Rich Metadata (GC, BYU, etc.) ---
    const scripLower = (parsed.scriptureValue || '').toLowerCase();
    const isSpecialSource = scripLower.includes('general') || scripLower.includes('総大会') || scripLower.includes('byu') || scripLower.includes('other') || scripLower.includes('その他') || parsed.scriptureValue === '';

    // Memoized standard Markdown construction
    const standardMd = useMemo(() => {
        if (!parsed.isOriginalStructured) return parsed.finalSimpleContent;

        const showScripture = scripture || parsed.scriptureValue;
        const scriptureLabel = getNoteLabelFallback('noteLabels.scripture', language, t('noteLabels.scripture') || 'Scripture');
        const chapterLabel = getNoteLabelFallback('noteLabels.chapter', language, t('noteLabels.chapter') || 'Chapter');
        
        const scriptureLine = !isPlaceholderValue(showScripture) 
            ? `**${scriptureLabel}:** ${translateScriptureName(showScripture, t)}`
            : null;
        
        const showChapter = chapter || parsed.chapterValue;
        const chapterLine = (showChapter && !isPlaceholderValue(showChapter)) 
            ? `**${chapterLabel}:** ${translateChapterField(showChapter)}` 
            : null;
        
        const commentLabel = getNoteLabelFallback('noteLabels.comment', language, t('noteLabels.comment'));
        const commentWithLinks = parsed.comment.replace(/(https?:\/\/[^\s]+)/g, (match: string) => {
            const cleanUrl = match.replace(/[.,:;"')\]*_]+$/, '');
            const trailing = match.substring(cleanUrl.length);
            return `[${cleanUrl}](${cleanUrl})${trailing}`;
        });

        return [
            scriptureLine,
            chapterLine,
            `\n**${commentLabel}:**\n${commentWithLinks}`
        ].filter(Boolean).join('\n');
    }, [parsed, language, t, translateChapterField, scripture, chapter]);

    if (parsed.isOriginalStructured && parsed.primaryUrl && isSpecialSource) {
        return (
            <GCNoteRenderer
                scriptureValue={scripture || parsed.scriptureValue}
                comment={parsed.comment}
                url={chapter || parsed.primaryUrl || ''}
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

    // --- Standard View: Simple or Structured Scripture ---

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
                        a: ({ ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} />,
                        p: ({ ...p }) => <p {...p} />
                    }}
                >
                    {standardMd}
                </ReactMarkdown>
            </div>
            {showOriginal && (
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowOriginal(false); }}
                    className={`note-toggle-btn show-translation ${!parsed.isOriginalStructured ? 'simple' : ''}`}
                >
                    {t('groupChat.showTranslation') || 'Translate'}
                </button>
            )}
            {!parsed.isOriginalStructured && parsed.simpleUrls.length > 0 && (
                <div className="link-previews-container">
                    {parsed.simpleUrls.map((u, i) => (
                        <LinkPreview key={i} url={u} isSent={isSent} language={language || 'en'} t={t} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default NoteDisplay;


