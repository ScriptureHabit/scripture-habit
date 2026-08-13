import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import apiClient from '../../../utils/api-client';
import WelcomeStoryModal from '../../welcomestorymodal/welcome-story-modal';
import NotificationPromptModal from '../notification-prompt-modal';
import { UserData } from '../../../types/user';
import { safeStorage } from '../../../utils/storage';
import '../../mascot/mascot.css';

interface DashboardModalsProps {
  t: (key: string, replacements?: Record<string, string | number>) => string;
  userData: UserData;
  
  // Welcome Story
  showWelcomeStory: boolean;
  onCloseWelcomeStory: () => void;
  
  // Notifications
  showNotifPrompt: boolean;
  handleEnableNotifications: () => void;
  handleCloseNotifPrompt: () => void;
  
  // Profile (Nickname)
  showEditProfileModal: boolean;
  setShowEditProfileModal: (show: boolean) => void;
  newNickname: string;
  setNewNickname: (name: string) => void;
  handleUpdateProfile: () => void;
  
  // Auto Kick
  showAutoKickModal: boolean;
  autoKickStep: number;
  setAutoKickStep: (step: number) => void;
  selectedKickDays: number;
  setSelectedKickDays: (days: number) => void;
  handleAutoKickSubmit: () => void;
  setShowAutoKickModal: (show: boolean) => void;
}

