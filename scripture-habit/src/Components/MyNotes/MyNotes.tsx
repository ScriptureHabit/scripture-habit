import { useState, useMemo, FC } from 'react';
import { UilBookOpen, UilSearchAlt, UilAnalysis, UilEnvelope, UilAngleLeft, UilAngleRight } from '@iconscout/react-unicons';
import NewNote from '../NewNote/NewNote';
import NoteCard from '../NoteCard/NoteCard';
import RecapModal from '../RecapModal/RecapModal';
import LetterBox from '../LetterBox/LetterBox';
import { toast } from 'react-toastify';
import './MyNotes.css';
import { useLanguage } from '../../Context/LanguageContext';
import NoteDetailModal from './NoteDetailModal';
import Mascot from '../Mascot/Mascot';
import { NoteGridSkeleton } from '../Skeleton/Skeleton';

import { UserData } from '../../types/user';
import { Group } from '../../types/chat';
import { Note } from '../../types/note';
import { NoteCategory } from '../../types/scripture';
import { useNoteActions } from './hooks/useNoteActions';

// Hooks
import { useMyNotes } from './hooks/useMyNotes';
import { useRecap } from './hooks/useRecap';

// Types
import { SCRIPTURE_CATEGORIES, CATEGORY_TRANSLATION_MAP } from '../../types/scripture';
import { parseTimestampToDate } from '../../Utils/timeUtils';

interface MyNotesProps {
  userData: UserData;
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  userGroups: Group[];
}

