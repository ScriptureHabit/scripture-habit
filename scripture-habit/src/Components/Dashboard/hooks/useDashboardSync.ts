import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, collection, getDocs, updateDoc, Timestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '../../../firebase';
import { UserData } from '../../../types/user';
import { useAuth } from '../../../Context/AuthContext';
import { noteConverter } from '../../../Utils/firestoreConverters';

export type DashboardSyncStatus = 
  | { status: 'loading'; user: User | null; userData: UserData | null }
  | { status: 'unauthenticated'; user: null; userData: null }
  | { status: 'authenticated'; user: User; userData: UserData }
  | { status: 'error'; user: User | null; userData: UserData | null; message: string };

export const useDashboardSync = () => {
    const { user, userData, loading, error } = useAuth();
    const [state, setState] = useState<DashboardSyncStatus>({ status: 'loading', user: null, userData: null });

    useEffect(() => {
        if (loading) {
            setState({ status: 'loading', user: null, userData: null });
        } else if (error) {
            setState({ status: 'error', user, userData, message: error.message });
        } else if (user && userData) {
            setState({ status: 'authenticated', user, userData });
        } else {
            setState({ status: 'unauthenticated', user: null, userData: null });
        }
    }, [user, userData, loading, error]);

    // Level Migration / Fix Logic
    useEffect(() => {
        const migrateLevelData = async () => {
            if (state.status !== 'authenticated') return;
            
            const { user, userData } = state;

            // PREVENT REPEAT RUNS: Only run if not already migrated AND data seems broken
            const needsMigration = userData && !userData.isLevelMigrated && (
                userData.daysStudiedCount === undefined ||
                (userData.daysStudiedCount < (userData.streakCount || 0))
            );

            if (!needsMigration) return;

            console.log("Migration triggered: fixing level stats once...");
            try {
                const notesRef = collection(db, 'users', user.uid, 'notes').withConverter(noteConverter);
                
                // 1. Efficiency: Use server-side count if available (low cost)
                const countSnap = await getCountFromServer(notesRef);
                const totalNotesCount = countSnap.data().count;

                if (totalNotesCount === 0) {
                    await updateDoc(doc(db, 'users', user.uid), {
                        daysStudiedCount: 0,
                        totalNotes: 0,
                        isLevelMigrated: true
                    });
                    return;
                }

                // 2. Perform one-time aggregation for unique study days
                const notesSnapshot = await getDocs(notesRef);
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
    }, [state.status, userData?.uid, userData?.isLevelMigrated]);

    return state;
};
