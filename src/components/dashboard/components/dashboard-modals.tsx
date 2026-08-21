import WelcomeStoryModal from '../../welcomestorymodal/welcome-story-modal';
import NotificationPromptModal from '../notification-prompt-modal';
import { UserData } from '../../../types/user';
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
  handleAutoKickSubmit
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
              id="dashboard-edit-nickname"
              name="nickname"
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
                      src="/images/mascot.webp"
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
            ) : (
              <>
                <h2 className="auto-kick-init-title-styled" style={{ textAlign: 'center' }}>{t('groupChat.autoKickConfirmTitle')}</h2>
                
                <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
                  <div className="mascot-container" style={{ margin: '0 0 0.75rem', cursor: 'default' }}>
                    <div className="mascot-image-wrapper">
                      <img
                        src="/images/mascot.webp"
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
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardModals;
