import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UilPlus } from '@iconscout/react-unicons';
import { toast } from 'react-toastify';
import axios from 'axios';
import apiClient from '../../../utils/api-client';
import Mascot from '../../mascot/mascot';
import { UserData, RecentGroupInfo } from '../../../types/user';
import { Group } from '../../../types/chat';
import StreakCalendar from './streak-calendar';
import { QuestCard } from './quest-card';
import { TimeCapsuleCard } from './time-capsule-card';
import { triggerConfetti } from '../../../utils/confetti-utils';
import { playNoteSubmitSound } from '../../../utils/audio-feedback';
import { useModalStore } from '../../../store/use-modal-store';
import { useLevelUpStore } from '../../../store/use-level-up-store';
import { useLanguage } from '../../../hooks/use-language';
import { calculateLevel } from '../../../utils/level-utils';
import { formatDateInTimeZone } from '../../../utils/time-utils';
import './quest-card.css';

interface DashboardOverviewProps {
  t: (key: string, replacements?: Record<string, string | number>) => string;
  userData: UserData;
  warnings: Array<{ name: string; hoursRemaining: number }>;
  todayPlan: { date: string; scripts: string[] } | null;
  getReadingPlanUrl: (script: string) => string | null;
  translateChapterField: (field: string) => string;
  isJoiningInvite: boolean;
  hasGroups: boolean;
  userGroups?: Group[];
  setIsModalOpen: (open: boolean) => void;
  setShowWelcomeStory: (show: boolean) => void;
  setShowEditProfileModal?: (show: boolean) => void;
  setNewNickname?: (name: string) => void;
  kickDate?: string | null;
  hasActiveModal?: boolean;
  onGoToGroupChat?: () => void;
  onRejoinSuccess?: (groupId: string) => void;
  onClearRecentGroup?: () => Promise<boolean> | void;
}

const STUDY_THEMES = [
  { id: 'faith', icon: '🌱', defaultLabel: '信仰' },
  { id: 'hope', icon: '⚓', defaultLabel: '希望' },
  { id: 'charity', icon: '❤️', defaultLabel: '慈愛' },
  { id: 'gratitude', icon: '🙏', defaultLabel: '感謝' },
  { id: 'prayer', icon: '✨', defaultLabel: '祈り' },
  { id: 'patience', icon: '⏳', defaultLabel: '忍耐' },
  { id: 'repentance', icon: '🕊️', defaultLabel: '悔い改め' },
  { id: 'guidance', icon: '🧭', defaultLabel: '御霊の導き' }
];

