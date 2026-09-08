import React from 'react';
import './family-study-note-card.css';

interface FamilyStudyNoteCardProps {
  themeId?: string;
  themeName?: string;
  isSent?: boolean;
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

export const FamilyStudyNoteCard: React.FC<FamilyStudyNoteCardProps> = ({
  themeId,
  themeName,
  isSent = false,
  t,
}) => {
  const displayTheme = themeId ? t(`familyTheme.themes.${themeId}`) : (themeName || '');
  const title = t('familyTheme.familyStudyNoteTitle');
  const themeLabel = t('familyTheme.familyStudyNoteTheme', { theme: displayTheme });
  const body = t('familyTheme.familyStudyNoteBody', { theme: displayTheme });

  return (
    <div className={`family-study-note-card ${isSent ? 'is-sent' : 'is-received'}`}>
      <div className="family-study-note-header">
        <span className="family-study-note-badge">{title}</span>
      </div>
      <div className="family-study-note-theme-pill">
        <span className="family-study-note-theme-text">{themeLabel}</span>
      </div>
      <div className="family-study-note-body">
        <p className="family-study-note-text">{body}</p>
      </div>
    </div>
  );
};

export default FamilyStudyNoteCard;
