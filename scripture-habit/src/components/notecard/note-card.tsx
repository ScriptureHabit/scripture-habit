
import { FC, MouseEvent } from 'react';
import NoteDisplay from '../notedisplay/note-display';
import { getGospelLibraryUrl } from '../../utils/gospelLibraryMapper';
import { useLanguage } from '../../hooks/useLanguage';
import { parseTimestampToDate } from '../../utils/timeUtils';
import './note-card.css';
import { Note } from '../../types/note';

interface NoteCardProps {
    note: Note;
    isEditable?: boolean;
    onClick?: (note: Note) => void;
    className?: string;
}

const NoteCard: FC<NoteCardProps> = ({
    note,
    isEditable = false,
    onClick,
    className = ''
}) => {
    const { language, t } = useLanguage();

    const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>) => {
        e.stopPropagation();
    };

    const getLinkContent = () => {
        if (note.scripture === 'Other' && note.chapter) {
            return (
                <a
                    href={note.chapter}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleLinkClick}
                    className="gospel-link"
                >
                    📖 {t('myNotes.readStudyMaterial')}
                </a>
            );
        }

        const url = getGospelLibraryUrl(note.scripture || '', note.chapter || '', language);
        if (url) {
            return (
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleLinkClick}
                    className="gospel-link"
                >
                    📖 {note.scripture === 'BYU Speeches' ? t('myNotes.goToByuSpeech') : t('myNotes.readInGospelLibrary')}
                </a>
            );
        }
        return null;
    };

    return (
        <div
            className={`note-card ${isEditable ? 'editable' : ''} ${className}`}
            onClick={isEditable ? () => onClick && onClick(note) : undefined}
            data-testid="note-card"
        >
            <div className="note-header">
                <span className="note-date">
                    {note.createdAt ? parseTimestampToDate(note.createdAt).toLocaleDateString(language === 'en' ? 'sv-SE' : language) : 'Unknown Date'}
                </span>
            </div>
            <div className="note-content-preview">
                {/* Force isSent={true} for card display to ensure links are styled correctly for light backgrounds (or as configured in NoteDisplay) */}
                <NoteDisplay text={note.text || ''} isSent={false} linkColor="inherit" scripture={note.scripture} chapter={note.chapter} />
            </div>
            {getLinkContent()}
        </div>
    );
};

export default NoteCard;


