
import './group-form.css';
import React, { useState } from "react";
import { auth, db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, arrayUnion, Timestamp, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../input/input';
import Button from '../button/button';
import Toggle from '../input/toggle';
import { toast } from "react-toastify";
import { useLanguage } from '../../hooks/use-language';
import { MAX_GROUPS_PER_USER } from '../../config';
import Mascot from '../mascot/mascot';
import { generateInviteCode } from '../../utils/invite-utils';

export default function GroupForm() {
  const { t, language } = useLanguage();
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const user = auth?.currentUser;
    if (!auth || !user) {
      setError(t('groupForm.errorLoggedIn'));
      return;
    }

    try {
      const creatorRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(creatorRef);
      const userData = userSnap.exists() ? userSnap.data() : null;

      // Enforce group limit
      const currentGroupIds = userData?.groupIds || [];
      if (currentGroupIds.length >= MAX_GROUPS_PER_USER) {
        setError(t('joinGroup.errorMaxGroups'));
        return;
      }

      const userNick = (userData && userData.nickname) ? userData.nickname : (user.displayName || 'Owner');

      const now = Timestamp.now();
      const expiresAt = new Timestamp(now.seconds + 24 * 60 * 60, now.nanoseconds);

      const inviteCode = generateInviteCode(10);

      const newGroupData = {
        name: groupName,
        description: description,
        createdAt: now,
        groupStreak: 0,
        inviteCode: inviteCode,
        inviteCodeExpiresAt: expiresAt,
        isPublic: isPublic,
        maxMembers: 100000,
        membersCount: 1,
        memberPreviews: [{ uid: user.uid, nickname: userNick }],
        messageCount: 0,
        noteCount: 0,
        ownerUserId: user.uid,
        members: [user.uid],
        memberJoinedAt: { [user.uid]: now },
        memberKickThresholds: { [user.uid]: userData?.kickThreshold || 3 },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo',
        lastInactivityCheckedAt: now,
      };


      const docRef = await addDoc(collection(db, 'groups'), newGroupData);
      const newGroupId = docRef.id;


      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        groupIds: arrayUnion(newGroupId),
        groupId: newGroupId, // Set as active
      });

      // Initialize group state
      const groupStateRef = doc(db, 'users', user.uid, 'groupStates', newGroupId);
      await setDoc(groupStateRef, {
        readMessageCount: 0,
        lastReadAt: now,
        lastActiveAt: now
      });

      // Initialize member subcollection document for owner
      const memberRef = doc(db, 'groups', newGroupId, 'members', user.uid);
      await setDoc(memberRef, {
        uid: user.uid,
        nickname: userNick,
        photoURL: userData?.photoURL || '',
        joinedAt: now,
        lastActiveAt: now,
        lastReadAt: now,
        kickThreshold: userData?.kickThreshold || 3,
        readMessageCount: 0
      });

      toast.success(`🎉 ${t('groupForm.successCreated')}`);
      navigate(`/${language}/dashboard`, { state: { initialGroupId: newGroupId, initialView: 2, showInviteModal: true } });

    } catch (e: unknown) {
      console.error("Error creating group or updating user:", e);
      setError(t('groupForm.errorCreateFailed'));
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
            label={t('groupForm.groupNameLabel')}
            type="text"
            placeholder={t('groupForm.groupNamePlaceholder')}
            value={groupName}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setGroupName(e.target.value)}
            required
            data-testid="group-name-input"
          />
          <Input
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

          <Button type="submit" className="create-group-submit-btn" data-testid="create-group-submit">
            {t('groupForm.createButton')}
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


