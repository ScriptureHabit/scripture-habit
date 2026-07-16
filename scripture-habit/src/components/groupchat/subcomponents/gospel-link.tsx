import { FC } from 'react';
import { getGospelLibraryUrl } from '../../../utils/gospel-library-mapper';
import { parseStructuredNoteText } from '../../../utils/note-parser-utils';

interface GospelLinkProps {
  text: string;
  scripture?: string;
  chapter?: string;
  language: string;
  isSent: boolean;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const GospelLink: FC<GospelLinkProps> = ({ text, scripture, chapter, language, isSent, t }) => {
  // Use the shared multi-language note parser
  const parsed = parseStructuredNoteText(text);

  // Aggressively strip asterisks and trim
  const finalScripture = (scripture || parsed.scriptureValue)?.replace(/\*/g, '').trim();
  const finalChapter = (chapter || parsed.chapterValue)?.replace(/\*/g, '').trim();

  if (finalScripture && finalChapter) {
    const scripLower = finalScripture.toLowerCase();
    const isOther = 
      scripLower.includes('other') || 
      scripLower.includes('その他') || 
      scripLower.includes('otros') || 
      scripLower.includes('outros') || 
      scripLower.includes('기타') || 
      scripLower.includes('其他') || 
      scripLower.includes('khác') || 
      scripLower.includes('iba pa') || 
      scripLower.includes('nyingine') || 
      scripLower.includes('อื่นๆ') || 
      finalScripture === '';
    const isBYU = scripLower.includes('byu');

    // CASE A: Direct URL (Other, GC, BYU with full URL)
    if (finalChapter.toLowerCase().startsWith('http')) {
      let linkLabel = t('dashboard.readInGospelLibrary');
      if (isOther) linkLabel = t('dashboard.readStudyMaterial');
      else if (isBYU) linkLabel = t('dashboard.goToByuSpeech');

      return (
        <a
          href={finalChapter}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`gospel-link ${isSent ? 'sent' : ''}`}
        >
          {linkLabel}
        </a>
      );
    }

    // CASE B: Scripture reference or GC shortcode (handled by Mapper)
    const url = getGospelLibraryUrl(finalScripture, finalChapter, language);

    if (url) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`gospel-link ${isSent ? 'sent' : ''}`}
        >
          {isBYU ? t('dashboard.goToByuSpeech') : (isOther ? t('dashboard.readStudyMaterial') : t('dashboard.readInGospelLibrary'))}
        </a>
      );
    }
  }

  return null;
};

export default GospelLink;
