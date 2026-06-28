
import React, { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useLanguage } from '../hooks/use-language';
import apiClient from '../utils/api-client';
import './group-create.css';

interface UserInfo {
  uid: string;
  displayName?: string;
}

interface GroupCreateProps {
  currentUser: UserInfo | null;
  onCreated?: (groupId: string) => void;
}

export default function GroupCreate({ currentUser, onCreated }: GroupCreateProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      toast.error(t('groupForm.errorLoggedIn') || 'Please sign in to create a group');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t('groupForm.groupNamePlaceholder') || 'Please enter a group name');
      return;
    }

    if (trimmedName.length < 2) {
      toast.warning('Group name is too short');
      return;
    }

    setLoading(true);
    try {
      // 1. Create Group via API to maintain data integrity
      const response = await apiClient.post('/api/groups/create-group', {
        name: trimmedName,
        description: description.trim() || null,
        isPublic: true, // Default to public
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      });

      const { groupId } = response.data;

      // 2. Clear Form
      setName('');
      setDescription('');

      toast.success(t('groupForm.successCreated') || 'Group created successfully!');
      
      // 3. Callback
      onCreated?.(groupId);
    } catch (err: unknown) {
      console.error('Failed to create group:', err);
      toast.error(t('groupForm.errorCreateFailed') || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  }, [currentUser, name, description, t, onCreated]);

  return (
    <div className="group-create-container">
      <h3>{t('groupForm.title')}</h3>
      <form onSubmit={handleCreate} className="group-create-form">
        <div className="input-group">
          <input
            id="group-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('groupForm.groupNamePlaceholder')}
            disabled={loading}
            maxLength={50}
            required
          />
        </div>
        <div className="input-group">
          <input
            id="group-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('groupForm.descriptionLabel')}
            disabled={loading}
            maxLength={200}
          />
        </div>
        <button 
          className="create-submit-btn"
          type="submit" 
          disabled={loading}
        >
          {loading ? t('newNote.saving') : t('groupForm.createButton')}
        </button>
      </form>
    </div>
  );
}


