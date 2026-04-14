import { FC } from 'react';
import { getGospelLibraryUrl } from '../../../utils/gospel-library-mapper';

interface GospelLinkProps {
  text: string;
  scripture?: string;
  chapter?: string;
  language: string;
  isSent: boolean;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const GospelLink: FC<GospelLinkProps> = ({ text, scripture, chapter, language, isSent, t }) => {
  // 1. Better search for URL specifically (most important for GC/BYU/Other)
  const urlMatch = text.match(/(?:\*\*|)(?:Url|リンク)(?:\*\*|)(?::|：)[\s\u3000]*(.*?)(?:\n|$)/i);
  // 2. Generic label search (for scriptures)
  const labelMatch = text.match(/(?:\*\*|)(?:Chapter|Talk|お話|Speech|スピーチ|Title|タイトル|章)(?:\*\*|)(?::|：)[\s\u3000]*(.*?)(?:\n|$)/i);
  const scriptureMatch = text.match(/(?:\*\*|)(?:Scripture|Category|カテゴリ)(?:\*\*|)(?::|：)[\s\u3000]*(.*?)(?:\n|$)/i);

  // Aggressively strip asterisks and trim
  const finalScripture = (scripture || (scriptureMatch ? scriptureMatch[1].trim() : null))?.replace(/\*/g, '').trim();
  // Prioritize urlMatch result over labelMatch
  const finalChapter = (chapter || (urlMatch ? urlMatch[1].trim() : (labelMatch ? labelMatch[1].trim() : null)))?.replace(/\*/g, '').trim();

  if (finalScripture && finalChapter) {
    const scripLower = finalScripture.toLowerCase();
    const isOther = scripLower.includes('other') || scripLower.includes('その他') || finalScripture === '';
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
