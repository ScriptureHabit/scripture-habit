
import './join-group.css';
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../groupform/group-form.css';
import GroupCard from '../../groups/group-card';
import { useLanguage } from '../../hooks/use-language';
import Mascot from '../mascot/mascot';
import { PublicGroupsSkeleton } from '../skeleton/skeleton';
import { Group } from '../../types/chat';
import { useJoinGroup } from './hooks/use-join-group';
import { parseTimestampToDate } from '../../utils/time-utils';

export default function JoinGroup() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  const {
    user,
    userData,
    currentGroups,
    loadingGroups,
    filteredGroups,
    error,
    currentPage,
    totalPages,
    handlePageChange,
    joinGroup,
    translatedNames,
    translatedDescs,
    translatingIds,
    handleTranslateGroup
  } = useJoinGroup();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const [memberNames, setMemberNames] = useState<{uid: string, nickname: string}[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const handleJoinClick = async (groupId: string, groupData: Group) => {
    setSelectedGroup({ ...groupData, id: groupId });
    setShowConfirmModal(true);

    // Use memberPreviews already in the group data to avoid security-blocked user fetches
    if (groupData.memberPreviews && groupData.memberPreviews.length > 0) {
      setMemberNames(groupData.memberPreviews.map(m => ({
        uid: m.uid,
        nickname: m.nickname || 'Member'
      })));
    } else {
      setMemberNames([]);
    }
    setLoadingMembers(false);
  };

  useEffect(() => {
    if (selectedGroup && !translatedNames[selectedGroup.id] && !translatingIds.has(selectedGroup.id)) {
      handleTranslateGroup(selectedGroup.id, selectedGroup.name || "", selectedGroup.description, selectedGroup.translations);
    }
  }, [selectedGroup, handleTranslateGroup, translatedNames, translatingIds]);

  if (!t) return null; // Wait for translations

  const confirmJoin = async () => {
    if (selectedGroup) {
      await joinGroup(selectedGroup.id, selectedGroup);
      setShowConfirmModal(false);
      setSelectedGroup(null);
      setMemberNames([]);
    }
  };

  const handleOpenGroup = (groupId: string) => {
    navigate(`/${language}/dashboard`, { state: { initialGroupId: groupId, initialView: 2 } });
  };

  return (
    <div className="App">
      <div className="AppGlass join-group-container">
        {error && <p className="error-banner">{error}</p>}

        <Mascot
          userData={userData}
          customMessage={t('mascot.groupOptionsPrompt')}
          reversed={true}
        />

        <div className="public-groups-section">
          <div className="section-header">
            <h2>{t('joinGroup.publicGroupsTitle')}</h2>
            <p>{t('joinGroup.publicGroupsDesc')}</p>
          </div>

          {loadingGroups ? (
            <div className="loading-state-container" data-testid="skeleton-loader">
              <PublicGroupsSkeleton />
              <p className="loading-text" style={{ textAlign: 'center', marginTop: '1rem', color: 'rgba(255,255,255,0.7)' }}>
                {t('joinGroup.fetchingGroups')}
              </p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <p className="no-groups-message">{t('joinGroup.noPublicGroups')}</p>
          ) : (
            <>
              <div className="groups-grid">
                {currentGroups.map((group: Group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    currentUser={user}
                    onJoin={() => handleJoinClick(group.id, group)}
                    onOpen={() => handleJoinClick(group.id, group)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pagination-container">
                  <button 
                    className="pagination-btn" 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ←
                  </button>
                  <span className="page-indicator">
                    {currentPage} / {totalPages}
                  </span>
                  <button 
                    className="pagination-btn" 
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="create-group-cta">
          <p>{t('joinGroup.createGroupCta')}</p>
          <Link to="/group-form" className="create-group-link">{t('joinGroup.createGroupLink')}</Link>
        </div>

        <div className="back-to-dashboard-container">
          <Link to="/dashboard" className="back-link">
            {t('groupOptions.backToDashboard')}
          </Link>
        </div>

      </div>

      {/* Join Confirmation Modal */}
      {showConfirmModal && selectedGroup && (
        <div className="group-modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="group-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-section">
              <div className="modal-group-title-container">
                <h3 className="modal-group-title">
                  {translatingIds.has(selectedGroup.id) ? '...' : (translatedNames[selectedGroup.id] || selectedGroup.name)}
                </h3>
              </div>
              {translatedNames[selectedGroup.id] && translatedNames[selectedGroup.id] !== selectedGroup.name && (
                <p className="original-text-hint">
                  {t('groupChat.original')}: {selectedGroup.name}
                </p>
              )}
            </div>

            {selectedGroup.description && (
              <div className="modal-description-section">
                <p className="modal-description-text">
                  {translatingIds.has(selectedGroup.id) ? '...' : (translatedDescs[selectedGroup.id] || selectedGroup.description)}
                </p>
                {translatedDescs[selectedGroup.id] && translatedDescs[selectedGroup.id] !== selectedGroup.description && (
                  <p className="original-text-hint">
                    {t('groupChat.original')}: {selectedGroup.description}
                  </p>
                )}
              </div>
            )}

            {selectedGroup.createdAt && (
              <p className="modal-created-at">
                {t('joinGroup.createdAt')}: {(() => {
                  const date = parseTimestampToDate(selectedGroup.createdAt);
                  if (isNaN(date.getTime())) return '';
                  return date.toLocaleDateString(language === 'ja' ? 'ja-JP' : undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  });
                })()}
              </p>
            )}

            <div className="modal-members-section">
              <div className="modal-members-header">
                <h4>
                  {t('groupChat.members')} ({selectedGroup.membersCount || 0})
                </h4>
              </div>
              {loadingMembers ? (
                <p className="modal-loading-text">{t('letterBox.loading') || 'Loading members...'}</p>
              ) : (
                <div className="modal-members-list">
                  {memberNames.length > 0 ? (
                    memberNames.map((userObj, idx) => (
                      <span
                        key={idx}
                        className="modal-member-badge"
                      >
                        {userObj.nickname || 'Unknown'}
                      </span>
                    ))
                  ) : (
                    <p className="modal-none-text">{t('groupCard.noDescription') || 'None'}</p>
                  )}
                </div>
              )}
            </div>

            <p className="modal-confirm-message">
              {userData?.groupIds?.includes(selectedGroup.id)
                ? t('joinGroup.errorAlreadyMember')
                : t('joinGroup.joinConfirmMessage')}
            </p>

            <div className="modal-actions-container">
              <button
                className="close-modal-btn"
                onClick={() => setShowConfirmModal(false)}
              >
                {t('joinGroup.cancelJoin')}
              </button>
              {userData?.groupIds?.includes(selectedGroup.id) ? (
                <button
                  className="close-modal-btn confirm-join-btn open-group-btn"
                  onClick={() => handleOpenGroup(selectedGroup.id)}
                >
                  {t('groupCard.open')}
                </button>
              ) : (
                <button
                  className="close-modal-btn confirm-join-btn"
                  onClick={confirmJoin}
                >
                  {t('joinGroup.confirmJoin')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


