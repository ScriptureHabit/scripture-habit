import './group-form.css';
import React, { useState, useEffect } from "react";
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import apiClient from '../../utils/api-client';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../input/input';
import Button from '../button/button';
import { toast } from "react-toastify";
import { useLanguage } from '../../hooks/use-language';
import Mascot from '../mascot/mascot';
import { useApiWarmupOnMount } from '../../utils/api-warmup';
import { GroupService } from '../../services/group-service';

export default function GroupForm() {
  useApiWarmupOnMount();
  const { t, language } = useLanguage();
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [isFamilySyncEnabled, setIsFamilySyncEnabled] = useState(false);
  const [hasExistingFamilyGroup, setHasExistingFamilyGroup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth) return;
    let unsubGroups: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user?.uid) {
        unsubGroups = GroupService.subscribeUserGroups(
          user.uid,
          (groups) => {
            const hasFam = groups.some((g) => g.isFamilySyncEnabled && !g.isDeleted);
            setHasExistingFamilyGroup(hasFam);
          },
          (err) => {
            console.error("[GroupForm] Failed to subscribe user groups:", err);
          }
        );
      }
    });

    return () => {
      unsubAuth();
      if (unsubGroups) unsubGroups();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const user = auth?.currentUser;
    if (!auth || !user) {
      setError(t('groupForm.errorLoggedIn'));
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/api/groups/create-group', {
        name: groupName,
        description: description,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo',
        isFamilySyncEnabled: isFamilySyncEnabled
      });

      const result = response.data;
      const newGroupId = result.groupId;

      toast.success(`🎉 ${t('groupForm.successCreated')}`);
      navigate(`/${language}/dashboard`, { state: { initialGroupId: newGroupId, initialView: 2, showInviteModal: true } });

    } catch (e: unknown) {
      console.error("Error creating group:", e);
      let errorMessage = t('groupForm.errorCreateFailed');
      if (e && typeof e === 'object' && 'response' in e) {
        const axiosError = e as { response?: { data?: { error?: string } } };
        if (axiosError.response?.data?.error) {
          const errKey = axiosError.response.data.error;
          errorMessage = t(errKey) || errKey;
        }
      } else if (e instanceof Error) {
        errorMessage = e.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="App GroupForm">
      <div className="AppGlass">
        <h2>{t('groupForm.title')}</h2>
        <Mascot
          userData={null}
          customMessage={t('mascot.createGroupPrompt')}
        />

        <form onSubmit={handleSubmit} className="group-form">
          <Input
            id="group-form-name"
            name="groupName"
            label={t('groupForm.groupNameLabel')}
            type="text"
            placeholder={t('groupForm.groupNamePlaceholder')}
            value={groupName}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setGroupName(e.target.value)}
            required
            data-testid="group-name-input"
          />
          <Input
            id="group-form-description"
            name="description"
            label={t('groupForm.descriptionLabel')}
            as="textarea"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDescription(e.target.value)}
          />

          {/* Mode Selection: Family Mode vs Personal Mode */}
          <div className="group-mode-selection-card" data-testid="group-mode-selection-card">
            <div className="mode-selection-header">
              <div className="mode-header-left">
                <span className="mode-icon">👨‍👩‍👧</span>
                <strong className="mode-title">{t('familyTheme.groupOptionToggle')}</strong>
                <span className={`mode-badge ${isFamilySyncEnabled ? 'family-badge' : 'individual-badge'}`}>
                  {isFamilySyncEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <label
                className={`switch ${hasExistingFamilyGroup && !isFamilySyncEnabled ? 'disabled' : ''}`}
                style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}
                aria-label={t('familyTheme.groupOptionToggle')}
              >
                <input
                  type="checkbox"
                  checked={isFamilySyncEnabled}
                  onChange={(e) => {
                    if (hasExistingFamilyGroup && !isFamilySyncEnabled) {
                      toast.warning(t('familyTheme.alreadyEnabledInOtherGroup'));
                      return;
                    }
                    setIsFamilySyncEnabled(e.target.checked);
                  }}
                  disabled={hasExistingFamilyGroup && !isFamilySyncEnabled}
                  style={{ opacity: 0, width: 0, height: 0 }}
                  data-testid="family-mode-toggle"
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: (hasExistingFamilyGroup && !isFamilySyncEnabled) ? 'not-allowed' : 'pointer',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: isFamilySyncEnabled ? '#ed64a6' : '#ccc',
                    transition: '.3s',
                    borderRadius: '24px'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: '18px',
                      width: '18px',
                      left: isFamilySyncEnabled ? '23px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      transition: '.3s',
                      borderRadius: '50%'
                    }}
                  />
                </span>
              </label>
            </div>

            {hasExistingFamilyGroup && (
              <p className="already-enabled-warning" data-testid="already-enabled-warning">
                ⚠️ {t('familyTheme.alreadyEnabledInOtherGroup')}
              </p>
            )}

            <div className="mode-cards-container">
              {/* Family Mode Card */}
              <div
                className={`mode-card ${isFamilySyncEnabled ? 'selected-family' : ''} ${hasExistingFamilyGroup && !isFamilySyncEnabled ? 'disabled' : ''}`}
                onClick={() => {
                  if (hasExistingFamilyGroup && !isFamilySyncEnabled) {
                    toast.warning(t('familyTheme.alreadyEnabledInOtherGroup'));
                    return;
                  }
                  setIsFamilySyncEnabled(true);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!hasExistingFamilyGroup || isFamilySyncEnabled) setIsFamilySyncEnabled(true);
                  }
                }}
                data-testid="mode-card-family"
              >
                <div className="mode-card-title family-text">
                  <span className="radio-indicator">{isFamilySyncEnabled ? '● ' : '○ '}</span>
                  {t('familyTheme.modeFamilyTitle')}
                </div>
                <div className="mode-card-desc">
                  {t('familyTheme.modeFamilyDesc')}
                </div>
              </div>

              {/* Personal / Individual Mode Card */}
              <div
                className={`mode-card ${!isFamilySyncEnabled ? 'selected-individual' : ''}`}
                onClick={() => setIsFamilySyncEnabled(false)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsFamilySyncEnabled(false);
                  }
                }}
                data-testid="mode-card-individual"
              >
                <div className="mode-card-title individual-text">
                  <span className="radio-indicator">{!isFamilySyncEnabled ? '● ' : '○ '}</span>
                  {t('familyTheme.modeIndividualTitle')}
                </div>
                <div className="mode-card-desc">
                  {t('familyTheme.modeIndividualDesc')}
                </div>
              </div>
            </div>
          </div>

          <div className="invite-link-preview-card">
            <div className="preview-header">
              <span>🔗 {t('groupForm.invitePreviewTitle')}</span>
            </div>
            <div className="simulated-link-box">
              <code>{window.location.origin}/join/XXXXXX</code>
            </div>
            <p className="preview-helper-text">
              {t('groupForm.invitePreviewDesc')}
            </p>
          </div>

          <Button 
            type="submit" 
            className="create-group-submit-btn" 
            data-testid="create-group-submit" 
            disabled={loading}
          >
            {loading ? t('groupForm.createButton') + '...' : t('groupForm.createButton')}
          </Button>
        </form>
        {error && <p className="error-message">{error}</p>}

        <Link to={`/${language}/dashboard`} className="back-link">
          {t('groupOptions.backToDashboard')}
        </Link>
      </div>
    </div>
  );
}
