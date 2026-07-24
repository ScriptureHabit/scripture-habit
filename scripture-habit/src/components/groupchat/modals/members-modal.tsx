import { FC, useState, useEffect } from 'react';
import { UilTimes } from '@iconscout/react-unicons';
import { Group, UserProfileBrief } from '../../../types/chat';
import { UserData } from '../../../types/user';
import { parseTimestampToDate } from '../../../utils/time-utils';
import apiClient from '../../../utils/api-client';
import { isLikelyAlreadyInLanguage, getCachedUserNickname, setCachedUserNickname } from '../../../utils/language-utils';

interface MembersModalProps {
    t: (key: string) => string;
    userData: UserData | null;
    groupData: Group | null;
    language?: string;
    showMembersModal: boolean;
    setShowMembersModal: (show: boolean) => void;
    membersList: UserProfileBrief[];
    membersMap?: Record<string, UserProfileBrief>;
    membersLoading: boolean;
    setSelectedMember: (member: UserProfileBrief | null) => void;
}

interface MemberListItemProps {
    member: UserProfileBrief;
    groupData: Group | null;
    userData: UserData | null;
    membersMap?: Record<string, UserProfileBrief>;
    language: string;
    setSelectedMember: (member: UserProfileBrief | null) => void;
    t: (key: string) => string;
}

const MemberListItem: FC<MemberListItemProps> = ({
    member,
    groupData,
    userData,
    membersMap,
    language,
    setSelectedMember,
    t
}) => {
    const originalNickname = member.nickname || 'Unknown User';
    const memberStatus = membersMap?.[member.id] || member;

    const shouldTranslateNick = originalNickname !== 'Unknown User' && !isLikelyAlreadyInLanguage(originalNickname, language);

    const [displayNickname, setDisplayNickname] = useState(originalNickname);

    useEffect(() => {
        if (!shouldTranslateNick) {
            setDisplayNickname(originalNickname);
            return;
        }

        const cached = getCachedUserNickname(member.id, language, originalNickname);
        if (cached) {
            setDisplayNickname(cached);
        } else {
            let active = true;
            apiClient.post('/api/ai/translate', {
                text: originalNickname,
                targetLanguage: language,
                updateType: 'user_nickname'
            }).then(res => {
                if (active && res.data?.translatedText) {
                    const result = res.data.translatedText;
                    setDisplayNickname(result);
                    setCachedUserNickname(member.id, language, originalNickname, result);
                }
            }).catch(e => console.error('Failed to translate member nickname:', e));

            return () => {
                active = false;
            };
        }
    }, [member.id, originalNickname, shouldTranslateNick, language]);

    return (
        <div
            className="member-item"
            onClick={() => setSelectedMember(member)}
            style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem', borderRadius: '8px', background: 'var(--glass)', cursor: 'pointer' }}
        >
            <div className="member-avatar" style={{
                width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #FF919D 0%, #fc6777 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem',
                overflow: 'hidden'
            }}>
                {member.photoURL ? (
                    <img src={member.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    displayNickname ? displayNickname.substring(0, 1).toUpperCase() : '?'
                )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '500', color: 'var(--black)' }} data-testid="member-nickname" data-member-id={member.id}>
                    {displayNickname}
                    {member.id === groupData?.ownerUserId && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#ffe0e3', color: 'var(--pink)', padding: '2px 6px', borderRadius: '4px' }}>Owner</span>}
                    {member.id === userData?.uid && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', background: '#e0e0e0', color: 'var(--gray)', padding: '2px 6px', borderRadius: '4px' }}>You</span>}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--gray)' }}>
                    {(() => {
                        const lastActive = memberStatus.lastActiveAt || (groupData?.memberLastActive && member.id && groupData.memberLastActive[member.id]) || member.lastPostDate;
                        if (!lastActive) return t('groupChat.noActivity') || "No recent activity";

                        const dateObj = parseTimestampToDate(lastActive);
                        const now = new Date();
                        const diffDays = Math.floor((now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));

                        if (diffDays <= 0) return t('groupChat.activeToday') || "Active today";
                        if (diffDays === 1) return t('groupChat.activeYesterday') || "Active yesterday";
                        if (diffDays < 30) return (t('groupChat.activeDaysAgo') || "Active {days} days ago").replace('{days}', String(diffDays));
                        const diffMonths = Math.floor(diffDays / 30);
                        return (t('groupChat.activeMonthsAgo') || "Active > {months} months ago").replace('{months}', String(diffMonths));
                    })()}
                </span>
            </div>
        </div>
    );
};

const MembersModal: FC<MembersModalProps> = ({
    t,
    userData,
    groupData,
    language = 'en',
    showMembersModal,
    setShowMembersModal,
    membersList,
    membersMap,
    membersLoading,
    setSelectedMember,
}) => {
    if (!showMembersModal) return null;

    return (
        <div className="leave-modal-overlay" onClick={() => setShowMembersModal(false)}>
            <div className="leave-modal-content members-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3>{t('groupChat.groupMembers')} ({membersList.length})</h3>
                    <button 
                        className="close-menu-btn" 
                        onClick={() => setShowMembersModal(false)} 
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                        aria-label={t('sidebar.close')}
                        title={t('sidebar.close')}
                    >
                        <UilTimes size="24" />
                    </button>
                </div>

                <div className="members-list-container" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {membersLoading ? (
                        <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--gray)' }}>Loading members...</p>
                    ) : (
                        membersList.map((member) => (
                            <MemberListItem
                                key={member.id}
                                member={member}
                                groupData={groupData}
                                userData={userData}
                                membersMap={membersMap}
                                language={language}
                                setSelectedMember={setSelectedMember}
                                t={t}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default MembersModal;
