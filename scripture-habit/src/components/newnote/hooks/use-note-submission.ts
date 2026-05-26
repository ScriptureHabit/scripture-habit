import { useState } from 'react';
import axios from 'axios';
import apiClient from '../../../utils/api-client';
import { db } from '../../../firebase';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { UserData } from '../../../types/user';
import { buildNoteSearchTokens } from '../../../utils/search-token-utils';
import { formatNoteText, getNoteValidationError } from '../../../utils/note-logic';

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
        if (loading) return;

        // 1. Validation
        const validationError = getNoteValidationError(scripture, chapter);
        if (validationError) {
            toast.error(t(validationError));
            return;
        }

        setLoading(true);

        try {
            const messageText = formatNoteText(scripture, chapter, comment);
            const searchTokens = buildNoteSearchTokens({ 
                scripture, 
                chapter, 
                comment, 
                title: urlMeta?.title, 
                speaker: urlMeta?.speaker 
            });

            if (noteToEdit) {
                // UPDATE FLOW (Direct Firestore)
                const batch = writeBatch(db);

                if (noteToEdit.isMessage || noteToEdit.isNote || noteToEdit.isEntry) {
                    // Update group message
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
                                searchTokens
                            });
                        } catch (err) {
                            console.log("Could not sync back to personal note:", err);
                        }
                    }
                } else {
                    // Update standalone personal note
                    if (!userData.uid || !noteToEdit.id) throw new Error("No user ID or note ID found");
                    const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.id);
                    batch.update(noteRef, {
                        text: messageText,
                        scripture,
                        chapter,
                        comment,
                        title: urlMeta?.title || null,
                        speaker: urlMeta?.speaker || null,
                        searchTokens
                    });
                }

                await batch.commit();
                toast.success(t('newNote.successUpdate'));
                onSuccess();
            } else {
                // CREATE FLOW (Backend API)
                const response = await apiClient.post('/api/groups/post-note', {
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
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    clientTimestamp: Date.now()
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
                const serverError = err.response?.data?.error;
                errorMessage = (typeof serverError === 'string') ? serverError : 
                             (serverError?.message ? String(serverError.message) : err.message);
            } else if (err instanceof Error) {
                errorMessage = err.message;
            }
            
            const safeErrorStr = String(errorMessage);
            if (safeErrorStr.includes('auth/network-request-failed')) {
                errorMessage = t('errors.networkError');
            } else if (safeErrorStr.includes('auth/')) {
                errorMessage = t('errors.authError');
            }

            toast.error(`${t('errors.prefix')}: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    };

    return { loading, handleSubmit };
};
