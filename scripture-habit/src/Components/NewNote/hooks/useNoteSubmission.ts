import { useState } from 'react';
import axios from 'axios';
import apiClient from '../../../Utils/apiClient';
import { db } from '../../../firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { UserData } from '../../../types/user';
import { buildNoteSearchTokens } from '../../../Utils/searchTokenUtils';

import { Message } from '../../../types/chat';
import { Note } from '../../../types/note';

type NoteToEdit = (Note | Message) & { 
    isMessage?: boolean; 
    isNote?: boolean; 
    isEntry?: boolean; 
    sharedWithGroups?: string[]; 
    groupId?: string; 
    originalNoteId?: string;
    sharedMessageIds?: Record<string, string>;
};

export const useNoteSubmission = (
    userData: UserData,
    language: string | null,
    t: (key: string) => string
) => {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (
        noteToEdit: NoteToEdit | null,
        scripture: string,
        chapter: string,
        comment: string,
        shareOption: string,
        selectedShareGroups: string[],
        currentGroupId: string | null,
        urlMeta: { title: string; speaker?: string } | null,
        onSuccess: () => void
    ) => {
        if (loading || !scripture || !chapter || !comment) return;

        // --- NEW VALIDATION: Enforce URL for certain categories ---
        const isUrl = chapter.startsWith('http');
        if (scripture === "General Conference" && !isUrl) {
            toast.error(t('newNote.urlRequiredForGC'));
            return;
        }
        if (scripture === "BYU Speeches" && !isUrl) {
            toast.error(t('newNote.urlRequiredForBYU'));
            return;
        }

        setLoading(true);

        try {
            if (noteToEdit) {
                // UPDATE LOGIC (Batched updates)
                const batch = writeBatch(db);
                const messageText = `**${scripture} ${chapter}**\n\n${comment}`;

                if (noteToEdit.isMessage || noteToEdit.isNote || noteToEdit.isEntry) {
                    // Editing an existing message in a group
                    const targetGroupId = noteToEdit.groupId || currentGroupId || userData.groupId;
                    if (!targetGroupId || !noteToEdit.id) throw new Error("No group or message ID specified");

                    const messageRef = doc(db, 'groups', targetGroupId, 'messages', noteToEdit.id);
                    batch.update(messageRef, {
                        text: messageText,
                        scripture,
                        chapter,
                        editedAt: serverTimestamp(),
                        isEdited: true
                    });

                    // Sync to personal note if linked
                    if (noteToEdit.originalNoteId && userData.uid) {
                        try {
                            const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.originalNoteId);
                            batch.update(noteRef, {
                                text: messageText,
                                scripture,
                                chapter,
                                comment,
                                searchTokens: buildNoteSearchTokens({ scripture, chapter, comment, title: urlMeta?.title, speaker: urlMeta?.speaker })
                            });
                        } catch (err) {
                            console.log("Could not sync back to personal note:", err);
                        }
                    }
                } else {
                    // Editing a personal note
                    if (!userData.uid || !noteToEdit.id) throw new Error("No user ID or note ID found");
                    const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.id);
                    batch.update(noteRef, {
                        text: messageText,
                        scripture,
                        chapter,
                        comment,
                        title: urlMeta?.title || null,
                        speaker: urlMeta?.speaker || null,
                        searchTokens: buildNoteSearchTokens({ scripture, chapter, comment, title: urlMeta?.title, speaker: urlMeta?.speaker })
                    });
                }


                await batch.commit();
                toast.success(t('newNote.successUpdate'));
                onSuccess();
            } else {
                const messageText = `**${scripture} ${chapter}**\n\n${comment}`;

                const response = await apiClient.post('/api/post-note/', {
                    chapter,
                    comment,
                    scripture,
                    messageText,
                    shareOption,
                    selectedShareGroups,
                    currentGroupId,
                    language: language || 'en',
                    title: urlMeta?.title || null,
                    speaker: urlMeta?.speaker || null,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
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

        } catch (err: unknown) {
            console.error("Error submitting note:", err);
            let errorMessage = t('errors.unexpectedError');
            
            if (axios.isAxiosError(err)) {
                errorMessage = err.response?.data?.error || err.message;
            } else if (err instanceof Error) {
                errorMessage = err.message;
            }
            
            // Firebase Auth error code check
            if (errorMessage.includes('auth/network-request-failed')) {
                errorMessage = t('errors.networkError');
            } else if (errorMessage.includes('auth/')) {
                errorMessage = t('errors.authError');
            }

            toast.error(`${t('errors.prefix')}: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return { loading, handleSubmit };
};

