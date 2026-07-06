import { useState, useEffect, FC, useRef, ChangeEvent } from 'react';
import './profile.css';
import { useLanguage } from '../../hooks/use-language';
import { useSettings } from '../../context/settings-context';
import { auth, storage } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { UilSignOutAlt, UilCamera, UilCalendarAlt, UilCompass } from '@iconscout/react-unicons';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-toastify';
import Button from '../button/button';
import { DEFAULT_KICK_THRESHOLD } from '../../constants';
import { requestNotificationPermission, disableNotifications } from '../../utils/notification-helper';
import { UserData } from '../../types/user';
import apiClient from '../../utils/api-client';

interface ProfileStats {
    streak: number;
    totalNotes: number;
    daysStudied: number;
}

interface ProfileProps {
    userData: UserData;
    stats: ProfileStats;
}


const Profile: FC<ProfileProps> = ({ userData, stats }) => {
    const { language, setLanguage, t } = useLanguage();
    const { fontSize, setFontSize } = useSettings();
    const navigate = useNavigate();
    const initializedRef = useRef(false);
    const [nickname, setNickname] = useState('');
    const [stake, setStake] = useState('');
    const [ward, setWard] = useState('');
    const [bio, setBio] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showSignOutModal, setShowSignOutModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmNickname, setConfirmNickname] = useState('');
    const [notifPermission, setNotifPermission] = useState(window.Notification ? window.Notification.permission : 'default');
    const [isNotifLoading, setIsNotifLoading] = useState(false);
    const [localKickThreshold, setLocalKickThreshold] = useState<number | undefined>(userData?.kickThreshold);
    const [photoURL, setPhotoURL] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // PWA Install properties
    const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isStandalone, setIsStandalone] = useState(false);
    const levelProgressRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (levelProgressRef.current) {
            const progress = ((stats.daysStudied || 0) % 7) / 7 * 100;
            levelProgressRef.current.style.setProperty('--progress-width', `${progress}%`);
        }
    }, [stats.daysStudied]);

    useEffect(() => {
        // Platform detection
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isAndroid = /Android/i.test(ua);

        const standaloneCheck = window.matchMedia('(display-mode: standalone)').matches || 
                             navigator.standalone || 
                             document.referrer.includes('android-app://');
        setIsStandalone(!!standaloneCheck);

        if (!standaloneCheck) {
            if (isIOS) setPlatform('ios');
            else if (isAndroid) setPlatform('android');
        }

        const checkPrompt = () => {
            if (window.deferredPWAPrompt) {
                setDeferredPrompt(window.deferredPWAPrompt);
                setPlatform('android');
            }
        };

        checkPrompt();
        // Check more frequently initially, then slow down
        const interval = setInterval(checkPrompt, 1000);
        const timeout = setTimeout(() => clearInterval(interval), 10000); // Stop after 10s if not found

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
    };

    useEffect(() => {
        if (window.Notification) {
            setNotifPermission(window.Notification.permission);
        }
    }, []);

    const handleToggleNotifications = async () => {
        if (!window.Notification || !userData?.uid) return;

        const prevPermission = notifPermission;
        const isCurrentlyGranted = window.Notification.permission === 'granted' && notifPermission === 'granted';

        // 楽観的UI：即座にトグルを反映する
        setNotifPermission(isCurrentlyGranted ? 'default' : 'granted');
        setIsNotifLoading(true);

        if (isCurrentlyGranted) {
            const success = await disableNotifications(userData.uid);
            if (success) {
                toast.success(t('profile.notificationToggle.disabledSuccess'));
            } else {
                // 失敗時は元に戻す
                setNotifPermission(prevPermission);
            }
        } else {
            try {
                const getTranslatedText = (key: string, defaultText: string) => t(key) || defaultText;
                await requestNotificationPermission(userData.uid, getTranslatedText);
                setNotifPermission(window.Notification.permission);
            } catch (err: unknown) {
                console.error("Toggle error:", err);
                // 失敗時は元に戻す
                setNotifPermission(prevPermission);
                toast.error(t('profile.notificationToggle.error') || "Failed to update notification settings.");
            }
        }
        setIsNotifLoading(false);
    };

    useEffect(() => {
        if (userData && !initializedRef.current) {
            if (userData.nickname) setNickname(userData.nickname);
            if (userData.stake) setStake(userData.stake);
            if (userData.ward) setWard(userData.ward);
            if (userData.bio) setBio(userData.bio);
            if (userData.photoURL) setPhotoURL(userData.photoURL);
            if (userData.kickThreshold) setLocalKickThreshold(userData.kickThreshold);
            initializedRef.current = true;
        }
    }, [userData]);

    const resizeImage = (file: File, targetSize: number = 400): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event: ProgressEvent<FileReader>) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error("Could not get canvas context"));
                        return;
                    }

                    // Center Crop to Square
                    let sourceX, sourceY, sourceWidth, sourceHeight;
                    if (img.width > img.height) {
                        sourceWidth = img.height;
                        sourceHeight = img.height;
                        sourceX = (img.width - img.height) / 2;
                        sourceY = 0;
                    } else {
                        sourceWidth = img.width;
                        sourceHeight = img.width;
                        sourceX = 0;
                        sourceY = (img.height - img.width) / 2;
                    }

                    canvas.width = targetSize;
                    canvas.height = targetSize;

                    // Enable high quality image scaling
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    ctx.drawImage(
                        img,
                        sourceX, sourceY, sourceWidth, sourceHeight, // Source
                        0, 0, targetSize, targetSize               // Destination
                    );

                    canvas.toBlob((blob: Blob | null) => {
                        if (blob) resolve(blob);
                        else reject(new Error("Canvas toBlob failed"));
                    }, 'image/jpeg', 0.85); // Compress quality
                };
            };
            reader.onerror = (error: ProgressEvent<FileReader>) => reject(error);
        });
    };

    const handlePhotoClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userData?.uid) return;

        // Increased limit to 20MB for modern smartphone photos
        if (file.size > 20 * 1024 * 1024) {
            toast.error(t('profile.imageTooLarge') || "Image is too large. Please pick a smaller one.");
            return;
        }

        setIsUploading(true);
        try {
            // Automatically resize and crop to 400x400 square
            const resizedBlob = await resizeImage(file, 400);

            // Upload to Firebase Storage
            const storageRef = ref(storage, `profile_pictures/${userData.uid}.jpg`);
            await uploadBytes(storageRef, resizedBlob);

            // Get download URL
            const url = await getDownloadURL(storageRef);

            // Use Backend API for update and sync with apiClient (handles auth and app check)
            await apiClient.post('/api/auth/update-profile', { photoURL: url });

            setPhotoURL(url);
            toast.success(t('profile.imageUploadSuccess') || "Profile picture updated!");
        } catch {
            toast.error(t('profile.imageUploadError') || "Failed to update profile picture.");
        } finally {
            setIsUploading(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleSaveProfile = async () => {
        if (!nickname.trim()) return;
        const newStake = stake.trim();
        const newWard = ward.trim();
        const newBio = bio.trim();
        const newNickname = nickname.trim();

        if (newNickname === userData?.nickname && newStake === (userData?.stake || '') && newWard === (userData?.ward || '') && newBio === (userData?.bio || '')) {
            return;
        }

        setIsSaving(true);
        try {
            await apiClient.post('/api/auth/update-profile', {
                nickname: newNickname,
                stake: newStake,
                ward: newWard,
                bio: newBio
            });

            toast.success(t('profile.successUpdate') || "Profile updated successfully!");
        } catch {
            const errorMsg = t('profile.errorUpdate') || "Failed to update profile.";
            toast.error(errorMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSignOut = () => {
        setShowSignOutModal(true);
    };

    const confirmSignOut = () => {
        auth?.signOut();
        navigate('/welcome');
        setShowSignOutModal(false);
    };

    const handleDeleteAccount = async () => {
        const user = auth?.currentUser;
        if (!user) return;

        setIsDeleting(true);
        try {
            const response = await apiClient.post('/api/auth/delete-account');

            if (response.status === 200) {
                toast.success(t('profile.deleteAccountSuccess'));
                await auth?.signOut();
                navigate('/welcome');
            } else {
                const errorData = response.data;
                console.error("Server-side deletion failed:", errorData);
                toast.error(t('profile.deleteAccountError') || "Error deleting account");
                // If it failed but maybe partially deleted, we should still sign out to be safe
                await auth?.signOut();
                navigate('/welcome');
            }
        } catch (err: unknown) {
            console.error("Error during account deletion process:", err);
            toast.error(t('profile.deleteAccountError') || "Error deleting account");
            await auth?.signOut();
            navigate('/welcome');
        } finally {
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    return (
        <div className="profile">
            <div className="dashboard-header">
                <h1 data-testid="profile-title">{t('profile.title')}</h1>
                <p className="welcome-text">{t('profile.description')}</p>
            </div>

            <div className="profile-photo-section">
                <div className="avatar-container" onClick={handlePhotoClick}>
                    {photoURL ? (
                        <img src={photoURL} alt="Avatar" className="profile-avatar-img" />
                    ) : (
                        <div className="profile-avatar-placeholder">
                            {nickname ? nickname.substring(0, 1).toUpperCase() : '?'}
                        </div>
                    )}
                    <div className="avatar-overlay">
                        {isUploading ? <div className="spinner-small"></div> : <UilCamera size="24" color="white" />}
                    </div>
                </div>
                <input
                    id="profile-photo-input"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden-input"
                    title={t('profile.photoHint') || "Change profile picture"}
                />
                <p className="photo-hint">{t('profile.photoHint') || "Tap to change profile picture"}</p>
            </div>

            <div className="profile-section notification-toggle-section">
                <div className="notif-text">
                    <h2 className="notif-title">{t('profile.notificationToggle.title')}</h2>
                    <p className="notif-desc">{t('profile.notificationToggle.description')}</p>
                </div>
                <div className="switch-wrapper">
                    <label className="switch" htmlFor="notif-toggle-input">
                        <input
                            id="notif-toggle-input"
                            type="checkbox"
                            aria-label={t('profile.notificationToggle.title')}
                            checked={notifPermission === 'granted'}
                            onChange={handleToggleNotifications}
                            disabled={isNotifLoading || notifPermission === 'denied'}
                        />
                        <span className="slider round"></span>
                    </label>
                    {notifPermission === 'denied' && (
                        <span className="status-blocked">{t('profile.notificationToggle.statusBlocked')}</span>
                    )}
                </div>
            </div>

            {/* PWA Install App Section */}
            {!isStandalone && platform && (
                <div className="profile-section install-app-section">
                    <h2 className="section-title">{t('profile.installApp.title') || (language === 'ja' ? 'アプリをインストール' : 'Install App')}</h2>
                    <p className="section-desc">
                        {t('profile.installApp.description') || (language === 'ja' ? 'ホーム画面に追加してアプリとしてご利用いただけます。' : 'Add to home screen for a better app experience.')}
                    </p>
                    {platform === 'ios' ? (
                        <div className="ios-instruction">
                            <p className="instruction-text">
                                {t('profile.installApp.iosInstruction')}
                            </p>
                        </div>
                    ) : (
                        <div className="android-install-container">
                            {deferredPrompt ? (
                                <Button
                                    onClick={handleInstallClick}
                                    className="install-btn"
                                >
                                    {t('profile.installApp.androidButton')}
                                </Button>
                            ) : (
                                <div className="android-instruction">
                                    <p className="instruction-text">
                                        {t('profile.installApp.androidInstruction') || (language === 'ja' ? 'ブラウザのメニュー（︙）から「アプリをインストール」または「ホーム画面に追加」を選択してください。' : "Open your browser menu (⋮) and select 'Install app' or 'Add to Home Screen'.")}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="profile-section">
                <div className="input-group">
                    <label className="input-label" htmlFor="profile-nickname">{t('profile.nickname')}</label>
                    <input
                        id="profile-nickname"
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder={t('groupChat.enterNewNickname') || ''}
                        className="profile-input"
                        data-testid="profile-nickname-input"
                        maxLength={30}
                    />
                </div>
                <div className="input-group">
                    <label className="input-label" htmlFor="profile-stake">{t('profile.stake')}</label>
                    <input
                        id="profile-stake"
                        type="text"
                        value={stake}
                        onChange={(e) => setStake(e.target.value)}
                        placeholder={t('profile.enterStake') || ''}
                        className="profile-input"
                    />
                </div>
                <div className="input-group">
                    <label className="input-label" htmlFor="profile-ward">{t('profile.ward')}</label>
                    <input
                        id="profile-ward"
                        type="text"
                        value={ward}
                        onChange={(e) => setWard(e.target.value)}
                        placeholder={t('profile.enterWard') || ''}
                        className="profile-input"
                    />
                </div>
                <div className="input-group">
                    <label className="input-label" htmlFor="profile-bio">{t('profile.bio')}</label>
                    <input
                        id="profile-bio"
                        type="text"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder={t('profile.enterBio') || ''}
                        className="profile-input"
                    />
                </div>
                <Button
                    onClick={handleSaveProfile}
                    disabled={isSaving || !nickname.trim() || (nickname === userData?.nickname && stake === (userData?.stake || '') && ward === (userData?.ward || '') && bio === (userData?.bio || ''))}
                    className="save-btn"
                    data-testid="profile-save-button"
                >
                    {isSaving ? t('newNote.saving') : t('profile.save')}
                </Button>
                {stats && (
                    <div className="profile-stats">
                        <div className="level-section">
                            <div className="level-badge">
                                <span className="level-number">{Math.floor((stats.daysStudied || 0) / 7) + 1}</span>
                                <span className="level-text">{t('profile.level')}</span>
                            </div>
                            <div className="level-progress-container">
                                <div className="level-progress-info">
                                    <span>{t('profile.nextLevel')}</span>
                                    <span>{(stats.daysStudied || 0) % 7} / 7</span>
                                </div>
                                <div className="level-progress-bar">
                                    <div
                                        ref={levelProgressRef}
                                        className="level-progress-fill"
                                    ></div>
                                </div>
                            </div>
                        </div>

                        <div className="stat-row">
                            <div className="stat-item">
                                <span className="stat-value">{stats.streak}</span>
                                <span className="stat-label">{t('profile.consecutiveDays')}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{stats.totalNotes}</span>
                                <span className="stat-label">{t('dashboard.totalNotes')}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{stats.daysStudied || 0}</span>
                                <span className="stat-label">{t('profile.daysStudied')}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>


            <div className="profile-section">
                <div className="habit-pace-header">
                    <UilCalendarAlt size="20" color="var(--pink)" />
                    <h2>{t('groupChat.habitPaceProfileTitle')}</h2>
                </div>
                <p className="section-desc-small">
                    {t('groupChat.habitPaceProfileDesc', { days: userData?.kickThreshold || DEFAULT_KICK_THRESHOLD })}
                </p>
                <div className="font-size-options habit-pace-grid">
                    {[3, 4, 5, 6, 7].map(days => (
                        <div
                            key={days}
                            className={`font-option habit-pace-option ${localKickThreshold === days ? 'active' : ''}`}
                            onClick={async () => {
                                if (localKickThreshold === days) return;
                                const prevThreshold = localKickThreshold;
                                // 楽観的UI：即座にハイライトを更新する
                                setLocalKickThreshold(days);
                                try {
                                    await apiClient.post('/api/groups/update-kick-threshold', { threshold: days });
                                    toast.success(t('groupChat.autoKickSuccess'));
                                } catch (err: unknown) {
                                    console.error("Error updating pace:", err);
                                    // 失敗時は元の値に戻す
                                    setLocalKickThreshold(prevThreshold);
                                    toast.error(t('profile.errorUpdate') || "Error updating pace");
                                }
                            }}
                        >
                            <span className="habit-pace-days">{days}</span>
                            <span className="habit-pace-label">{t('dashboard.days')}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="profile-section">
                <h2>{t('profile.fontSize.title')}</h2>
                <p className="section-desc-small">{t('profile.fontSize.description')}</p>
                <div className="font-size-options">
                    <div
                        className={`font-option ${fontSize === 'small' ? 'active' : ''}`}
                        onClick={() => setFontSize('small')}
                    >
                        <span className="font-option-A-sm">A</span>
                        <span>{t('profile.fontSize.small')}</span>
                    </div>
                    <div
                        className={`font-option ${fontSize === 'medium' ? 'active' : ''}`}
                        onClick={() => setFontSize('medium')}
                    >
                        <span className="font-option-A-md">A</span>
                        <span>{t('profile.fontSize.medium')}</span>
                    </div>
                    <div
                        className={`font-option ${fontSize === 'large' ? 'active' : ''}`}
                        onClick={() => setFontSize('large')}
                    >
                        <span className="font-option-A-lg">A</span>
                        <span>{t('profile.fontSize.large')}</span>
                    </div>
                    <div
                        className={`font-option ${fontSize === 'extraLarge' ? 'active' : ''}`}
                        onClick={() => setFontSize('extraLarge')}
                    >
                        <span className="font-option-A-xl">A</span>
                        <span>{t('profile.fontSize.extraLarge')}</span>
                    </div>
                </div>
            </div>

            <div className="profile-section">
                <div className="habit-pace-header">
                    <UilCompass size="20" color="var(--pink)" />
                    <h2>{t('tourGuide.replayButton')}</h2>
                </div>
                <p className="section-desc-small">
                    {language === 'ja'
                        ? 'ダッシュボードの各機能について説明するチュートリアルツアーをもう一度見ることができます。'
                        : 'Replay the interactive dashboard onboarding tour to learn about all the available features.'}
                </p>
                <Button
                    onClick={async () => {
                        try {
                            await apiClient.post('/api/auth/update-profile', { hasSeenTour: false });
                            toast.success(t('tourGuide.replayButton') || 'Replay Tour');
                            navigate(`/${language}/dashboard`);
                        } catch (err: unknown) {
                            console.error("Error updating tour seen status:", err);
                            toast.error(t('profile.errorUpdate') || "Error updating profile");
                        }
                    }}
                    className="save-btn replay-tour-btn"
                    data-testid="replay-tour-button"
                >
                    {t('tourGuide.replayButton')}
                </Button>
            </div>

            <div className="profile-section">
                <h2>{t('profile.language')}</h2>
                <div className="language-options">
                    <div
                        className={`language-option ${language === 'en' ? 'active' : ''}`}
                        onClick={() => setLanguage('en')}
                        data-testid="language-option-en"
                    >
                        <span className="lang-flag">🇺🇸</span>
                        <span className="lang-name">{t('languages.english')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'ja' ? 'active' : ''}`}
                        onClick={() => setLanguage('ja')}
                        data-testid="language-option-ja"
                    >
                        <span className="lang-flag">🇯🇵</span>
                        <span className="lang-name">{t('languages.japanese')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'pt' ? 'active' : ''}`}
                        onClick={() => setLanguage('pt')}
                        data-testid="language-option-pt"
                    >
                        <span className="lang-flag">🇧🇷</span>
                        <span className="lang-name">{t('languages.portuguese')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'zho' ? 'active' : ''}`}
                        onClick={() => setLanguage('zho')}
                        data-testid="language-option-zho"
                    >
                        <span className="lang-flag">🇹🇼</span>
                        <span className="lang-name">{t('languages.chinese')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'es' ? 'active' : ''}`}
                        onClick={() => setLanguage('es')}
                        data-testid="language-option-es"
                    >
                        <span className="lang-flag">🇪🇸</span>
                        <span className="lang-name">{t('languages.spanish')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'vi' ? 'active' : ''}`}
                        onClick={() => setLanguage('vi')}
                        data-testid="language-option-vi"
                    >
                        <span className="lang-flag">🇻🇳</span>
                        <span className="lang-name">{t('languages.vietnamese')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'th' ? 'active' : ''}`}
                        onClick={() => setLanguage('th')}
                        data-testid="language-option-th"
                    >
                        <span className="lang-flag">🇹🇭</span>
                        <span className="lang-name">{t('languages.thai')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'ko' ? 'active' : ''}`}
                        onClick={() => setLanguage('ko')}
                        data-testid="language-option-ko"
                    >
                        <span className="lang-flag">🇰🇷</span>
                        <span className="lang-name">{t('languages.korean')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'tl' ? 'active' : ''}`}
                        onClick={() => setLanguage('tl')}
                        data-testid="language-option-tl"
                    >
                        <span className="lang-flag">🇵🇭</span>
                        <span className="lang-name">{t('languages.tagalog')}</span>
                    </div>
                    <div
                        className={`language-option ${language === 'sw' ? 'active' : ''}`}
                        onClick={() => setLanguage('sw')}
                        data-testid="language-option-sw"
                    >
                        <span className="lang-flag">🇰🇪</span>
                        <span className="lang-name">{t('languages.swahili')}</span>
                    </div>
                </div>

            </div>

            <div className="profile-section sign-out-section" onClick={handleSignOut}>
                <div className="sign-out-btn-content">
                    <UilSignOutAlt />
                    <span className="sign-out-btn-text">{t('signOut.title')}</span>
                </div>
            </div>


            {/* Sign Out Confirmation Modal */}
            {showSignOutModal && (
                    <div className="group-modal-overlay" onClick={() => setShowSignOutModal(false)}>
                        <div className="group-modal-content modal-small" onClick={(e) => e.stopPropagation()}>
                            <h3>{t('signOut.title')}</h3>
                            <p>{t('signOut.message')}</p>
                            <div className="modal-footer">
                                <button
                                    className="close-modal-btn modal-btn-cancel"
                                    onClick={() => setShowSignOutModal(false)}
                                >
                                    {t('signOut.cancel')}
                                </button>
                                <button
                                    className="close-modal-btn modal-btn-confirm"
                                    onClick={confirmSignOut}
                                >
                                    {t('signOut.confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
            )}

            {/* Account Deletion Verification */}
            <div className="profile-section delete-account-section">
                <button
                    onClick={() => {
                        setConfirmNickname('');
                        setShowDeleteModal(true);
                    }}
                    className="delete-account-link"
                    data-testid="delete-account-button"
                >
                    {t('profile.deleteAccount')}
                </button>
            </div>

            {/* Delete Account Modal */}
            {showDeleteModal && (
                <div className="group-modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="group-modal-content modal-medium" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-danger-title">{t('profile.deleteAccount')}</h3>
                        <p className="modal-warning-text">{t('profile.deleteAccountWarning')}</p>

                        <div className="modal-confirm-wrapper">
                            <p className="modal-confirm-hint">
                                {t('profile.typeToConfirmNickname').replace('{nickname}', userData.nickname || '')}
                            </p>
                            <input
                                type="text"
                                value={confirmNickname}
                                onChange={(e) => setConfirmNickname(e.target.value)}
                                placeholder={userData.nickname}
                                className="modal-confirm-input"
                                data-testid="delete-confirm-nickname-input"
                            />
                        </div>

                        <div className="modal-footer-vertical">
                            <button
                                className={`close-modal-btn ${confirmNickname.trim() === (userData.nickname || '').trim() ? 'delete-btn-active' : 'delete-btn-disabled'}`}
                                onClick={handleDeleteAccount}
                                disabled={isDeleting || confirmNickname.trim() !== (userData.nickname || '').trim()}
                                data-testid="confirm-delete-account-button"
                            >
                                {isDeleting ? '...' : t('profile.confirmDeleteAccount')}
                            </button>
                            <button
                                className="close-modal-btn"
                                onClick={() => setShowDeleteModal(false)}
                            >
                                {t('profile.cancelDeleteAccount')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div >
    );
};

export default Profile;


