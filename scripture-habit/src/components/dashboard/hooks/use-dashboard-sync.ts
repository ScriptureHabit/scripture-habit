import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { doc, collection, getDocs, updateDoc, Timestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '../../../firebase';
import { UserData } from '../../../types/user';
import { useAuth } from '../../../hooks/use-auth';

import { noteConverter } from '../../../utils/firestore-converters';

export type DashboardSyncStatus = 
  | { status: 'loading'; user: User | null; userData: UserData | null }
  | { status: 'unauthenticated'; user: null; userData: null }
  | { status: 'authenticated'; user: User; userData: UserData }
  | { status: 'error'; user: User | null; userData: UserData | null; message: string };

export const useDashboardSync = () => {
    const { user, userData, loading, error } = useAuth();
    const [state, setState] = useState<DashboardSyncStatus>({ status: 'loading', user: null, userData: null });
    const migrationInProgress = useRef(false);

    useEffect(() => {
        if (loading) {
            setState({ status: 'loading', user: null, userData: null });
        } else if (error) {
            setState({ status: 'error', user, userData, message: error.message });
        } else if (user) {
            if (userData) {
                setState({ status: 'authenticated', user, userData });
            } else {
                setState({ status: 'loading', user, userData: null });
            }
        } else {
            setState({ status: 'unauthenticated', user: null, userData: null });
        }
    }, [user, userData, loading, error]);

    // Level Migration / Fix Logic
    useEffect(() => {
        const migrateLevelData = async () => {
            if (migrationInProgress.current) return;
            if (state.status !== 'authenticated') return;
            
            const { user, userData } = state;

            // PREVENT REPEAT RUNS: Only run if not already migrated AND data seems broken
            const needsMigration = userData && !userData.isLevelMigrated && (
                userData.daysStudiedCount === undefined ||
                (userData.daysStudiedCount < (userData.streakCount || 0))
            );

            if (!needsMigration) return;
            
            migrationInProgress.current = true;
            console.log("Migration triggered: fixing level stats once...");
            try {
                console.log("[Migration] Fetching notes count...");
                const notesRef = collection(db, 'users', user.uid, 'notes').withConverter(noteConverter);
                
                // 1. Efficiency: Use server-side count if available (low cost)
                const countSnap = await getCountFromServer(notesRef);
                const totalNotesCount = countSnap.data().count;
                console.log(`[Migration] Total notes count: ${totalNotesCount}`);

                if (totalNotesCount === 0) {
                    console.log("[Migration] No notes found, updating metadata...");
                    await updateDoc(doc(db, 'users', user.uid), {
                        daysStudiedCount: 0,
                        totalNotes: 0,
                        isLevelMigrated: true
                    });
                    console.log("[Migration] Finished (Zero notes).");
                    return;
                }

                // 2. Perform one-time aggregation for unique study days
                console.log("[Migration] Fetching all notes for date aggregation...");
                const notesSnapshot = await getDocs(notesRef);
                console.log(`[Migration] Fetched ${notesSnapshot.size} notes.`);
                const studyDays = new Set<string>();
                notesSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.createdAt) {
                        const createdAt = data.createdAt as unknown as Timestamp;
                        if (createdAt?.toDate) {
                            const dateStr = createdAt.toDate().toLocaleDateString('sv-SE');
                            studyDays.add(dateStr);
                        }
                    }
                });

                const finalDaysCount = Math.max(studyDays.size, userData.streakCount || 0);
                console.log(`[Migration] Final days count calculated: ${finalDaysCount}. Updating user document...`);

                await updateDoc(doc(db, 'users', user.uid), {
                    daysStudiedCount: finalDaysCount,
                    totalNotes: totalNotesCount,
                    isLevelMigrated: true // LOCK THE MIGRATION SUCCESS
                });
                console.log(`Level data corrected: ${finalDaysCount} days studied.`);
            } catch (err) {
                console.error("Error during level data migration:", err);
            }
        };

        if (state.status === 'authenticated') {
            migrateLevelData();
        }
    }, [state, userData?.uid, userData?.isLevelMigrated]);

    return state;
};
