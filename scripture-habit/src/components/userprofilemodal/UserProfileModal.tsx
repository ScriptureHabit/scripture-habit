import { FC, useState } from 'react';
import './UserProfileModal.css';
import { UilTimes, UilFire, UilFileAlt } from '@iconscout/react-unicons';
import { useLanguage } from '../../Context/LanguageContext';
import { UserData } from '../../types/user';
import { UserProfile } from '../../types/chat';

interface UserProfileModalProps {
    user: UserData | UserProfile | null;
    onClose: () => void;
}

const UserProfileModal: FC<UserProfileModalProps> = ({ user, onClose }) => {
    const { t } = useLanguage();

    const [showFullImage, setShowFullImage] = useState(false);

    if (!user) return null;

    return (
        <div className="user-profile-modal-overlay" onClick={onClose}>
            <div className="user-profile-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>
                    <UilTimes size="24" />
                </button>
                <div className="modal-header">
                    <div
                        className={`user-avatar-large ${user.photoURL ? 'has-image' : ''}`}
                        onClick={() => user.photoURL && setShowFullImage(true)}
                        style={{ cursor: user.photoURL ? 'pointer' : 'default' }}
                    >
                        {user.photoURL ? (
                            <img src={user.photoURL} alt={user.nickname} className="avatar-img" />
                        ) : (
                            user.nickname ? user.nickname.substring(0, 1).toUpperCase() : '?'
                        )}
                    </div>
                </div>

                {showFullImage && user.photoURL && (
                    <div className="full-image-overlay" onClick={() => setShowFullImage(false)}>
                        <div className="full-image-content" onClick={(e) => e.stopPropagation()}>
                            <img src={user.photoURL} alt={user.nickname} className="full-avatar-img" />
                            <button className="full-image-close" onClick={() => setShowFullImage(false)}>
                                <UilTimes size="32" color="white" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="modal-body">
                    <h2 className="user-nickname">{user.nickname}</h2>

                    {(user.stake || user.ward) && (
                        <div className="user-location">
                            {user.stake && <span className="location-tag">{user.stake}</span>}
                            {user.ward && <span className="location-tag">{user.ward}</span>}
                        </div>
                    )}

                    {user.bio && (
                        <div className="user-bio">
                            <p>{user.bio}</p>
                        </div>
                    )}

                    <div className="user-stats">
                        <div className="stat-box">
                            <div className="stat-icon level">
                                <span style={{ fontWeight: '800', fontSize: '1.2rem' }}>L</span>
                            </div>
                            <div className="stat-info">
                                <span className="stat-value">{Math.floor((user.daysStudiedCount || 0) / 7) + 1}</span>
                                <span className="stat-label">{t('profile.level')}</span>
                            </div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-icon fire">
                                <UilFire />
                            </div>
                            <div className="stat-info">
                                <span className="stat-value">{user.streakCount || 0}</span>
                                <span className="stat-label">{t('dashboard.streak')}</span>
                            </div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-icon notes">
                                <UilFileAlt />
                            </div>
                            <div className="stat-info">
                                <span className="stat-value">{user.totalNotes || 0}</span>
                                <span className="stat-label">{t('dashboard.totalNotes')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
