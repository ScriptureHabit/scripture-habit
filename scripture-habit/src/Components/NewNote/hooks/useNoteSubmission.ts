import { useState } from 'react';
import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { auth, db } from '../../../firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { UserData } from '../../../types/user';

export const useNoteSubmission = (
    userData: UserData,
    language: string | null,
    t: (key: string) => string
) => {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (
        noteToEdit: any,
        scripture: string,
        chapter: string,
        comment: string,
        shareOption: string,
        selectedShareGroups: string[],
        currentGroupId: string | null,
        gcMeta: { title: string; speaker?: string } | null,
        onSuccess: () => void
    ) => {
        if (loading || !scripture || !chapter || !comment) return;
        setLoading(true);

        const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';

        try {
            if (noteToEdit) {
                // UPDATE LOGIC (Batched updates)
                const batch = writeBatch(db);
                const messageText = `**${scripture} ${chapter}**\n\n${comment}`;

                if (noteToEdit.isMessage || noteToEdit.isNote || noteToEdit.isEntry) {
                    // Editing an existing message in a group
                    const targetGroupId = noteToEdit.groupId || currentGroupId || userData.groupId;
                    if (!targetGroupId) throw new Error("No group specified");

                    const messageRef = doc(db, 'groups', targetGroupId, 'messages', noteToEdit.id);
                    batch.update(messageRef, {
                        text: messageText,
                        scripture,
                        chapter,
                        editedAt: serverTimestamp(),
                        isEdited: true
                    });

                    // Sync to personal note if linked
                    if (noteToEdit.originalNoteId) {
                        try {
                            const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.originalNoteId);
                            batch.update(noteRef, {
                                text: messageText,
                                scripture,
                                chapter,
                                comment
                            });
                        } catch (err) {
                            console.log("Could not sync back to personal note:", err);
                        }
                    }
                } else {
                    // Editing a personal note
                    const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.id);
                    batch.update(noteRef, {
                        text: messageText,
                        scripture,
                        chapter,
                        comment,
                        title: gcMeta?.title || null,
                        speaker: gcMeta?.speaker || null
                    });

                    // SYNC TO GROUPS
                    const sharedMessageIds: Record<string, string> = { ...(noteToEdit.sharedMessageIds || {}) };
                    const groupsToCheck = noteToEdit.sharedWithGroups || [];
                    
                    for (const gid of groupsToCheck) {
                        const messageId = sharedMessageIds[gid];
                        if (messageId) {
                            const msgRef = doc(db, 'groups', gid, 'messages', messageId);
                            batch.update(msgRef, { text: messageText });
                        }
                    }
                }
                
                await batch.commit();
                toast.success(t('newNote.successUpdate'));
                onSuccess();
            } else {
                // CREATE NEW NOTE (API Call)
                const user = auth?.currentUser;
                if (!user) throw new Error("No user logged in");
                const idToken = await user.getIdToken(true);

                const messageText = `**${scripture} ${chapter}**\n\n${comment}`;

                const response = await axios.post(`${API_BASE}/api/post-note`, {
                    chapter,
                    comment,
                    scripture,
                    messageText,
                    shareOption,
                    selectedShareGroups,
                    currentGroupId,
                    language: language || 'en',
                    title: gcMeta?.title || null,
                    speaker: gcMeta?.speaker || null,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                }, {
                    headers: { 'Authorization': `Bearer ${idToken}` }
                });

                if (response.data && response.data.success) {
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        zIndex: 10000
                    });

                    toast.success(t('newNote.successPost'));
                    onSuccess();
                } else {
                    throw new Error(response.data.error || "Post failed");
                }
            }
        } catch (error: any) {
            console.error("Error submitting note:", error);
            toast.error(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return { loading, handleSubmit };
};
