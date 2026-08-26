import { useState, useEffect, useRef } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { parseTimestampToDate } from '../utils/time-utils';
import { playUnreadNotificationSound, isSoundEnabled } from '../utils/audio-feedback';
import { UserData } from '../types/user';

const SESSION_LETTER_ALERTED_KEY = 'sh_letter_audio_alerted_session';

/**
 * Real-time hook to track whether the user has unread letters (developer welcome letters)
 * or is eligible to generate a reflection letter (has at least 2 notes since last generation).
 * Plays an audio alert when newly available.
 */
export function useLetterAvailability(userData?: UserData | null): {
    isLetterAvailable: boolean;
    newNotesCount: number;
    hasUnreadDeveloperLetter: boolean;
    unreadLettersCount: number;
} {
    const [newNotesCount, setNewNotesCount] = useState(0);
    const [unreadDeveloperLettersCount, setUnreadDeveloperLettersCount] = useState(0);
    const prevAvailableRef = useRef<boolean | null>(null);
    const isFirstSnapshotRef = useRef<boolean>(true);

    useEffect(() => {
        if (!userData?.uid) {
            isFirstSnapshotRef.current = true;
            prevAvailableRef.current = null;
            return;
        }

        isFirstSnapshotRef.current = true;
        prevAvailableRef.current = null;

        const lastGenAt = userData?.lastLetterGeneratedAt || userData?.lastRecapGeneratedAt;

        // 1. Subscribe to notes count for AI reflection letter generation
        const notesRef = collection(db, 'users', userData.uid, 'notes');
        let notesQuery;
        if (lastGenAt) {
            const lastDate = parseTimestampToDate(lastGenAt);
            notesQuery = query(notesRef, where('createdAt', '>', lastDate), limit(2));
        } else {
            notesQuery = query(notesRef, limit(2));
        }

        const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
            setNewNotesCount(snapshot.size);
        }, (err) => {
            console.error('Error watching notes for letter availability:', err);
        });

        // 2. Subscribe to unread developer welcome letters
        const lettersRef = collection(db, 'users', userData.uid, 'letters');
        const lettersQuery = query(lettersRef, where('read', '==', false));

        const unsubscribeLetters = onSnapshot(lettersQuery, (snapshot) => {
            const unreadDevLetters = snapshot.docs.filter(doc => {
                const data = doc.data();
                return data.type === 'developer_welcome' || data.type === undefined;
            });
            setUnreadDeveloperLettersCount(unreadDevLetters.length);
        }, (err) => {
            console.error('Error watching letters for unread developer letter:', err);
        });

        return () => {
            unsubscribeNotes();
            unsubscribeLetters();
        };
    }, [userData?.uid, userData?.lastLetterGeneratedAt, userData?.lastRecapGeneratedAt]);

    const effectiveNotesCount = userData?.uid ? newNotesCount : 0;
    const effectiveUnreadDevCount = userData?.uid ? unreadDeveloperLettersCount : 0;
    const hasUnreadDeveloperLetter = effectiveUnreadDevCount > 0;
    const isLetterAvailable = effectiveNotesCount >= 2 || hasUnreadDeveloperLetter;

    useEffect(() => {
        if (!userData?.uid) return;

        const checkAndPlaySound = () => {
            if (!isLetterAvailable || !isSoundEnabled()) return;

            const alreadyAlerted = typeof sessionStorage !== 'undefined'
                ? sessionStorage.getItem(SESSION_LETTER_ALERTED_KEY) === 'true'
                : false;

            if (!alreadyAlerted) {
                playUnreadNotificationSound();
                if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.setItem(SESSION_LETTER_ALERTED_KEY, 'true');
                }
            }
        };

        if (isFirstSnapshotRef.current) {
            isFirstSnapshotRef.current = false;
            prevAvailableRef.current = isLetterAvailable;
            checkAndPlaySound();
        } else {
            if (prevAvailableRef.current === false && isLetterAvailable === true) {
                checkAndPlaySound();
            }
            prevAvailableRef.current = isLetterAvailable;
        }
    }, [isLetterAvailable, userData?.uid]);

    return {
        isLetterAvailable,
        newNotesCount: effectiveNotesCount,
        hasUnreadDeveloperLetter,
        unreadLettersCount: effectiveUnreadDevCount
    };
}
