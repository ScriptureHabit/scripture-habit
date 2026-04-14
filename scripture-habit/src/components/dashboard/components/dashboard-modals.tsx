import { FC } from 'react';
import WelcomeStoryModal from '../../welcomestorymodal/welcome-story-modal';
import NotificationPromptModal from '../notification-prompt-modal';
import { UserData } from '../../../types/user';

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
  kickConfirmInput: string;
  setKickConfirmInput: (val: string) => void;
  autoKickError: string | null;
  handleAutoKickSubmit: () => void;
  setShowAutoKickModal: (show: boolean) => void;
}

const DashboardModals: FC<DashboardModalsProps> = ({
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
  kickConfirmInput,
  setKickConfirmInput,
  autoKickError,
  handleAutoKickSubmit,
  setShowAutoKickModal
}) => {
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
                <h2 className="auto-kick-init-title-styled">{t('groupChat.autoKickInitTitle')}</h2>
                <p className="auto-kick-init-desc-styled">{t('groupChat.autoKickInitDesc')}</p>
                <div className="auto-kick-grid-options-styled">
                  {[3, 5, 7].map(d => (
                    <button 
                      key={d} 
                      onClick={() => setSelectedKickDays(d)} 
                      className={`auto-kick-day-option-styled ${selectedKickDays === d ? 'selected' : 'unselected'}`}
                    >
                      {d} {t('dashboard.days')}
                    </button>
                  ))}
                </div>
                <button className="modal-btn primary mt-2 w-100" onClick={() => setAutoKickStep(1)}>
                  {t('groupChat.next')}
                </button>
              </>
            ) : autoKickStep === 1 ? (
              <>
                <h2 className="auto-kick-init-title-styled">{t('groupChat.autoKickConfirmTitle')}</h2>
                <p className="auto-kick-confirm-warning-styled">{t('groupChat.autoKickWarning')}</p>
                <p className="mt-1">{t('groupChat.autoKickConfirmText').replace('{days}', selectedKickDays.toString())}</p>
                <input 
                  type="number" 
                  title="Days Threshold" 
                  placeholder="7" 
                  className="delete-confirmation-input auto-kick-confirm-input-styled" 
                  value={kickConfirmInput} 
                  onChange={(e) => setKickConfirmInput(e.target.value)} 
                />
                {autoKickError && <p className="auto-kick-error-text-styled">{autoKickError}</p>}
                <button className="modal-btn primary mt-1 w-100" onClick={handleAutoKickSubmit}>
                  {t('groupChat.save')}
                </button>
              </>
            ) : (
              <div className="text-center p-1">
                <p className="font-bold-large">{t('groupChat.autoKickSuccess')}</p>
                <button className="modal-btn primary mt-1" onClick={() => setShowAutoKickModal(false)}>
                  OK
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardModals;
