
import { useState, useEffect, FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './group-options.css';
import { useLanguage } from '../../hooks/use-language';
import { auth, db } from '../../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import WelcomeStoryModal from '../welcomestorymodal/welcome-story-modal';
import GroupOptionsTour from './group-options-tour';
import Mascot from '../mascot/mascot';
import { OptionsSkeleton } from '../skeleton/skeleton';
import { UserData } from '../../types/user';

const GroupOptions: FC = () => {
    const { t } = useLanguage();
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [showWelcomeStory, setShowWelcomeStory] = useState(false);
    const [showTour, setShowTour] = useState(false);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth!, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const unsubUser = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUserData({ uid: currentUser.uid, ...data } as UserData);

                        // Show welcome story if not seen yet
                        if (data.hasSeenWelcomeStory === undefined) {
                            setTimeout(() => setShowWelcomeStory(true), 100);
                        }
                    }
                    setLoading(false);
                }, (err) => {
                    if (err.code !== 'permission-denied') console.error("[GroupOptions] User data listener error:", err);
                    setLoading(false);
                });
                return () => unsubUser();
            } else {
                setLoading(false);
                // navigate('/login'); // Optional: redirect if not logged in
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    useEffect(() => {
        // Skip tour guide during automated E2E testing to prevent overlays from blocking playwright clicks
        const isE2E = typeof navigator !== 'undefined' && navigator.webdriver;
        if (isE2E) return;

        if (!loading && userData && userData.uid && 
            userData.hasSeenWelcomeStory === true && 
            userData.hasSeenGroupOptionsTour !== true) {
            const timer = setTimeout(() => setShowTour(true), 800);
            return () => clearTimeout(timer);
        }
    }, [userData, loading]);

    const handleCloseWelcomeStory = async () => {
        setShowWelcomeStory(false);
        if (user && userData && userData.hasSeenWelcomeStory === undefined) {
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    hasSeenWelcomeStory: true
                });
            } catch (error) {
                console.error("Error marking welcome story as seen:", error);
            }
        }
    };

    const handleCloseTour = async () => {
        setShowTour(false);
        if (user && userData && userData.hasSeenGroupOptionsTour !== true) {
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    hasSeenGroupOptionsTour: true
                });
            } catch (error) {
                console.error("[GroupOptions] Error marking group options tour as seen:", error);
            }
        }
    };

    if (loading) {
        return (
            <div className="App GroupOptions">
                <div className="AppGlass options-container">
                    <OptionsSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="App GroupOptions">
            <div className="AppGlass options-container">
                <h2>{t('groupOptions.title')}</h2>

                <div className="options-grid">
                    <div className="option-wrapper">
                        <div className="card-mascot">
                            <Mascot
                                userData={userData}
                                customMessage={t('mascot.createGroupPrompt2')}
                            />
                        </div>
                        <Link to="/group-form" className="option-card create-card" data-testid="create-group-card">
                            <div className="icon">✨</div>
                            <h3>{t('groupOptions.createGroupTitle')}</h3>
                            <p>{t('groupOptions.createGroupDesc')}</p>
                        </Link>
                    </div>

                    <div className="option-wrapper join-wrapper">
                        <div className="card-mascot">
                            <Mascot
                                userData={userData}
                                customMessage={t('mascot.joinGroupPrompt')}
                                reversed={true}
                            />
                        </div>
                        <Link to="/join-group" className="option-card join-card">
                            <div className="icon">🔍</div>
                            <h3>{t('groupOptions.joinGroupTitle')}</h3>
                            <p>{t('groupOptions.joinGroupDesc')}</p>
                        </Link>
                    </div>
                </div>

                <Link to="/dashboard" className="back-link">
                    {t('groupOptions.backToDashboard')}
                </Link>
            </div>

            <WelcomeStoryModal
                isOpen={showWelcomeStory}
                onClose={handleCloseWelcomeStory}
                userData={userData}
            />

            <GroupOptionsTour
                isOpen={showTour}
                onClose={handleCloseTour}
                t={t}
            />
        </div>
    );
};

export default GroupOptions;


