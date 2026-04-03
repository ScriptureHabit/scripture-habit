import { useState, useEffect, FC } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './GroupOptions.css';
import { useLanguage } from '../../Context/LanguageContext';
import { auth, db } from '../../firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import WelcomeStoryModal from '../WelcomeStoryModal/WelcomeStoryModal';
import Mascot from '../Mascot/Mascot';
import { OptionsSkeleton } from '../Skeleton/Skeleton';
import { UserData } from '../../types/user';

const GroupOptions: FC = () => {
    const { t } = useLanguage();
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [showWelcomeStory, setShowWelcomeStory] = useState(false);
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
                });
                return () => unsubUser();
            } else {
                setLoading(false);
                // navigate('/login'); // Optional: redirect if not logged in
            }
        });

        return () => unsubscribe();
    }, [navigate]);

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
                        <Link to="/group-form" className="option-card create-card">
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
        </div>
    );
};

export default GroupOptions;
