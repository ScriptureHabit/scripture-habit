import { FC, MouseEvent } from 'react';
import NoteDisplay from '../NoteDisplay/NoteDisplay';
import { getGospelLibraryUrl } from '../../Utils/gospelLibraryMapper';
import { useLanguage } from '../../Context/LanguageContext';
import './NoteCard.css';
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
            className={`note-card ${className}`}
            onClick={isEditable ? () => onClick && onClick(note) : undefined}
            style={{ cursor: isEditable ? 'pointer' : 'default' }}
        >
            <div className="note-header">
                <span className="note-date">
                    {note.createdAt?.toDate().toLocaleDateString(language === 'en' ? 'sv-SE' : language) || 'Unknown Date'}
                </span>
            </div>
            <div className="note-content-preview">
                {/* Force isSent={true} for card display to ensure links are styled correctly for light backgrounds (or as configured in NoteDisplay) */}
                <NoteDisplay text={note.text || ''} isSent={false} linkColor="#1E88E5" />
            </div>
            {getLinkContent()}
        </div>
    );
};

export default NoteCard;
