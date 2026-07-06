
import { useEffect, useState, FC } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { safeStorage } from '../../utils/storage';
import { auth } from '../../firebase';
import apiClient from '../../utils/api-client';
import { useLanguage } from '../../hooks/use-language';
import Button from '../button/button';
import './invite-redirect.css';

interface InviteGroupInfo {
    name: string;
    description?: string;
}

const InviteRedirect: FC = () => {
    const { inviteCode } = useParams<{ inviteCode: string }>();
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const [groupInfo, setGroupInfo] = useState<InviteGroupInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (inviteCode) {
            safeStorage.set('pendingInviteCode', inviteCode.trim().toUpperCase());

            // Fetch group info to show the user where they are going
            const fetchGroupInfo = async () => {
                try {
                    const res = await apiClient.get(`/api/groups/group-preview/${encodeURIComponent(inviteCode.trim().toUpperCase())}`);
                    setGroupInfo(res.data);
                } catch (error) {
                    console.error("Error fetching group info:", error);
                    console.warn("Invite code invalid or group not found");
                } finally {
                    setLoading(false);
                }
            };
            fetchGroupInfo();
        } else {
            setLoading(false);
        }

        const unsubscribe = auth!.onAuthStateChanged((user) => {
            if (user && !loading) {
                // If logged in, go to dashboard where the join logic will trigger
                navigate(`/${language}/dashboard`, { replace: true });
            }
        });

        return () => unsubscribe();
    }, [inviteCode, navigate, loading, language]);

    const handleJoin = () => {
        if (auth!.currentUser) {
            navigate(`/${language}/dashboard`, { replace: true });
        } else {
            navigate(`/${language}/welcome`, { replace: true });
        }
    };

    if (loading) {
        return (
            <div className="invite-redirect-container">
                <div className="invite-card loading">
                    <div className="loading-spinner"></div>
                    <p>{t('joinGroup.fetchingInvite')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="invite-redirect-container">
            <div className="invite-card" data-testid="invite-card">
                <div className="invite-icon">🤝</div>
                <h1>{t('joinGroup.joinConfirmTitle')}</h1>
                {groupInfo ? (
                    <>
                        <p className="invite-text">
                            {t('joinGroup.invitedToJoin')}
                        </p>
                        <div className="group-preview">
                            <h2 className="group-name" data-testid="invite-group-name">{groupInfo.name}</h2>
                            {groupInfo.description && (
                                <p className="group-desc">{groupInfo.description}</p>
                            )}
                        </div>
                        <Button className="join-btn" data-testid="invite-join-btn" onClick={handleJoin}>
                            {auth!.currentUser ? t('joinGroup.confirmJoin') : `${t('welcome.login')} / ${t('welcome.signup')}`}
                        </Button>
                        {!isStandalone() && /iPhone|iPad|iPod/.test(navigator.userAgent) && (
                            <p className="pwa-hint">
                                {t('joinGroup.pwaInviteHint')}
                            </p>
                        )}
                    </>
                ) : (
                    <div className="error-state">
                        <p>{t('joinGroup.invalidInvite')}</p>
                        <Button onClick={() => navigate(`/${language}/`)}>{t('joinGroup.goBackHome')}</Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InviteRedirect;


function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
}



