
import './group-form.css';
import React, { useState } from "react";
import { auth } from '../../firebase';
import apiClient from '../../utils/api-client';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../input/input';
import Button from '../button/button';
import Toggle from '../input/toggle';
import { toast } from "react-toastify";
import { useLanguage } from '../../hooks/use-language';
import Mascot from '../mascot/mascot';
import { useApiWarmupOnMount } from '../../utils/api-warmup';

export default function GroupForm() {
  useApiWarmupOnMount();
  const { t, language } = useLanguage();
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        isPublic: isPublic,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
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
          errorMessage = axiosError.response.data.error;
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
          userData={null} // GroupForm doesn't fetch userData locally, but auth.currentUser is enough for default streak logic if we wanted. But here we use customMessage anyway.
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

          {/* Max members input removed for unlimited members */}

          <div className="group-settings-section">
            <Toggle
              label={isPublic ? t('groupForm.publicLabel') : t('groupForm.privateLabel')}
              id="isPublic"
              checked={isPublic}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsPublic(e.target.checked)}
            />
            <div className="setting-description">
              <p className="description-text">
                {isPublic ? t('groupForm.publicDescription') : t('groupForm.privateDescription')}
              </p>
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

        <div className="join-group-cta">
          <p>{t('groupForm.joinGroupCta')}</p>
          <Link to="/join-group" className="join-group-link">{t('groupForm.joinGroupLink')}</Link>
        </div>

        <Link to="/dashboard" className="back-link">
          {t('groupOptions.backToDashboard')}
        </Link>
      </div>
    </div>
  );
}


