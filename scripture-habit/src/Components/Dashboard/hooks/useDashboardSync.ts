import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../../firebase';
import { UserData } from '../../../types/user';

export const useDashboardSync = () => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth!, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const userDocRef = doc(db, 'users', currentUser.uid);
                    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data() as any;
                            setUserData({ uid: currentUser.uid, ...data });
                            setLoading(false);
                            setError(null);
                        } else {
                            console.log("User profile document no longer exists.");
                            setLoading(false);
                        }
                    }, (err: any) => {
                        if (err.code === 'permission-denied') {
                            console.log("Silenced permission error during possible logout/deletion.");
                            setLoading(false);
                            return;
                        }
                        console.error("Error fetching user data:", err);
                        setError(err.message);
                        setLoading(false);
                    });
                    return () => unsubUser();
                } catch (err: any) {
                    console.error("Error setting up user listener:", err);
                    setError(err.message);
                    setLoading(false);
                }
            } else {
                setUserData(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Level Migration / Fix Logic
    useEffect(() => {
        const migrateLevelData = async () => {
            const needsMigration = userData && (
                userData.daysStudiedCount === undefined ||
                (userData.daysStudiedCount < (userData.streakCount || 0))
            );

            if (!user || !userData || !needsMigration) return;

            console.log("Migration/Fix triggered: calculating accurate daysStudiedCount...");
            try {
                const notesRef = collection(db, 'users', user.uid, 'notes');
                const notesSnapshot = await getDocs(notesRef);

                const studyDays = new Set<string>();
                notesSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    if (data.createdAt) {
                        const date = (data.createdAt as Timestamp).toDate();
                        const dateStr = date.toLocaleDateString('sv-SE');
                        studyDays.add(dateStr);
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

        if (!loading) {
            migrateLevelData();
        }
    }, [user, userData?.daysStudiedCount, userData?.streakCount, userData?.uid, loading]);

    return { user, userData, setUserData, loading, setLoading, error, setError };
};
