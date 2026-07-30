import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit, startAfter, DocumentSnapshot, QueryConstraint, getCountFromServer } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Note } from '../../../types/note';
import { UserData } from '../../../types/user';
import { NoteCategory } from '../../../types/scripture';
import { noteConverter } from '../../../utils/firestore-converters';
import { createSearchTokens } from '../../../utils/search-token-utils';

export type NoteFetchStatus = 
  | { status: 'loading'; notes: Note[] }
  | { status: 'success'; notes: Note[] }
  | { status: 'error'; notes: Note[]; error: Error };

export const useMyNotes = (userData: UserData, selectedCategory: NoteCategory, searchTerm: string, notesPerPage: number) => {
  const normalizedSearchTerm = searchTerm.trim().slice(0, 100);
  const [dataState, setDataState] = useState<NoteFetchStatus>({ status: 'loading', notes: [] });
  const [currentPage, setCurrentPage] = useState(1);
  const [lastDocsStack, setLastDocsStack] = useState<DocumentSnapshot[]>([]);

  const [latestSnapshotDocs, setLatestSnapshotDocs] = useState<DocumentSnapshot[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLastPage, setIsLastPage] = useState(false);

  // Sync total count separately
  useEffect(() => {
    if (!userData?.uid) return;

    const notesRef = collection(db, 'users', userData.uid, 'notes').withConverter(noteConverter);
    const constraints: QueryConstraint[] = [];
    if (selectedCategory !== 'All') {
      constraints.push(where('scripture', '==', selectedCategory));
    }
    if (normalizedSearchTerm) {
      const tokens = createSearchTokens(normalizedSearchTerm).slice(0, 10);
      if (tokens.length > 0) {
        constraints.push(where('searchTokens', 'array-contains-any', tokens));
      }
    }

    const q = query(notesRef, ...constraints);
    getCountFromServer(q).then(snap => {
      setTotalCount(snap.data().count);
    }).catch(err => console.error("Error counting notes:", err));
  }, [userData?.uid, selectedCategory, normalizedSearchTerm]);


  useEffect(() => {
    if (!userData?.uid) return;

    const notesRef = collection(db, 'users', userData.uid, 'notes').withConverter(noteConverter);
    
    let q;
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (selectedCategory !== 'All') {
      constraints.push(where('scripture', '==', selectedCategory));
    }

    if (normalizedSearchTerm) {
      const tokens = createSearchTokens(normalizedSearchTerm).slice(0, 10);
      if (tokens.length > 0) {
        constraints.unshift(where('searchTokens', 'array-contains-any', tokens));
      }
      if (currentPage > 1 && lastDocsStack.length >= currentPage - 1) {
        const cursor = lastDocsStack[currentPage - 2];
        if (cursor) constraints.push(startAfter(cursor));
      }
      constraints.push(limit(notesPerPage));
      q = query(notesRef, ...constraints);
    } else {
      if (currentPage > 1 && lastDocsStack.length >= currentPage - 1) {
        const cursor = lastDocsStack[currentPage - 2];
        if (cursor) constraints.push(startAfter(cursor));
      }
      constraints.push(limit(notesPerPage));
      q = query(notesRef, ...constraints);
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotes = snapshot.docs.map(d => d.data());
      setLatestSnapshotDocs(snapshot.docs);
      
      setDataState({ status: 'success', notes: fetchedNotes });
      setIsLastPage(fetchedNotes.length < notesPerPage);

    }, (error) => {
      console.error("Error fetching notes:", error);
      setDataState(prev => ({ status: 'error', notes: prev.notes, error: error as Error }));
    });

    return () => unsubscribe();
  }, [userData?.uid, currentPage, selectedCategory, normalizedSearchTerm, lastDocsStack, notesPerPage]);

  const handleNextPage = () => {
    if (!isLastPage && latestSnapshotDocs.length > 0) {
      const lastDoc = latestSnapshotDocs[latestSnapshotDocs.length - 1];
      setLastDocsStack(prev => [...prev, lastDoc]);
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setLastDocsStack(prev => prev.slice(0, -1));
      setCurrentPage(prev => prev - 1);
    }
  };

  return {
    ...dataState,
    currentPage,
    setCurrentPage,
    isLastPage,
    totalCount,
    handleNextPage,
    handlePrevPage,
    setLastDocsStack
  };
};