const DashboardModals = ({
  t,
  userData,
  showWelcomeStory,
  onCloseWelcomeStory,
  showNotifPrompt,
  handleEnableNotifications,
  handleCloseNotifPrompt,
  showEditProfileModal,
  setShowEditProfileModal,
  newNickname,
  setNewNickname,
  handleUpdateProfile,
  showAutoKickModal,
  autoKickStep,
  setAutoKickStep,
  selectedKickDays,
  setSelectedKickDays,
  handleAutoKickSubmit,
  setShowAutoKickModal
}: DashboardModalsProps) => {
  const navigate = useNavigate();
  const [creatingAiGroup, setCreatingAiGroup] = useState(false);

  const handleCreateAiGroup = async () => {
    setCreatingAiGroup(true);
    try {
      const res = await apiClient.post('/api/groups/create-ai-group', {});
      if (res.data && res.data.groupId) {
        setShowAutoKickModal(false);
        // Skip the tour so it doesn't interrupt the group chat
        if (userData?.uid) {
          sessionStorage.setItem(`tour_seen_${userData.uid}`, 'true');
          sessionStorage.setItem(`ai_group_tour_pending_${userData.uid}`, 'true');
        }
        sessionStorage.setItem('ai_group_tour_pending', 'true');
        navigate(`/${userData?.language || 'ja'}/dashboard?groupId=${res.data.groupId}&view=2`);
      }
    } catch (err) {
      console.error('Failed to create AI group:', err);
      toast.error(t('groupChat.reportError') || 'Failed to create AI Partner group');
    } finally {
      setCreatingAiGroup(false);
    }
  };

  return (
    <>
      <WelcomeStoryModal 
        isOpen={showWelcomeStory} 
        onClose={onCloseWelcomeStory} 
        userData={userData} 
      />
      
      <NotificationPromptModal 
        isOpen={showNotifPrompt} 
        onConfirm={handleEnableNotifications} 
        onClose={handleCloseNotifPrompt} 
        t={t} 
      />

      {showEditProfileModal && (
        <div className="leave-modal-overlay">
          <div className="leave-modal-content">
            <h3>{t('groupChat.changeNickname')}</h3>
            <input 
              type="text" 
              className="delete-confirmation-input" 
              value={newNickname} 
              onChange={(e) => setNewNickname(e.target.value)} 
              placeholder={t('groupChat.enterNewNickname')} 
              maxLength={30}
            />
            <div className="leave-modal-actions">
              <button className="modal-btn cancel" onClick={() => setShowEditProfileModal(false)}>
                {t('groupChat.cancel')}
              </button>
              <button 
                className="modal-btn primary" 
                onClick={handleUpdateProfile} 
                disabled={!newNickname.trim() || newNickname === userData.nickname}
              >
                {t('groupChat.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAutoKickModal && (
        <div className="leave-modal-overlay">
          <div className="leave-modal-content auto-kick-setup">
            {autoKickStep === 0 ? (
              <>
                <div className="mascot-container" style={{ margin: '0.75rem 0 0.25rem', cursor: 'default' }}>
                  <div className="mascot-image-wrapper">
                    <img
                      src="/images/mascot.png"
                      alt="Mascot"
                      className="mascot-image"
                    />
                  </div>
                  <div className="mascot-bubble">
                    <div className="mascot-bubble-tail" />
                    <p className="mascot-text">{t('groupChat.autoKickInitTitle')}</p>
                  </div>
                </div>
                <p className="auto-kick-init-desc-styled">{t('groupChat.autoKickInitDesc')}</p>
                <div className="auto-kick-grid-options-styled">
                  {[3, 4, 5, 6, 7].map(d => (
                    <button 
                      key={d} 
                      onClick={() => setSelectedKickDays(d)} 
                      className={`auto-kick-day-option-styled ${selectedKickDays === d ? 'selected' : 'unselected'}`}
                      data-testid={`habit-pace-option-${d}`}
                    >
                      {d} {t('dashboard.days')}
                    </button>
                  ))}
                </div>
                <p className="auto-kick-selected-subtext-styled" data-testid="habit-pace-selected-subtext">
                  {t('groupChat.autoKickSelectedSubtext', { days: selectedKickDays })}
                </p>
                <button className="modal-btn primary mt-2 w-100" onClick={() => setAutoKickStep(1)} data-testid="habit-pace-next-button">
                  {t('groupChat.next')}
                </button>
              </>
            ) : autoKickStep === 1 ? (
              <>
                <h2 className="auto-kick-init-title-styled" style={{ textAlign: 'center' }}>{t('groupChat.autoKickConfirmTitle')}</h2>
                
                <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                  <div className="mascot-container" style={{ margin: '0 0 0.75rem', cursor: 'default' }}>
                    <div className="mascot-image-wrapper">
                      <img
                        src="/images/mascot.png"
                        alt="Mascot"
                        className="mascot-image"
                      />
                    </div>
                    <div className="mascot-bubble">
                      <div className="mascot-bubble-tail" />
                      <p className="mascot-text">{t('groupChat.habitPaceLetsTryTogether')}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '1rem', color: '#64748b', marginBottom: '0.25rem' }}>{t('groupChat.habitPaceProfileTitle', { nickname: userData.nickname || '' })}</p>
                  <p style={{ fontSize: '1.3rem', color: '#c0436b', margin: '0.5rem 0 0' }} data-testid="habit-pace-confirm-subtext">
                    {t('groupChat.autoKickSelectedSubtext', { days: selectedKickDays })}
                  </p>
                </div>

                <div className="leave-modal-actions" style={{ display: 'flex', gap: '12px', marginTop: '1rem' }}>
                  <button 
                    className="modal-btn cancel" 
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '10px' }} 
                    onClick={() => setAutoKickStep(0)}
                  >
                    {t('groupChat.cancel') || 'Back'}
                  </button>
                  <button 
                    className="modal-btn primary" 
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '10px' }} 
                    onClick={handleAutoKickSubmit} 
                    data-testid="habit-pace-save-button"
                  >
                    {t('groupChat.save') || 'Confirm'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center p-1 auto-kick-success-onboarding">
                {(() => {
                  const joinedFromInvite = safeStorage.get('joinedFromInvite') === 'true';
                  const ownerName = safeStorage.get('joinedOwnerName') || 'Owner';

                  const handleOnboardingRedirect = () => {
                    setShowAutoKickModal(false);
                    if (joinedFromInvite) {
                      // Clean up storage so it won't trigger next time they change pace
                      safeStorage.remove('joinedFromInvite');
                      safeStorage.remove('joinedOwnerName');
                    } else {
                      // Self-registered user -> redirect to group-options
                      window.location.href = `/${userData.language || 'ja'}/group-options`;
                    }
                  };

                  return (
                    <div className="onboarding-guide-step-container" style={{ padding: '1rem 0' }}>
                      <div className="mascot-dialog-icon" style={{ marginBottom: '1rem' }}>
                        <img src="/images/mascot.png" alt="Mascot" className="mascot-image" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                      </div>
                      <p className="onboarding-guide-text font-bold-medium" style={{ fontSize: '1.05rem', lineHeight: '1.5', marginBottom: '1.5rem', color: '#1e293b' }}>
                        {joinedFromInvite 
                          ? t('onboardingGuide.paceSetSuccessInvite', { ownerName })
                          : t('onboardingGuide.paceSetSuccess')}
                      </p>
                      {joinedFromInvite ? (
                        <button 
                          className="modal-btn primary mt-1 onboarding-guide-btn" 
                          onClick={handleOnboardingRedirect}
                          data-testid="onboarding-guide-redirect-button"
                          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold' }}
                        >
                          {t('onboardingGuide.paceSetBtnLearn')}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>
                          <button
                            className="ai-mode-option-card"
                            onClick={handleCreateAiGroup}
                            disabled={creatingAiGroup}
                            data-testid="start-with-ai-button"
                            style={{
                              padding: '1rem',
                              borderRadius: '12px',
                              border: '2px solid #8b5cf6',
                              backgroundColor: '#f5f3ff',
                              textAlign: 'left',
                              cursor: creatingAiGroup ? 'wait' : 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 2px 8px rgba(139, 92, 246, 0.15)'
                            }}
                          >
                            <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#6d28d9', marginBottom: '0.25rem' }}>
                              {t('groupChat.aiGroupStartWithAiOption')}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#4c1d95', lineHeight: '1.4' }}>
                              {t('groupChat.aiGroupStartWithAiDesc')}
                            </div>
                          </button>

                          <button
                            className="friends-mode-option-card"
                            onClick={handleOnboardingRedirect}
                            data-testid="start-with-friends-button"
                            style={{
                              padding: '1rem',
                              borderRadius: '12px',
                              border: '2px solid var(--pink)',
                              backgroundColor: '#fff0f4',
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              boxShadow: '0 2px 8px rgba(255, 94, 126, 0.15)'
                            }}
                          >
                            <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#c0436b', marginBottom: '0.25rem' }}>
                              {t('groupChat.aiGroupStartWithFriendsOption')}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#c0436b', lineHeight: '1.4' }}>
                              {t('groupChat.aiGroupStartWithFriendsDesc')}
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardModals;
