
import { useState, Suspense } from 'react';
import { UilBookOpen, UilSearchAlt, UilEnvelopeEdit, UilEnvelopeOpen, UilAngleLeft, UilAngleRight } from '@iconscout/react-unicons';
import { Mailbox } from 'lucide-react';
import { lazyWithRetry } from '../../utils/lazy-with-retry';
const NewNote = lazyWithRetry(() => import('../newnote/new-note'));
import NoteCard from '../notecard/note-card';
import RecapModal from '../recapmodal/recap-modal';
import LetterBox from '../letterbox/letter-box';
import { toast } from 'react-toastify';
import './my-notes.css';
import { useLanguage } from '../../hooks/use-language';
import NoteDetailModal from './note-detail-modal';
import Mascot from '../mascot/mascot';
import { NoteGridSkeleton } from '../skeleton/skeleton';

import { UserData } from '../../types/user';
import { Group } from '../../types/chat';
import { Note } from '../../types/note';
import { NoteCategory } from '../../types/scripture';
import { useNoteActions } from './hooks/use-note-actions';

// Hooks
import { useMyNotes } from './hooks/use-my-notes';
import { useRecap } from './hooks/use-recap';
import { useLetterAvailability } from '../../hooks/use-letter-availability';

// Types
import { SCRIPTURE_CATEGORIES, CATEGORY_TRANSLATION_MAP } from '../../types/scripture';
import { useApiWarmupOnMount } from '../../utils/api-warmup';

interface MyNotesProps {
  userData: UserData;
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  userGroups: Group[];
}

const MyNotes = ({ userData, isModalOpen, setIsModalOpen, userGroups }: MyNotesProps) => {
  useApiWarmupOnMount();
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
    totalCount,
    currentPage,
    isLastPage,
    handleNextPage,
    handlePrevPage
  } = useMyNotes(userData, selectedCategory, searchTerm, NOTES_PER_PAGE);

  // 2. Recap/Letter Feature Hook
  const {
    recapLoading,
    isRecapModalOpen,
    generatedRecapText,
    generatedRecapTitle,
    isFromCache,
    canGenerateRecap,
    notesRemaining,
    newNotesCount,
    hasPreviousLetter,
    setIsRecapModalOpen,
    handleGenerateRecap,
    handleSaveRecapToLetterBox
  } = useRecap(userData, language, t);

  // 3. Unread Developer Letter Hook
  const { hasUnreadDeveloperLetter, unreadLettersCount } = useLetterAvailability(userData);

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

  const totalPages = Math.ceil(totalCount / NOTES_PER_PAGE);
  const displayNotes = notes; // Server already filtered and paginated these

  const currentCount = newNotesCount ?? Math.max(0, 2 - notesRemaining);
  const progressPercent = Math.min(100, Math.max(0, (currentCount / 2) * 100));

  return (
    <div className="MyNotes">
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
          <div className={`action-card recap-card ${canGenerateRecap ? 'available' : (hasPreviousLetter ? 'view-cached available' : 'locked')}`}>
            <button
              className={`generate-recap-main-btn ${!canGenerateRecap ? 'view-cached' : ''}`}
              onClick={() => handleGenerateRecap(canGenerateRecap, hasPreviousLetter)}
              disabled={recapLoading || (!canGenerateRecap && !hasPreviousLetter)}
            >
              <div className="btn-content flex-column">
                {canGenerateRecap ? (
                  // --- Ready State (2/2 Notes) ---
                  <>
                    <div className="btn-main-row">
                      <UilEnvelopeOpen size="24" className="recap-icon" />
                      <span>
                        {recapLoading ? t('myNotes.loading') : t('myNotes.generateRecap')}
                      </span>
                      {!recapLoading && <div className="stars-decoration">✨</div>}
                    </div>
                    {!recapLoading && (
                      <div className="btn-sub-row">
                        {t('myNotes.newLetterReadySub')}
                      </div>
                    )}
                  </>
                ) : (
                  // --- Waiting State (0/2 or 1/2 Notes with Progress Gauge on 2nd row) ---
                  <>
                    <div className="btn-main-row waiting-header-row">
                      <UilEnvelopeEdit size="20" className="recap-icon waiting-icon" />
                      <span className="waiting-title">
                        {t('myNotes.preparingNextLetter')}
                        <span className="waiting-count-badge">({currentCount}/2)</span>
                      </span>
                    </div>
                    <div className="recap-progress-track">
                      <div
                        className="recap-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
              {canGenerateRecap && <div className="shimmer-effect"></div>}
            </button>
          </div>

          <div
            className={`action-card letterbox-card ${hasUnreadDeveloperLetter ? 'has-unread' : ''}`}
            onClick={() => setActiveModal('letterbox')}
            data-testid="letterbox-card"
          >
            <div className="mailbox-visual">
              <Mailbox size={26} className="envelope-icon" />
              <div className="mailbox-flag"></div>
            </div>
            <span className="letterbox-label">{t('letterBox.title')}</span>
            {hasUnreadDeveloperLetter && (
              <span className="letterbox-unread-badge" data-testid="letterbox-unread-badge">
                {unreadLettersCount}
              </span>
            )}
            <div className="hover-indicator"></div>
          </div>
        </div>
      </div>

      <div className="search-and-filter-container">
        <div className="search-bar-container">
          <UilSearchAlt className="search-icon" size="20" />
          <input
            id="my-notes-search"
            name="search"
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
        <div data-testid="notes-loading-skeleton">
          <NoteGridSkeleton />
        </div>
      ) : notes.length === 0 ? (
        <div className="empty-state" data-testid="notes-empty-state">
          <UilBookOpen size="60" color="#ccc" />
          <h3>{t('myNotes.noNotesTitle')}</h3>
          <p>{t('myNotes.noNotesDesc')}</p>
        </div>
      ) : (
        <div className="notes-grid" data-testid="notes-grid">
          {displayNotes.length === 0 && notes.length > 0 ? (
            <div className="no-results-container">
              {t('dashboard.noRecentNotes')}
            </div>
          ) : displayNotes.map((note) => (
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

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button className="pagination-btn" onClick={handlePrevPage} disabled={currentPage === 1}>
            <UilAngleLeft size="20" />
            <span>{t('myNotes.prevPage')}</span>
          </button>
          <div className="page-indicator">
            {t('myNotes.pageInfo', { current: currentPage, total: totalPages })}
          </div>
          <button className="pagination-btn" onClick={handleNextPage} disabled={isLastPage}>
            <span>{t('myNotes.nextPage')}</span>
            <UilAngleRight size="20" />
          </button>
        </div>
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
        title={generatedRecapTitle}
        onSave={handleSaveRecapToLetterBox}
        isFromCache={isFromCache}
      />

      <Suspense fallback={null}>
        {(activeModal === 'edit' || isModalOpen) && (
          <NewNote
            isOpen={true}
            onClose={() => { setActiveModal(null); setIsModalOpen(false); setSelectedNote(null); }}
            userData={userData}
            noteToEdit={selectedNote || undefined}
          />
        )}
      </Suspense>
    </div>
  );
};

export default MyNotes;


