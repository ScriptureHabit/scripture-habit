
import React, { useState, useCallback, useMemo } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { app } from '../firebase';
import { toast } from 'react-toastify';
import { useLanguage } from '../hooks/use-language';
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

  const db = useMemo(() => getFirestore(app), []);

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
      // 1. Create Group Doc
      const docRef = await addDoc(collection(db, 'groups'), {
        name: trimmedName,
        description: description.trim() || null,
        ownerUserId: currentUser.uid,
        members: [currentUser.uid],
        membersCount: 1,
        memberPreviews: [{ uid: currentUser.uid, nickname: currentUser.displayName || 'Owner' }],
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        lastMessageByNickname: currentUser.displayName || 'Owner',
        lastMessageByUid: currentUser.uid,
        isPrivate: false, // Default to public unless specified
        inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(), // Basic invite code
        messageCount: 0,
        noteCount: 0
      });

      // 2. Clear Form
      setName('');
      setDescription('');

      toast.success(t('groupForm.successCreated') || 'Group created successfully!');
      
      // 3. Callback
      onCreated?.(docRef.id);
    } catch (err: unknown) {
      console.error('Failed to create group:', err);
      toast.error(t('groupForm.errorCreateFailed') || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  }, [currentUser, name, description, db, t, onCreated]);

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


