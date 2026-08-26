import { useState, useEffect, useRef } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { parseTimestampToDate } from '../utils/time-utils';
import { playUnreadNotificationSound, isSoundEnabled } from '../utils/audio-feedback';
import { UserData } from '../types/user';

const SESSION_LETTER_ALERTED_KEY = 'sh_letter_audio_alerted_session';

/**
 * Real-time hook to track whether the user is eligible to generate a reflection letter
 * (has at least 2 notes since last generation or in total).
 * Plays an audio alert when newly eligible.
 */
export function useLetterAvailability(userData?: UserData | null): {
    isLetterAvailable: boolean;
    newNotesCount: number;
} {
    const [newNotesCount, setNewNotesCount] = useState(0);
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

        try {
            const notesRef = collection(db, 'users', userData.uid, 'notes');
            let q;
            if (lastGenAt) {
                const lastDate = parseTimestampToDate(lastGenAt);
                q = query(notesRef, where('createdAt', '>', lastDate), limit(2));
            } else {
                q = query(notesRef, limit(2));
            }

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const count = snapshot.size;
                setNewNotesCount(count);
                const isAvailable = count >= 2;

                if (isFirstSnapshotRef.current) {
                    isFirstSnapshotRef.current = false;
                    prevAvailableRef.current = isAvailable;

                    if (isAvailable && isSoundEnabled()) {
                        const alreadyAlerted = typeof sessionStorage !== 'undefined'
                            ? sessionStorage.getItem(SESSION_LETTER_ALERTED_KEY) === 'true'
                            : false;

                        if (!alreadyAlerted) {
                            playUnreadNotificationSound();
                            if (typeof sessionStorage !== 'undefined') {
                                sessionStorage.setItem(SESSION_LETTER_ALERTED_KEY, 'true');
                            }
                        }
                    }
                } else {
                    if (prevAvailableRef.current === false && isAvailable === true && isSoundEnabled()) {
                        playUnreadNotificationSound();
                        if (typeof sessionStorage !== 'undefined') {
                            sessionStorage.setItem(SESSION_LETTER_ALERTED_KEY, 'true');
                        }
                    }
                    prevAvailableRef.current = isAvailable;
                }
            }, (err) => {
                console.error('Error watching notes for letter availability:', err);
            });

            return () => unsubscribe();
        } catch (e) {
            console.warn('Failed to subscribe to notes for letter availability:', e);
        }
    }, [userData?.uid, userData?.lastLetterGeneratedAt, userData?.lastRecapGeneratedAt]);

    const effectiveCount = userData?.uid ? newNotesCount : 0;
    const isLetterAvailable = effectiveCount >= 2;

    return {
        isLetterAvailable,
        newNotesCount: effectiveCount
    };
}
