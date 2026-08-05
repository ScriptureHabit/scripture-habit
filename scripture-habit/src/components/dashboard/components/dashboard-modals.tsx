import WelcomeStoryModal from '../../welcomestorymodal/welcome-story-modal';
import NotificationPromptModal from '../notification-prompt-modal';
import { UserData } from '../../../types/user';
import { safeStorage } from '../../../utils/storage';

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
                <h2 className="auto-kick-init-title-styled" data-testid="habit-pace-modal-title">{t('groupChat.autoKickInitTitle')}</h2>
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
                <button className="modal-btn primary mt-2 w-100" onClick={() => setAutoKickStep(1)} data-testid="habit-pace-next-button">
                  {t('groupChat.next')}
                </button>
              </>
            ) : autoKickStep === 1 ? (
              <>
                <h2 className="auto-kick-init-title-styled" style={{ textAlign: 'center' }}>{t('groupChat.autoKickConfirmTitle')}</h2>
                
                <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                  <p style={{ fontSize: '1rem', color: '#64748b', marginBottom: '0.25rem' }}>{t('groupChat.habitPaceProfileTitle') || 'Selected Pace'}</p>
                  <p style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--pink)', margin: '0' }}>
                    {selectedKickDays} {t('dashboard.days')}
                  </p>
                </div>

                <p className="auto-kick-confirm-warning-styled" style={{ textAlign: 'center', fontSize: '0.9rem', color: '#ef4444', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                  {t('groupChat.autoKickWarning')}
                </p>

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
                        <img src="/images/mascot.png" alt="Mascot" style={{ width: '80px', height: '80px', objectFit: 'contain' }} />
                      </div>
                      <p className="onboarding-guide-text font-bold-medium" style={{ fontSize: '1.05rem', lineHeight: '1.5', marginBottom: '1.5rem', color: '#1e293b' }}>
                        {joinedFromInvite 
                          ? t('onboardingGuide.paceSetSuccessInvite', { ownerName })
                          : t('onboardingGuide.paceSetSuccess')}
                      </p>
                      <button 
                        className="modal-btn primary mt-1 onboarding-guide-btn" 
                        onClick={handleOnboardingRedirect}
                        data-testid="onboarding-guide-redirect-button"
                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        {joinedFromInvite 
                          ? t('onboardingGuide.paceSetBtnLearn')
                          : t('onboardingGuide.paceSetBtnSearch')}
                      </button>
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
