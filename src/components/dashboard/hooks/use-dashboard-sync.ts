import { useMemo, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { doc, collection, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
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
    const migrationInProgress = useRef(false);

    const state = useMemo<DashboardSyncStatus>(() => {
        if (loading) {
            if (userData) {
                return { status: 'authenticated', user: (user || { uid: userData.uid }) as User, userData };
            }
            return { status: 'loading', user: null, userData: null };
        } else if (error) {
            return { status: 'error', user, userData, message: error.message };
        } else if (user) {
            if (userData) {
                return { status: 'authenticated', user, userData };
            } else {
                return { status: 'loading', user, userData: null };
            }
        } else {
            return { status: 'unauthenticated', user: null, userData: null };
        }
    }, [user, userData, loading, error]);

    // Level Migration / Fix Logic
    useEffect(() => {
        const migrateLevelData = async () => {
            if (migrationInProgress.current) return;
            if (state.status !== 'authenticated') return;
            
            const { user, userData } = state;

            // PREVENT REPEAT RUNS: Only run if not already migrated OR studiedDates is missing
            const needsLevelMigration = userData && !userData.isLevelMigrated && (
                userData.daysStudiedCount === undefined ||
                (userData.daysStudiedCount < (userData.streakCount || 0))
            );
            const needsCalendarMigration = userData && !userData.studiedDates;

            if (!needsLevelMigration && !needsCalendarMigration) return;
            
            migrationInProgress.current = true;
            console.log("Migration triggered: fixing level/calendar stats once...");
            try {
                const userRef = doc(db, 'users', user.uid);
                const notesRef = collection(db, 'users', user.uid, 'notes').withConverter(noteConverter);
                
                // 1. Fetch all notes to rebuild history
                const notesSnapshot = await getDocs(notesRef);
                const totalNotesCount = notesSnapshot.size;
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

                const sortedDates = Array.from(studyDays).sort();
                const finalDaysCount = Math.max(studyDays.size, userData.streakCount || 0);

                await updateDoc(userRef, {
                    daysStudiedCount: finalDaysCount,
                    totalNotes: totalNotesCount,
                    studiedDates: sortedDates,
                    isLevelMigrated: true // LOCK THE MIGRATION SUCCESS
                });
                console.log(`Migration finished: ${finalDaysCount} days, ${sortedDates.length} dates recorded.`);
            } catch (err) {
                console.error("Error during data migration:", err);
            }
        };

        if (state.status === 'authenticated') {
            migrateLevelData();
        }
    }, [state, userData?.uid, userData?.isLevelMigrated]);

    return state;
};
