
import { useState, Suspense } from 'react';
import { UilBookOpen, UilSearchAlt, UilAnalysis, UilEnvelope, UilAngleLeft, UilAngleRight } from '@iconscout/react-unicons';
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

// Types
import { SCRIPTURE_CATEGORIES, CATEGORY_TRANSLATION_MAP } from '../../types/scripture';
import { parseTimestampToDate } from '../../utils/time-utils';
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

  // 2. Recap Feature Hook
  const {
    recapLoading,
    isRecapModalOpen,
    generatedRecapText,
    isFromCache,
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

  const totalPages = Math.ceil(totalCount / NOTES_PER_PAGE);
  const displayNotes = notes; // Server already filtered and paginated these


  // Recap Logic
  let canGenerateRecap = true;
  let daysRemaining = 0;

  if (userData?.lastRecapGeneratedAt) {
    const lastGenerated = parseTimestampToDate(userData.lastRecapGeneratedAt);
    const now = new Date();
    const diffTime = now.getTime() - lastGenerated.getTime();
    const cooldownMs = 6 * 24 * 60 * 60 * 1000; // 6 days in milliseconds

    if (diffTime < cooldownMs) {
      canGenerateRecap = false;
      const remainingMs = cooldownMs - diffTime;
      daysRemaining = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
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
          <div className={`action-card recap-card ${!canGenerateRecap ? 'view-cached available' : ((canGenerateRecap && notes.length > 0) ? 'available' : 'locked')}`}>
            <button
              className={`generate-recap-main-btn ${!canGenerateRecap ? 'view-cached' : ''}`}
              onClick={() => handleGenerateRecap(notes.length)}
              disabled={recapLoading || (canGenerateRecap && notes.length === 0)}
            >
              <div className="btn-content flex-column">
                <div className="btn-main-row">
                  <UilAnalysis size="24" className="recap-icon" />
                  <span>
                    {recapLoading ? (canGenerateRecap ? t('myNotes.loading') : (t('myNotes.fetchingRecentRecap') || "Retrieving...")) :
                      !canGenerateRecap ? (t('myNotes.viewRecentRecap') || "✨ View Recent Recap") :
                        t('myNotes.generateRecap')}
                  </span>
                  {!recapLoading && <div className="stars-decoration">✨</div>}
                </div>
                {!canGenerateRecap && !recapLoading && (
                  <div className="btn-sub-row">
                    {t('myNotes.nextLetterInDays', { days: daysRemaining }) || `(新しい手紙まであと ${daysRemaining} 日)`}
                  </div>
                )}
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