const MyNotes: FC<MyNotesProps> = ({ userData, isModalOpen, setIsModalOpen, userGroups }) => {
  const { language, t } = useLanguage();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  type ActiveModalType = 'detail' | 'delete' | 'edit' | 'letterbox' | null;
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory>('All');
  const NOTES_PER_PAGE = 7;

  const { deleteNote } = useNoteActions(userData);

  // 1. Data Fetching Hook
  const {
    status,
    notes,
    currentPage,
    isLastPage,
    handleNextPage,
    handlePrevPage
  } = useMyNotes(userData, selectedCategory, searchTerm, NOTES_PER_PAGE);

  // 2. Recap Feature Hook
  const {
    recapLoading,
    isRecapModalOpen,
    generatedRecapText,
    setIsRecapModalOpen,
    handleGenerateRecap,
    handleSaveRecapToLetterBox
  } = useRecap(userData, language, t);

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
    setActiveModal('detail');
  };

  const confirmDelete = async () => {
    if (!selectedNote || !userData?.uid) return;

    const deleted = await deleteNote(selectedNote);
    if (deleted) {
      toast.success(t('myNotes.noteDeletedSuccess'));
      setActiveModal(null);
      setSelectedNote(null);
    } else {
      toast.error(t('myNotes.noteDeletedError'));
    }
  };

  const filteredNotes = useMemo(() => notes.filter(note => {
    const text = note.text || '';
    const chapter = note.chapter || '';
    const matchesSearch = text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          chapter.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }), [notes, searchTerm]);

  const totalPages = searchTerm ? Math.ceil(filteredNotes.length / NOTES_PER_PAGE) : -1;

  const paginatedNotes = useMemo(() => {
    if (searchTerm) {
      const startIndex = (currentPage - 1) * NOTES_PER_PAGE;
      return filteredNotes.slice(startIndex, startIndex + NOTES_PER_PAGE);
    }
    return filteredNotes;
  }, [filteredNotes, currentPage, searchTerm]);

  // Recap Logic
  let canGenerateRecap = true;
  let recapDaysLeft = 0;

  if (userData?.lastRecapGeneratedAt) {
    const lastGenerated = parseTimestampToDate(userData.lastRecapGeneratedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastGenerated.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 6) {
      canGenerateRecap = false;
      recapDaysLeft = 6 - diffDays;
    }
  }

  return (
    <div className="MyNotes DashboardContent">
      <div className="my-notes-header">
        <div>
          <h1>Scripture Habit</h1>
          <p className="welcome-text">{t('myNotes.description')}</p>
        </div>
      </div>

      <Mascot
        userData={userData}
        customMessage={t('mascot.weeklyRecapPrompt') || ''}
        reversed={true}
      />

      <div className="my-notes-action-center">
        <div className="action-card-container">
          <div className={`action-card recap-card ${!canGenerateRecap || notes.length === 0 ? 'locked' : 'available'}`}>
            <button
              className="generate-recap-main-btn"
              onClick={() => handleGenerateRecap(notes.length)}
              disabled={recapLoading || !canGenerateRecap || notes.length === 0}
            >
              <div className="btn-content">
                <UilAnalysis size="24" className="recap-icon" />
                <span>
                  {recapLoading ? t('myNotes.loading') :
                    !canGenerateRecap && notes.length > 0 ? t('groupChat.daysLeft', { days: recapDaysLeft }) :
                      t('myNotes.generateRecap')}
                </span>
                {canGenerateRecap && notes.length > 0 && !recapLoading && <div className="stars-decoration">✨</div>}
              </div>
              <div className="shimmer-effect"></div>
            </button>
          </div>

          <div className="action-card letterbox-card" onClick={() => setActiveModal('letterbox')}>
            <div className="mailbox-visual">
              <UilEnvelope size="32" className="envelope-icon" />
              <div className="mailbox-flag"></div>
            </div>
            <span className="letterbox-label">{t('letterBox.title')}</span>
            <div className="hover-indicator"></div>
          </div>
        </div>
      </div>

      <div className="search-and-filter-container">
        <div className="search-bar-container">
          <UilSearchAlt className="search-icon" size="20" />
          <input
            type="text"
            className="search-input"
            placeholder={t('myNotes.searchPlaceholder') || ''}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="category-filters">
          <button
            className={`category-chip ${selectedCategory === 'All' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('All')}
          >
            {t('dashboard.seeAll')}
          </button>
          {SCRIPTURE_CATEGORIES.map(key => (
            <button
              key={key}
              className={`category-chip ${selectedCategory === key ? 'active' : ''}`}
              onClick={() => setSelectedCategory(key)}
            >
              {t(CATEGORY_TRANSLATION_MAP[key])}
            </button>
          ))}
        </div>
      </div>

      {status === 'loading' ? (
        <NoteGridSkeleton />
      ) : notes.length === 0 ? (
        <div className="empty-state">
          <UilBookOpen size="60" color="#ccc" />
          <h3>{t('myNotes.noNotesTitle')}</h3>
          <p>{t('myNotes.noNotesDesc')}</p>
        </div>
      ) : (
        <div className="notes-grid">
          {filteredNotes.length === 0 && notes.length > 0 ? (
            <div className="no-results-container">
              {t('dashboard.noRecentNotes')}
            </div>
          ) : paginatedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isEditable={true}
              onClick={handleNoteClick}
              className="my-notes-card"
            />
          ))}
        </div>
      )}

      {searchTerm ? (
        totalPages > 1 && (
          <div className="pagination-controls">
            <button className="pagination-btn" onClick={handlePrevPage} disabled={currentPage === 1}>
              <UilAngleLeft size="20" />
              <span>{t('myNotes.prevPage')}</span>
            </button>
            <div className="page-indicator">
              {t('myNotes.pageInfo', { current: currentPage, total: totalPages })}
            </div>
            <button className="pagination-btn" onClick={handleNextPage} disabled={currentPage === totalPages}>
              <span>{t('myNotes.nextPage')}</span>
              <UilAngleRight size="20" />
            </button>
          </div>
        )
      ) : (
        (currentPage > 1 || (!isLastPage && notes.length === NOTES_PER_PAGE)) && (
          <div className="pagination-controls">
            <button className="pagination-btn" onClick={handlePrevPage} disabled={currentPage === 1}>
              <UilAngleLeft size="20" />
              <span>{t('myNotes.prevPage')}</span>
            </button>
            <div className="page-indicator">Page {currentPage}</div>
            <button className="pagination-btn" onClick={handleNextPage} disabled={isLastPage || notes.length < NOTES_PER_PAGE}>
              <span>{t('myNotes.nextPage')}</span>
              <UilAngleRight size="20" />
            </button>
          </div>
        )
      )}

      {activeModal === 'delete' && (
        <div className="ModalOverlay delete-modal-overlay-custom" onClick={() => setActiveModal(null)}>
          <div className="ModalContent delete-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('myNotes.deleteTitle')}</h3>
            <p>{t('myNotes.deleteConfirm')}</p>
            {selectedNote?.sharedMessageIds && Object.keys(selectedNote.sharedMessageIds).length > 0 && (
              <p className="delete-note-warning-text">
                ⚠️ {t('groupChat.deleteNoteWarning')}
              </p>
            )}
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setActiveModal(null)}>{t('myNotes.cancel')}</button>
              <button className="delete-confirm-btn" onClick={confirmDelete}>{t('myNotes.delete')}</button>
            </div>
          </div>
        </div>
      )}

      <NoteDetailModal
        isOpen={activeModal === 'detail'}
        onClose={() => setActiveModal(null)}
        note={selectedNote}
        userData={userData}
        userGroups={userGroups}
        onEdit={() => setActiveModal('edit')}
        onDelete={() => setActiveModal('delete')}
      />

      <LetterBox
        isOpen={activeModal === 'letterbox'}
        onClose={() => setActiveModal(null)}
        userData={userData}
      />

      <RecapModal
        isOpen={isRecapModalOpen}
        onClose={() => setIsRecapModalOpen(false)}
        recapText={generatedRecapText}
        onSave={handleSaveRecapToLetterBox}
      />

      <NewNote
        isOpen={activeModal === 'edit' || isModalOpen}
        onClose={() => { setActiveModal(null); setIsModalOpen(false); setSelectedNote(null); }}
        userData={userData}
        noteToEdit={selectedNote || undefined}
      />
    </div>
  );
};

export default MyNotes;