const DashboardOverview = ({
  t,
  userData,
  warnings,
  todayPlan,
  getReadingPlanUrl,
  translateChapterField,
  isJoiningInvite,
  hasGroups,
  setIsModalOpen,
  setShowWelcomeStory,
  kickDate,
  hasActiveModal = false,
  onGoToGroupChat,
  onRejoinSuccess,
  onClearRecentGroup
}: DashboardOverviewProps) => {
  const { activeModal } = useModalStore();
  const { language } = useLanguage();
  const isAnyModalOpen = hasActiveModal || !!activeModal;
  const [isRejoining, setIsRejoining] = useState(false);
  const [studyMode, setStudyMode] = useState<'note' | 'onetap'>('note');
  const [submittingTheme, setSubmittingTheme] = useState<string | null>(null);
  const [submittedTheme, setSubmittedTheme] = useState<string | null>(null);
  const [submittedDate, setSubmittedDate] = useState<string | null>(null);

  const userTz = userData?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
  const todayStr = formatDateInTimeZone(new Date(), userTz);

  const currentThemeDate = submittedDate || userData?.todayThemeDate || null;
  const currentTheme = submittedTheme || userData?.todayTheme || null;

  const isCompletedToday = Boolean(currentThemeDate && currentThemeDate === todayStr);
  const effectiveTodayTheme = isCompletedToday ? currentTheme : null;

  const getSafeTranslation = (key: string, fallback: string, replacements?: Record<string, string | number>): string => {
    const val = t(key, replacements);
    if (!val || val === key || val.startsWith(key) || (val.includes('.') && !val.includes(' '))) {
      return fallback;
    }
    return val;
  };

  const handleSelectTheme = async (themeId: string) => {
    if (submittingTheme || isCompletedToday) return;
    setSubmittingTheme(themeId);
    try {
      const res = await apiClient.post('/api/study/one-tap', { themeId });
      if (res.data?.success) {
        setSubmittedTheme(themeId);
        setSubmittedDate(todayStr);
        triggerConfetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
        playNoteSubmitSound();
        const fallbackTheme = STUDY_THEMES.find(th => th.id === themeId)?.defaultLabel || themeId;
        const themeName = getSafeTranslation(`oneTapStudy.themes.${themeId}`, fallbackTheme);
        const successMsg = getSafeTranslation('oneTapStudy.successMessage', `本日の学習を完了しました！【${themeName}】`, { theme: themeName });
        toast.success(successMsg);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && (err.response?.data?.code === 'CONFLICT' || err.response?.data?.error?.includes('already completed'))) {
        setSubmittedDate(todayStr);
        const alreadyDoneMsg = getSafeTranslation('oneTapStudy.alreadyCompleted', '本日のワンタップ学習は完了しています。また明日記録しましょう！');
        toast.info(alreadyDoneMsg);
        return;
      }
      console.error('Failed to submit one-tap study:', err);
      const errorMsg = getSafeTranslation('oneTapStudy.errorMessage', '学習の記録に失敗しました。もう一度お試しください。');
      toast.error(errorMsg);
    } finally {
      setSubmittingTheme(null);
    }
  };

  const handleRejoin = async (recentGroup: RecentGroupInfo) => {
    if (isRejoining) return;
    setIsRejoining(true);
    try {
      if (recentGroup.isAiGroup) {
        // AI groups: create new AI group
        const res = await apiClient.post('/api/groups/create-ai-group', {});
        if (res.data?.groupId) {
          toast.success(t('dashboard.rejoinSuccess'));
          onRejoinSuccess?.(res.data.groupId);
        }
      } else {
        // Regular group: one-tap rejoin
        const res = await apiClient.post('/api/groups/rejoin-group', { groupId: recentGroup.id });
        if (res.data?.gid) {
          toast.success(t('dashboard.rejoinSuccess'));
          onRejoinSuccess?.(res.data.gid);
        }
      }
    } catch (err: unknown) {
      console.error('Error rejoining group:', err);
      let errorCode = '';
      if (axios.isAxiosError(err)) {
        errorCode = err.response?.data?.code || '';
      }

      if (errorCode === 'GROUP_FULL') {
        toast.error(t('dashboard.groupFullRejoin'));
      } else if (errorCode === 'GROUP_NOT_FOUND' || errorCode === 'GROUP_DELETED') {
        toast.error(t('dashboard.groupDeletedRejoin'));
        // Clear deleted group from user doc via action hook
        await onClearRecentGroup?.();
      } else {
        const fallbackMsg = axios.isAxiosError(err) ? err.response?.data?.error : null;
        toast.error(fallbackMsg || t('groupChat.reportError'));
      }
    } finally {
      setIsRejoining(false);
    }
  };

  return (
    <div className="dashboard-inner-wrapper">
      {isJoiningInvite && (
        <div className="joining-overlay">
          <div className="loading-spinner"></div>
          <h3 title="Joining group...">{t('joinGroup.joiningFromInvite')}</h3>
        </div>
      )}
      
      <div className="dashboard-header dashboard-header-main">
        <div>
          <h2 className="dashboard-title-text">Scripture Habit</h2>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="warning-banner">
          {warnings.map((warn, i) => (
            <div key={i}>
              {t('dashboard.inactivityWarning', { name: warn.name, hours: warn.hoursRemaining })}
            </div>
          ))}
        </div>
      )}

      <QuestCard 
        userData={userData} 
        t={t} 
        setIsModalOpen={setIsModalOpen} 
        hasActiveModal={isAnyModalOpen} 
        onGoToGroupChat={onGoToGroupChat}
      />

      <TimeCapsuleCard
        userData={userData}
        warnings={warnings}
        setIsModalOpen={setIsModalOpen}
      />

      {/* Compute active onboarding state */}
      {(() => {
        const step1Done = !!userData?.questCreatedGroup || (userData?.groupIds && userData?.groupIds.length > 0) || !!userData?.groupId;
        const step2Done = !!userData?.questPostedNote;
        const isLegacyCompleted = !userData?.isAnonymousDemo && !userData?.questCreatedGroup && !userData?.questPostedNote &&
          (userData?.totalNotes && userData?.totalNotes > 0) &&
          ((userData?.groupIds && userData?.groupIds.length > 0) || !!userData?.groupId);
        const isStep2Active = !userData?.hasCompletedOnboarding && !isLegacyCompleted && step1Done && !step2Done && !isAnyModalOpen;

        return (
          <>
            <div className="dashboard-split-row">
              <div className="reading-plan-section">
                <div className="reading-plan-card reading-plan-card-inner-box">
                  <h3 className="reading-plan-title-styled">{t('dashboard.todaysComeFollowMe')}</h3>
                  {todayPlan ? (
                    <div>
                      <p className="reading-plan-date-detail">{todayPlan.date}</p>
                      <div className="reading-plan-links-container">
                        {todayPlan.scripts.map((script, idx) => {
                          const url = getReadingPlanUrl(script);
                          const displayScript = translateChapterField(script);

                          return (
                            <a
                              key={idx}
                              href={url || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="reading-plan-link-item"
                            >
                              {displayScript}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p>{t('dashboard.noReadingPlan')}</p>
                  )}
                </div>
              </div>

              <div className={`share-learning-cta ${isStep2Active ? 'spotlight-elevated' : ''}`}>
                <div className="study-mode-toggle-wrapper">
                  <button
                    type="button"
                    className={`study-mode-toggle-btn ${studyMode === 'note' ? 'active' : ''}`}
                    onClick={() => setStudyMode('note')}
                    data-testid="mode-toggle-note"
                  >
                    {getSafeTranslation('oneTapStudy.modeNote', getSafeTranslation('dashboard.modeNote', 'ノート作成'))}
                  </button>
                  <button
                    type="button"
                    className={`study-mode-toggle-btn ${studyMode === 'onetap' ? 'active' : ''}`}
                    onClick={() => setStudyMode('onetap')}
                    data-testid="mode-toggle-onetap"
                  >
                    {getSafeTranslation('oneTapStudy.modeOneTap', getSafeTranslation('dashboard.modeOneTap', 'ワンタップ'))}
                  </button>
                </div>

                {studyMode === 'note' ? (
                  <>
                    <p>{t('dashboard.shareLearningCall')}</p>
                    <div className="new-note-btn-wrapper">
                      <button 
                        className={`new-note-btn cta-btn ${isStep2Active ? 'glow-active' : ''}`} 
                        onClick={() => setIsModalOpen(true)} 
                        data-testid="new-note-button"
                      >
                        <UilPlus /> {t('dashboard.newNote')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="onetap-theme-section">
                    <p className={`onetap-theme-prompt ${isCompletedToday ? 'completed' : ''}`}>
                      {isCompletedToday
                        ? (() => {
                            const fallbackLabel = STUDY_THEMES.find(th => th.id === effectiveTodayTheme)?.defaultLabel || effectiveTodayTheme || '';
                            const translatedTheme = effectiveTodayTheme
                              ? getSafeTranslation(`oneTapStudy.themes.${effectiveTodayTheme}`, fallbackLabel)
                              : '';
                            return translatedTheme
                              ? getSafeTranslation('oneTapStudy.completedToday', `本日の学習テーマ：【${translatedTheme}】`, { theme: translatedTheme })
                              : getSafeTranslation('oneTapStudy.alreadyCompleted', '本日のワンタップ学習は完了しています。また明日記録しましょう！');
                          })()
                        : getSafeTranslation('oneTapStudy.selectThemePrompt', '今日のテーマを1つ選んで学習を記録しよう')}
                    </p>
                    <div className={`onetap-theme-grid ${isCompletedToday ? 'disabled' : ''}`}>
                      {STUDY_THEMES.map((th) => {
                        const isSelected = effectiveTodayTheme === th.id;
                        const isSubmitting = submittingTheme === th.id;
                        const themeName = getSafeTranslation(
                          `oneTapStudy.themes.${th.id}`,
                          th.defaultLabel
                        );
                        return (
                          <button
                            key={th.id}
                            type="button"
                            className={`onetap-theme-btn ${isSelected ? 'selected' : ''} ${isSubmitting ? 'submitting' : ''} ${isCompletedToday ? 'completed' : ''}`}
                            onClick={() => handleSelectTheme(th.id)}
                            disabled={isCompletedToday || !!submittingTheme}
                            aria-disabled={isCompletedToday || !!submittingTheme}
                            data-testid={`onetap-theme-${th.id}`}
                          >
                            <span className="onetap-theme-icon">{th.icon}</span>
                            <span className="onetap-theme-name">{themeName}</span>
                            {isSelected && <span className="onetap-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    {isCompletedToday && (
                      <p className="onetap-next-day-notice">
                        {getSafeTranslation('oneTapStudy.nextDayNotice', '※ 次の日の学習記録は明日また利用可能になります')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="inspiration-section">
              <Mascot
                userData={userData}
                onClick={() => setShowWelcomeStory(true)}
              />

              {!hasGroups && (
                <div className="no-group-cta">
                  {userData?.lastRecentGroup ? (
                    <>
                      <p>
                        {userData.lastRecentGroup.isAiGroup
                          ? t('dashboard.rejoinAiGroupPrompt')
                          : t('dashboard.rejoinGroupPrompt', { groupName: userData.lastRecentGroup.name })}
                      </p>
                      <div className="cta-buttons-container">
                        <button
                          className="cta-btn"
                          onClick={() => handleRejoin(userData.lastRecentGroup!)}
                          disabled={isRejoining}
                        >
                          {isRejoining ? t('dashboard.rejoiningBtn') : t('dashboard.rejoinBtn')}
                        </button>
                        <Link to={`/${language}/group-options`}>
                          <button className="cta-btn secondary-cta-btn">
                            {t('dashboard.findOrCreateOtherGroup')}
                          </button>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>{t('dashboard.joinGroupStudy')}</p>
                      <Link to={`/${language}/group-options`}>
                        <button className="cta-btn">{t('dashboard.joinCreateGroup')}</button>
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="dashboard-stats">
              <div className="stat-card streak-card">
                <h3>{t('dashboard.streak')}</h3>
                <div className="streak-value">
                  <span className="number">{userData.daysStudiedCount || 0}</span>
                  <span className="label">{t('dashboard.days')}</span>
                </div>
              </div>
              <div 
                className="stat-card level-card"
                onClick={() => {
                  const days = userData.daysStudiedCount || 0;
                  const currentLevel = calculateLevel(days);
                  useLevelUpStore.getState().openLevelUp({
                    level: currentLevel,
                    days,
                    nickname: userData.nickname || ''
                  });
                }}
                style={{ cursor: 'pointer' }}
                title={t('levelUp.viewCard')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    const days = userData.daysStudiedCount || 0;
                    const currentLevel = calculateLevel(days);
                    useLevelUpStore.getState().openLevelUp({
                      level: currentLevel,
                      days,
                      nickname: userData.nickname || ''
                    });
                  }
                }}
              >
                <h3>{t('profile.level')}</h3>
                <div className="streak-value">
                  <span className="number">
                    {calculateLevel(userData.daysStudiedCount || 0)}
                  </span>
                  <span className="label">Lv</span>
                </div>
                <div className="mini-progress-bar">
                  <div
                    className="mini-progress-fill mini-progress-fill-transition"
                    style={{ width: `${((userData.daysStudiedCount || 0) % 7) / 7 * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      <StreakCalendar 
        studiedDates={userData.studiedDates} 
        kickDate={kickDate}
        t={t} 
        language={language}
      />

      <div 
        className="inspiration-card inspiration-interactive-card"
        onClick={() => setShowWelcomeStory(true)}
      >
        <blockquote className="inspiration-quote">
          {t('dashboard.inspirationQuote')}
        </blockquote>
        <p className="inspiration-source">{t('dashboard.inspirationSource')}</p>
      </div>
    </div>
  );
};

export default DashboardOverview;
