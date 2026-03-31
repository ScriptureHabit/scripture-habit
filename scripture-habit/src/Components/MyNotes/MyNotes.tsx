import { useState, useEffect, useMemo, FC } from 'react';
import * as Sentry from "@sentry/react";
import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { db, auth } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc, updateDoc, increment, addDoc, serverTimestamp, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
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

interface MyNotesProps {
  userData: UserData;
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  userGroups: Group[];
}

const MyNotes: FC<MyNotesProps> = ({ userData, isModalOpen, setIsModalOpen, userGroups }) => {
  const { language, t } = useLanguage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const NOTES_PER_PAGE = 7;

  const [recapLoading, setRecapLoading] = useState(false);

  // Pagination State for Server-Side
  const [lastDocsStack, setLastDocsStack] = useState<DocumentSnapshot[]>([]); // Stack of document snapshots for cursors
  const [latestSnapshotDocs, setLatestSnapshotDocs] = useState<DocumentSnapshot[]>([]); // Snapshots of current view
  const [isLastPage, setIsLastPage] = useState(false);

  // New state for RecapModal
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);
  const [generatedRecapText, setGeneratedRecapText] = useState('');

  // New state for LetterBox
  const [isLetterBoxOpen, setIsLetterBoxOpen] = useState(false);

  // State to hold real-time user data
  const [currentUserData, setCurrentUserData] = useState<UserData>(userData);

  useEffect(() => {
    if (!userData || !userData.uid) return;

    // Listen to the user document specifically for lastRecapGeneratedAt updates
    const userDocRef = doc(db, 'users', userData.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUserData({ ...userData, ...docSnap.data() as UserData });
      }
    }, (err) => {
      console.error("Error listening to user doc in MyNotes:", err);
      const isQuota = err.code === 'resource-exhausted' || err.message.toLowerCase().includes('quota exceeded');
      if (isQuota) {
        toast.error(t('systemErrors.quotaExceededMessage'), { toastId: 'quota-error' });
      } else {
        Sentry.captureException(err);
      }
    });

    const notesRef = collection(db, 'users', userData.uid, 'notes');
    let q;

    if (searchTerm) {
      // SEARCH MODE: Fetch all (or large limit) and filter locally (Previous specific behavior preserved for search)
      // This allows the local search filter to work across all notes.
      q = query(
        notesRef,
        orderBy('createdAt', 'desc')
      );
    } else {
      // BROWSE MODE: Server-side pagination (Optimized for reads)
      const constraints: any[] = [orderBy('createdAt', 'desc')];

      // Apply Category Filter in DB (requires index)
      if (selectedCategory !== 'All') {
        constraints.push(where('scripture', '==', selectedCategory));
      }

      // Apply Cursor (Pagination)
      if (currentPage > 1 && lastDocsStack.length >= currentPage - 1) {
        const cursor = lastDocsStack[currentPage - 2];
        if (cursor) {
          constraints.push(startAfter(cursor));
        }
      }

      // Limit
      constraints.push(limit(NOTES_PER_PAGE));

      q = query(notesRef, ...constraints);
    }

    const unsubscribeNotes = onSnapshot(q, (querySnapshot) => {
      const fetchedNotes: Note[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as Note;
        fetchedNotes.push({ ...data, id: docSnap.id });
      });

      setLatestSnapshotDocs(querySnapshot.docs);
      setNotes(fetchedNotes);

      if (searchTerm) {
        // In search mode, we don't know "last page" by limit check easily, handled by client pagination
        setIsLastPage(false);
      } else {
        // In server mode, if we got fewer than limit, it's the last page
        setIsLastPage(fetchedNotes.length < NOTES_PER_PAGE);
      }

      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching notes:", error);
      const isQuota = error.code === 'resource-exhausted' || error.message.toLowerCase().includes('quota exceeded');
      const isIndexError = error.code === 'failed-precondition'; // Missing index

      if (isQuota) {
        toast.error(t('systemErrors.quotaExceededMessage'), { toastId: 'quota-error' });
      } else if (isIndexError) {
        console.error("Missing Index Link:", error.message);
        // toast.error("System: Index required for this category filter. Check console."); 
        // Failing silently-ish for user but logging for dev
      } else {
        Sentry.captureException(error);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribeNotes();
    };
  }, [userData, currentPage, selectedCategory, searchTerm, lastDocsStack, t]); // Depend on cursor stack indirectly via currentPage, but stack needed for construction

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
    setIsDetailModalOpen(true);
  };

  const handleGenerateRecap = async () => {
    // Check for rate limiting (6 days)
    if (currentUserData?.lastRecapGeneratedAt) {
      const lastGenerated = currentUserData.lastRecapGeneratedAt.toDate();
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - lastGenerated.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 6) {
        const daysLeft = 6 - diffDays;
        toast.info(t('groupChat.recapRateLimit') + " " + t('groupChat.daysLeft', { days: daysLeft })); // Reusing existing keys or add new if needed
        return;
      }
    }

    setRecapLoading(true);
    toast.info(t('myNotes.generatingRecap'));
    try {
      const apiUrl = Capacitor.isNativePlatform()
        ? 'https://scripturehabit.app/api/generate-personal-weekly-recap'
        : '/api/generate-personal-weekly-recap';

      if (!auth?.currentUser) {
        toast.error(t('systemErrors.notLoggedIn') || 'Not logged in');
        return;
      }
      const idToken = await auth.currentUser.getIdToken();

      const response = await axios.post(apiUrl, {
        uid: userData.uid,
        language: language
      }, {
        headers: { Authorization: `Bearer ${idToken}` }
      });

      if (response.data.recap) {
        setGeneratedRecapText(response.data.recap);
        setIsRecapModalOpen(true); // Open "Letter" modal first
        toast.success(t('myNotes.recapSuccess'));
      } else {
        toast.info(response.data.message || t('myNotes.noNotesForRecap'));
      }
    } catch (error: any) {
      console.error("Error generating recap:", error);
      toast.error(t('myNotes.recapError'));
    } finally {
      setRecapLoading(false);
    }
  };

  const handleSaveRecapToLetterBox = async () => {
    try {
      const lettersRef = collection(db, 'users', userData.uid, 'letters');

      // Extract a simple title if possible from the first line or default
      const lines = generatedRecapText.split('\n');
      let title = t('letterBox.defaultTitle') || "Weekly Recap";

      // Try to find a title line (e.g. "Title: ...") - Simple heuristic
      const titleLine = lines.find(line => line.toLowerCase().includes('title:') || line.includes('タイトル：'));
      if (titleLine) {
        title = titleLine.replace(/Title:|タイトル：/i, '').replace(/\*/g, '').trim();
      }

      await addDoc(lettersRef, {
        content: generatedRecapText,
        title: title,
        createdAt: serverTimestamp(),
        type: 'weekly_recap'
      });

      // Update the user's last generated timestamp
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, {
        lastRecapGeneratedAt: serverTimestamp()
      });

      setIsRecapModalOpen(false);
      toast.success(t('newNote.successPost') || "Saved to Letter Box!");
      setIsLetterBoxOpen(true); // Open the box to show the new item
    } catch (error: any) {
      console.error("Error saving to letter box:", error);
      toast.error(t('myNotes.letterSaveError') || "Failed to save letter.");
    }
  };

  const confirmDelete = async () => {
    if (!selectedNote || !userData.uid) return;

    try {
      // If note was shared to groups, delete those messages too
      if (selectedNote.sharedMessageIds && Object.keys(selectedNote.sharedMessageIds).length > 0) {
        for (const [groupId, messageId] of Object.entries(selectedNote.sharedMessageIds)) {
          try {
            const messageRef = doc(db, 'groups', groupId, 'messages', messageId);
            await deleteDoc(messageRef);

            // Decrement message count
            const groupRef = doc(db, 'groups', groupId);
            await updateDoc(groupRef, {
              messageCount: increment(-1),
              noteCount: increment(-1) // Decrement note count since shared notes are always notes
            });
          } catch (err: any) {
            console.log(`Could not delete message ${messageId} from group ${groupId}:`, err);
          }
        }
      }

      // Delete the personal note
      await deleteDoc(doc(db, 'users', userData.uid, 'notes', selectedNote.id));

      // Decrement totalNotes
      const userRef = doc(db, 'users', userData.uid);
      await updateDoc(userRef, {
        totalNotes: increment(-1)
      });

      toast.success(t('myNotes.noteDeletedSuccess') || "Note deleted successfully");
      setIsDeleteModalOpen(false);
      setIsEditModalOpen(false);
      setSelectedNote(null);
    } catch (error: any) {
      console.error("Error deleting note:", error);
      toast.error(t('myNotes.noteDeletedError') || "Failed to delete note");
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = (note.text || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.chapter || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || note.scripture === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Pagination logic

  // Calculate total pages ONLY for Search Mode (Client side)
  // For server side, we don't know total.
  const totalPages = searchTerm
    ? Math.ceil(filteredNotes.length / NOTES_PER_PAGE)
    : -1; // -1 indicates server side mode

  const paginatedNotes = useMemo(() => {
    if (searchTerm) {
      // Search Mode: Client-side slice
      const startIndex = (currentPage - 1) * NOTES_PER_PAGE;
      return filteredNotes.slice(startIndex, startIndex + NOTES_PER_PAGE);
    } else {
      // Server Mode: The fetched notes ARE the page
      // But filteredNotes logic (category match) currently runs on 'notes'.
      // In Server Mode, 'notes' is already filtered by DB query (mostly).
      // We return filteredNotes directly (which should be same as notes)
      return filteredNotes;
    }
  }, [filteredNotes, currentPage, searchTerm]);

  // Reset to first page when filtering or changing category
  useEffect(() => {
    setCurrentPage(1);
    setLastDocsStack([]); // Reset cursor stack
  }, [selectedCategory, searchTerm]);

  // Handle page changes
  const handleNextPage = () => {
    if (searchTerm) {
      if (currentPage < totalPages) handlePageChange(currentPage + 1);
    } else {
      // Server Mode Next
      if (!isLastPage && latestSnapshotDocs.length > 0) {
        const lastDoc = latestSnapshotDocs[latestSnapshotDocs.length - 1];
        setLastDocsStack(prev => [...prev, lastDoc]);
        handlePageChange(currentPage + 1);
      }
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      if (!searchTerm) {
        // Server Mode Prev: Pop stack
        setLastDocsStack(prev => prev.slice(0, -1));
      }
      handlePageChange(currentPage - 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const container = document.querySelector('.MyNotes');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Calculate if recap can be generated
  let canGenerateRecap = true;
  let daysLeft = 0;

  if (currentUserData?.lastRecapGeneratedAt) {
    const lastGenerated = currentUserData.lastRecapGeneratedAt.toDate();
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastGenerated.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 6) {
      canGenerateRecap = false;
      daysLeft = 6 - diffDays;
    }
  }

  return (
    <div className="MyNotes DashboardContent">
      <div className="dashboard-header" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
          {/* Generate Recap Card */}
          <div className={`action-card recap-card ${!canGenerateRecap || notes.length === 0 ? 'locked' : 'available'}`}>
            <button
              className="generate-recap-main-btn"
              onClick={(e) => {
                if (!canGenerateRecap || recapLoading || notes.length === 0) {
                  e.preventDefault();
                  return;
                }
                handleGenerateRecap();
              }}
              disabled={recapLoading || !canGenerateRecap || notes.length === 0}
            >
              <div className="btn-content">
                <UilAnalysis size="24" className="recap-icon" />
                <span>
                  {recapLoading ? t('myNotes.loading') :
                    !canGenerateRecap && notes.length > 0 ? t('groupChat.daysLeft', { days: daysLeft }) :
                      t('myNotes.generateRecap')}
                </span>
                {canGenerateRecap && notes.length > 0 && !recapLoading && <div className="stars-decoration">✨</div>}
              </div>
              <div className="shimmer-effect"></div>
            </button>
          </div>

          {/* Letter Box Card */}
          <div className="action-card letterbox-card" onClick={() => setIsLetterBoxOpen(true)}>
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
          {['Old Testament', 'New Testament', 'Book of Mormon', 'Doctrine and Covenants', 'Pearl of Great Price', 'Ordinances and Proclamations', 'General Conference', 'BYU Speeches', 'Other'].map(key => {
            const translationKeyMap: Record<string, string> = {
              'Old Testament': 'scriptures.oldTestament',
              'New Testament': 'scriptures.newTestament',
              'Book of Mormon': 'scriptures.bookOfMormon',
              'Doctrine and Covenants': 'scriptures.doctrineAndCovenants',
              'Pearl of Great Price': 'scriptures.pearlOfGreatPrice',
              'Ordinances and Proclamations': 'scriptures.ordinancesAndProclamations',
              'General Conference': 'scriptures.generalConference',
              'BYU Speeches': 'scriptures.byuSpeeches',
              'Other': 'scriptures.other'
            };
            return (
              <button
                key={key}
                className={`category-chip ${selectedCategory === key ? 'active' : ''}`}
                onClick={() => setSelectedCategory(key)}
              >
                {t(translationKeyMap[key])}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
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
            <div className="no-results" style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#999', padding: '2rem' }}>
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

      {/* Conditional Pagination Controls */}
      {searchTerm ? (
        // CLIENT SIDE PAGINATION (Search Mode)
        totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <UilAngleLeft size="20" />
              <span>{t('myNotes.prevPage')}</span>
            </button>

            <div className="page-indicator">
              {t('myNotes.pageInfo', { current: currentPage, total: totalPages })}
            </div>

            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <span>{t('myNotes.nextPage')}</span>
              <UilAngleRight size="20" />
            </button>
          </div>
        )
      ) : (
        // SERVER SIDE PAGINATION (Browse Mode)
        // Show if we have moved past page 1 OR if we have more to show
        (currentPage > 1 || (!isLastPage && notes.length === NOTES_PER_PAGE)) && (
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
            >
              <UilAngleLeft size="20" />
              <span>{t('myNotes.prevPage')}</span>
            </button>

            <div className="page-indicator">
              {/* Just show current page number since total is unknown */}
              Page {currentPage}
            </div>

            <button
              className="pagination-btn"
              onClick={handleNextPage}
              disabled={isLastPage || notes.length < NOTES_PER_PAGE}
            >
              <span>{t('myNotes.nextPage')}</span>
              <UilAngleRight size="20" />
            </button>
          </div>
        )
      )}

      {
        isDeleteModalOpen && (
          <div className="ModalOverlay" onClick={() => setIsDeleteModalOpen(false)} style={{ zIndex: 1100 }}>
            <div className="ModalContent delete-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{t('myNotes.deleteTitle')}</h3>
              <p>{t('myNotes.deleteConfirm')}</p>
              {selectedNote?.sharedMessageIds && Object.keys(selectedNote.sharedMessageIds).length > 0 && (
                <p style={{ color: '#ff9800', fontSize: '0.9rem', margin: '0.5rem 0' }}>
                  ⚠️ {t('groupChat.deleteNoteWarning')}
                </p>
              )}
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setIsDeleteModalOpen(false)}>{t('myNotes.cancel')}</button>
                <button className="delete-confirm-btn" onClick={confirmDelete}>{t('myNotes.delete')}</button>
              </div>
            </div>
          </div>
        )
      }

      <NoteDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        note={selectedNote}
        userData={userData}
        userGroups={userGroups}
        onEdit={() => {
          setIsDetailModalOpen(false);
          setIsEditModalOpen(true);
        }}
        onDelete={() => {
          setIsDetailModalOpen(false);
          setIsDeleteModalOpen(true);
        }}
      />

      <LetterBox
        isOpen={isLetterBoxOpen}
        onClose={() => setIsLetterBoxOpen(false)}
        userData={currentUserData}
      />

      <RecapModal
        isOpen={isRecapModalOpen}
        onClose={() => setIsRecapModalOpen(false)}
        recapText={generatedRecapText}
        onSave={handleSaveRecapToLetterBox}
      />

      <NewNote
        isOpen={isEditModalOpen || isModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setIsModalOpen(false); // Also close the passed in modal state for new notes
          setSelectedNote(null);
        }}
        userData={userData}
        noteToEdit={selectedNote || undefined}
      />

    </div >
  );
};

export default MyNotes;
