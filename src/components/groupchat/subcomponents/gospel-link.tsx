import { getGospelLibraryUrl } from '../../../utils/gospel-library-mapper';
import { parseStructuredNoteText, ParsedNote } from '../../../utils/note-parser-utils';
import { isOtherCategory, isByuSpeeches } from '../../notedisplay/utils/note-translations';

interface GospelLinkProps {
  text: string;
  scripture?: string;
  chapter?: string;
  language: string;
  isSent: boolean;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const GospelLink = ({ text, scripture, chapter, language, isSent, t }: GospelLinkProps) => {
  // Use the shared multi-language note parser
  const parsed: ParsedNote = parseStructuredNoteText(text);

  // Aggressively strip asterisks and trim
  const rawPropScripture = scripture?.replace(/\*/g, '').trim();
  const isPropOther = isOtherCategory(rawPropScripture);
  const finalScripture = (!isPropOther ? rawPropScripture : parsed.scriptureValue)?.replace(/\*/g, '').trim();
  const finalChapter = (chapter || parsed.chapterValue)?.replace(/\*/g, '').trim();

  if (finalScripture && finalChapter) {
    const isOther = isOtherCategory(finalScripture) || finalScripture === '';
    const isBYU = isByuSpeeches(finalScripture);

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
