import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, collection, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
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
            const needsMigration = userData && (
                userData.daysStudiedCount === undefined ||
                (userData.daysStudiedCount < (userData.streakCount || 0))
            );

            if (!needsMigration) return;

            console.log("Migration/Fix triggered: calculating accurate daysStudiedCount...");
            try {
                const notesRef = collection(db, 'users', user.uid, 'notes').withConverter(noteConverter);
                const notesSnapshot = await getDocs(notesRef);

                const studyDays = new Set<string>();
                notesSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.createdAt) {
                        const createdAt = data.createdAt as unknown as Timestamp;
                        if (createdAt?.toDate) {
                            const date = createdAt.toDate();
                            const dateStr = date.toLocaleDateString('sv-SE');
                            studyDays.add(dateStr);
                        }
                    }
                });

                const initialDaysCount = Math.max(studyDays.size, userData.streakCount || 0);

                if (initialDaysCount !== userData.daysStudiedCount) {
                    await updateDoc(doc(db, 'users', user.uid), {
                        daysStudiedCount: initialDaysCount,
                        totalNotes: userData.totalNotes || notesSnapshot.size
                    });
                    console.log(`Level data corrected: ${initialDaysCount} days studied.`);
                }
            } catch (err) {
                console.error("Error during level data migration:", err);
            }
        };

        if (state.status === 'authenticated') {
            migrateLevelData();
        }
    }, [state]);

    return state;
};
