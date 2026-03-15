import { useState, useEffect, useMemo, FC, ChangeEvent } from 'react';
import * as Sentry from "@sentry/react";
import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { auth, db } from '../../firebase';
import { collection, serverTimestamp, doc, getDoc, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { UilTrashAlt, UilShuffle } from '@iconscout/react-unicons';
import { toast } from 'react-toastify';
import Select, { SingleValue } from 'react-select';
import { ScripturesOptions } from '../../Data/Data';
import { MasteryScriptures } from '../../Data/MasteryScriptures';
import { PeaceScriptures } from '../../Data/PeaceScriptures';
import { AdversityScriptures } from '../../Data/AdversityScriptures';
import { RelationshipScriptures } from '../../Data/RelationshipScriptures';
import { JoyScriptures } from '../../Data/JoyScriptures';
import Input from '../Input/Input';
import './NewNote.css';
import { useLanguage } from '../../Context/LanguageContext';
import { removeNoteHeader } from '../../Utils/noteUtils';
import { translateChapterField } from '../../Utils/bookNameTranslations';
import { getGospelLibraryUrl, getCategoryFromScripture } from '../../Utils/gospelLibraryMapper';
import { getTodayReadingPlan } from '../../Data/DailyReadingPlan';
import { localizeLdsUrl } from '../../Utils/urlLocalizer';
import { useGCMetadata } from '../../hooks/useGCMetadata';
import confetti from 'canvas-confetti';
import { getBookSuggestions } from '../../Utils/suggestionUtils';
import { bookNameTranslations } from '../../Utils/bookNameTranslations';
import { Note } from '../../types/note';
import { UserData } from '../../types/user';
import { Group } from '../../types/chat';

interface NoteToEdit extends Note {
    groupMessageId?: string;
    groupId?: string;
    originalNoteId?: string;
}

interface NewNoteProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserData;
    noteToEdit?: NoteToEdit | null;
    onDelete?: () => void;
    userGroups?: Group[];
    isGroupContext?: boolean;
    currentGroupId?: string | null;
    initialData?: { chapter?: string; scripture?: string; comment?: string } | null;
}

interface ScriptureOption {
    value: string;
    label: string;
}

const NewNote: FC<NewNoteProps> = ({ isOpen, onClose, userData, noteToEdit, onDelete, userGroups = [], isGroupContext = false, currentGroupId = null, initialData = null }) => {
    const { t, tArray, language } = useLanguage();
    const API_BASE = Capacitor.isNativePlatform() ? 'https://scripturehabit.app' : '';

    const [chapter, setChapter] = useState('');
    const [scripture, setScripture] = useState('');
    const [selectedOption, setSelectedOption] = useState<SingleValue<ScriptureOption>>(null);
    const [comment, setComment] = useState('');
    const [aiQuestion, setAiQuestion] = useState('');
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);
    const [initialValues, setInitialValues] = useState({ chapter: '', scripture: '', comment: '' });

    // New sharing states
    const [shareOption, setShareOption] = useState('all'); // 'all', 'specific', 'none', 'current'
    const [selectedShareGroups, setSelectedShareGroups] = useState<string[]>([]);

    // Fetch metadata for GC/Other URLs
    const isUrl = chapter && (chapter.startsWith('http') || chapter.includes('churchofjesuschrist.org'));
    const { data: gcMeta, loading: gcLoading } = useGCMetadata(isUrl ? chapter : null, language);

    // Randomized placeholders
    const currentChapterPlaceholder = useMemo(() => {
        const arr = tArray('newNote.chapterPlaceholder');
        return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : t('newNote.chapterPlaceholder');
    }, [tArray, t]);

    const currentCommentPlaceholder = useMemo(() => {
        const arr = tArray('newNote.commentPlaceholder');
        return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : t('newNote.commentPlaceholder');
    }, [tArray, t]);

    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showScriptureSelectionModal, setShowScriptureSelectionModal] = useState(false);
    const [showRandomMenu, setShowRandomMenu] = useState(false);
    const [availableReadingPlanScripts, setAvailableReadingPlanScripts] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const getTranslatedScriptureLabel = (value: string) => {
        switch (value) {
            case "Old Testament": return t('scriptures.oldTestament');
            case "New Testament": return t('scriptures.newTestament');
            case "Book of Mormon": return t('scriptures.bookOfMormon');
            case "Doctrine and Covenants": return t('scriptures.doctrineAndCovenants');
            case "Pearl of Great Price": return t('scriptures.pearlOfGreatPrice');
            case "Ordinances and Proclamations": return t('scriptures.ordinancesAndProclamations');
            case "General Conference": return t('scriptures.generalConference');
            case "BYU Speeches": return t('scriptures.byuSpeeches');
            case "Other": return t('scriptures.other');
            default: return value;
        }
    };

    const translatedScripturesOptions: ScriptureOption[] = ScripturesOptions.map(option => ({
        ...option,
        label: getTranslatedScriptureLabel(option.value)
    }));

    useEffect(() => {
        if (isOpen && noteToEdit) {
            const text = removeNoteHeader(noteToEdit.text || '');

            const chapterMatch = text.match(/\*\*(?:Chapter|Title|Speech):\*\* (.*?)(?:\n|$)/);
            const chap = chapterMatch ? chapterMatch[1].trim() : '';

            const scriptureMatch = text.match(/\*\*Scripture:\*\* (.*?)(?:\n|$)/);
            const script = scriptureMatch ? scriptureMatch[1].trim() : '';

            let comm = text;
            let maxIndex = 0;

            if (scriptureMatch) {
                const start = scriptureMatch.index || 0;
                const end = start + scriptureMatch[0].length;
                if (end > maxIndex) maxIndex = end;
            }
            if (chapterMatch) {
                const start = chapterMatch.index || 0;
                const end = start + chapterMatch[0].length;
                if (end > maxIndex) maxIndex = end;
            }

            if (maxIndex > 0) {
                comm = text.substring(maxIndex).trim();
            }

            setChapter(chap);
            setScripture(script);
            setComment(comm);
            setInitialValues({ chapter: chap, scripture: script, comment: comm });

            const option = translatedScripturesOptions.find(opt => opt.value.toLowerCase() === script.toLowerCase());
            setSelectedOption(option || null);

            setShareOption('none');
            setSelectedShareGroups([]);

        } else if (isOpen && !noteToEdit) {
            // Check for initialData
            if (initialData) {
                setChapter(initialData.chapter || '');
                setScripture(initialData.scripture || '');
                setComment(initialData.comment || '');
                setInitialValues({ chapter: initialData.chapter || '', scripture: initialData.scripture || '', comment: initialData.comment || '' });

                if (initialData.scripture) {
                    const option = translatedScripturesOptions.find(opt => opt.value.toLowerCase() === (initialData.scripture || '').toLowerCase());
                    setSelectedOption(option || null);
                } else {
                    setSelectedOption(null);
                }
            } else {
                setChapter('');
                setScripture('');
                setComment('');
                setInitialValues({ chapter: '', scripture: '', comment: '' });
                setAiQuestion('');
                setSelectedOption(null);
            }

            // Default sharing option logic
            if (isGroupContext) {
                setShareOption('current');
            } else {
                setShareOption(userGroups.length > 0 ? 'all' : 'none');
            }
            setSelectedShareGroups([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, noteToEdit, userGroups.length, isGroupContext, initialData]);

    // Real-time validation for missing chapter/verse digits
    useEffect(() => {
        if (!isOpen) return;

        const scriptureVolumes = [
            "Old Testament",
            "New Testament",
            "Book of Mormon",
            "Doctrine and Covenants",
            "Pearl of Great Price"
        ];

        if (chapter && scripture && scriptureVolumes.includes(scripture)) {
            // Check if there are NO digits in the chapter field
            if (!/\d/.test(chapter)) {
                setError(t('newNote.errorChapterRequired'));
            } else if (error === t('newNote.errorChapterRequired')) {
                // Clear ONLY this specific error if they add a digit
                setError(null);
            }
        } else if (error === t('newNote.errorChapterRequired')) {
            // Clear the error if scripture changes or chapter is cleared
            setError(null);
        }
    }, [chapter, scripture, isOpen, t, error]);

    const handleGroupSelection = (groupId: string) => {
        setSelectedShareGroups(prev => {
            if (prev.includes(groupId)) {
                return prev.filter(id => id !== groupId);
            } else {
                return [...prev, groupId];
            }
        });
    };

    const handleClose = () => {
        const hasChanges =
            chapter !== (initialValues.chapter || '') ||
            scripture !== (initialValues.scripture || '') ||
            comment !== (initialValues.comment || '');

        if (hasChanges) {
            setShowCloseConfirm(true);
        } else {
            onClose();
        }
    };

    if (!isOpen) return null;

    const handleGenerateQuestions = async () => {
        if (!scripture || !chapter) {
            toast.warning(t('newNote.errorMissingFields'));
            return;
        }

        setAiLoading(true);
        try {
            const apiUrl = Capacitor.isNativePlatform()
                ? 'https://scripturehabit.app/api/generate-ponder-questions'
                : '/api/generate-ponder-questions';

            const user = auth?.currentUser;
            if (!auth || !user) throw new Error("No user logged in");
            
            const idToken = await user.getIdToken(true);
            const response = await axios.post(apiUrl, {
                scripture: selectedOption?.label || scripture,
                chapter,
                language
            }, {
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });

            if (response.data.questions) {
                const newContent = response.data.questions;
                setAiQuestion(newContent);
                toast.success(t('newNote.aiQuestionsGenerated') || 'AI Ponder Questions generated!');
            }
        } catch (error: any) {
            console.error(error);
            toast.error(t('newNote.aiQuestionsError') || 'Failed to generate questions. Gemini API key might be missing.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleSurpriseMe = () => {
        setShowRandomMenu(true);
    };

    const handlePickRandomMastery = () => {
        const randomIndex = Math.floor(Math.random() * MasteryScriptures.length);
        const randomScripture = MasteryScriptures[randomIndex];
        pickAndFillRandom(randomScripture);
        setShowRandomMenu(false);
    };

    const handlePickRandomPeace = () => {
        const randomIndex = Math.floor(Math.random() * PeaceScriptures.length);
        const randomScripture = PeaceScriptures[randomIndex];
        pickAndFillRandom(randomScripture);
        setShowRandomMenu(false);
    };

    const handlePickRandomAdversity = () => {
        const randomIndex = Math.floor(Math.random() * AdversityScriptures.length);
        const randomScripture = AdversityScriptures[randomIndex];
        pickAndFillRandom(randomScripture);
        setShowRandomMenu(false);
    };

    const handlePickRandomRelationship = () => {
        const randomIndex = Math.floor(Math.random() * RelationshipScriptures.length);
        const randomScripture = RelationshipScriptures[randomIndex];
        pickAndFillRandom(randomScripture);
        setShowRandomMenu(false);
    };

    const handlePickRandomJoy = () => {
        const randomIndex = Math.floor(Math.random() * JoyScriptures.length);
        const randomScripture = JoyScriptures[randomIndex];
        pickAndFillRandom(randomScripture);
        setShowRandomMenu(false);
    };

    const pickAndFillRandom = (randomScripture: any) => {
        // Find the option that matches the category
        const option = translatedScripturesOptions.find(opt => opt.value === randomScripture.scripture);

        if (option) {
            setSelectedOption(option);
            setScripture(randomScripture.scripture);

            let finalChapter = randomScripture.chapter;

            // If it's a URL, localize it
            if (finalChapter.startsWith('http')) {
                finalChapter = localizeLdsUrl(finalChapter, language);
            } else {
                // Otherwise translate as a normal chapter (e.g. Proverbs 3:5-6 -> 箴言 3:5-6)
                finalChapter = translateChapterField(finalChapter, language);
            }

            setChapter(finalChapter);
        }
    };

    const fillScriptureData = (script: string) => {
        const category = getCategoryFromScripture(script);
        let chapterVal = translateChapterField(script, language);

        // Special handling for Doctrine and Covenants: often just show section number
        if (category === "Doctrine and Covenants") {
            const match = script.match(/(?:Doctrine and Covenants|D&C)\s+(.*)/i);
            if (match) {
                chapterVal = match[1]; // Just the section number
            }
        }

        const option = translatedScripturesOptions.find(opt => opt.value === category);
        if (option) {
            setSelectedOption(option);
            setScripture(category);
            setChapter(chapterVal || "");
        } else {
            setScripture('Other');
            setChapter(chapterVal || "");
            setSelectedOption(translatedScripturesOptions.find(opt => opt.value === 'Other') || null);
        }
    };

    const handleTodaysReading = () => {
        const plan = getTodayReadingPlan();
        if (!plan || !plan.scripts || plan.scripts.length === 0) {
            toast.info(t('dashboard.noReadingPlan'));
            return;
        }

        if (plan.scripts.length > 1) {
            setAvailableReadingPlanScripts(plan.scripts);
            setShowScriptureSelectionModal(true);
            setShowRandomMenu(false);
        } else {
            fillScriptureData(plan.scripts[0]);
            setShowRandomMenu(false);
        }
    };

    const handleSubmit = async () => {
        if (!chapter || !scripture) {
            setError(t('newNote.errorMissingFields'));
            return;
        }

        // Validation: For main scripture volumes, ensure at least one digit is present (chapter/verse)
        const scriptureVolumes = [
            "Old Testament",
            "New Testament",
            "Book of Mormon",
            "Doctrine and Covenants",
            "Pearl of Great Price"
        ];

        if (scriptureVolumes.includes(scripture) && !/\d/.test(chapter)) {
            setError(t('newNote.errorChapterRequired'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let messageText: string;
            // Improved detection for Other/GC/BYU to ensure URL inclusion
            const sLower = (scripture || "").toLowerCase();
            const isOther = sLower.includes("other") || sLower.includes("その他") || scripture === "";
            const isGC = sLower.includes("general") || sLower.includes("総大会");
            const isBYU = sLower.includes("byu");

            if (isOther) {
                // chapter holds the raw URL. ALWAYS save it as a visible line.
                messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Url:** ${chapter}\n\n${comment}`;
            } else if (isGC) {
                const talkVal = gcMeta?.title || chapter || "";
                // If chapter is a URL or shortcode, we should save it separately to ensure NoteDisplay can find it
                const isUrl = chapter && (chapter.toLowerCase().startsWith('http') || /^\d{4}\/\d{2}\/.+/.test(chapter));
                messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Talk:** ${talkVal}\n${isUrl ? `**Url:** ${chapter}\n` : ''}\n${comment}`;
            } else if (isBYU) {
                // For BYU, chapter is the URL
                messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Speech:** ${gcMeta?.title || "Speech"}\n**Url:** ${chapter}\n\n${comment}`;
            } else {
                messageText = `📖 **New Study Note**\n\n**Scripture:** ${scripture}\n\n**Chapter:** ${chapter}\n\n${comment}`;
            }

            const batch = writeBatch(db);

            if (noteToEdit) {
                if (noteToEdit.groupMessageId && noteToEdit.groupId) {
                    // Editing a message directly from group chat
                    const messageRef = doc(db, 'groups', noteToEdit.groupId, 'messages', noteToEdit.groupMessageId);

                    // First get the message to check for originalNoteId
                    const messageSnap = await getDoc(messageRef);
                    const messageData = messageSnap.exists() ? messageSnap.data() : null;

                    batch.update(messageRef, {
                        text: messageText,
                        scripture: scripture,
                        chapter: chapter,
                        editedAt: serverTimestamp(),
                        isEdited: true
                    });

                    // Sync to personal note if linked
                    if (messageData?.originalNoteId) {
                        try {
                            const noteRef = doc(db, 'users', userData.uid, 'notes', messageData.originalNoteId);
                            batch.update(noteRef, {
                                text: messageText,
                                scripture: scripture,
                                chapter: chapter,
                                comment: comment
                            });
                        } catch (err) {
                            console.log("Could not sync back to personal note:", err);
                        }
                    }
                } else if (isGroupContext) {
                    // Editing an existing note (which is a message in a specific group)
                    const targetGroupId = currentGroupId || userData.groupId;
                    if (targetGroupId) {
                        const messageRef = doc(db, 'groups', targetGroupId, 'messages', noteToEdit.id);
                        batch.update(messageRef, {
                            text: messageText,
                        });

                        // Try to sync back to personal note if linked
                        if (noteToEdit.originalNoteId) {
                            try {
                                const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.originalNoteId);
                                batch.update(noteRef, {
                                    text: messageText,
                                    scripture: scripture,
                                    chapter: chapter,
                                    comment: comment
                                });
                            } catch (err) {
                                console.log("Could not sync back to personal note:", err);
                            }
                        }
                    }
                } else {
                    // Editing a personal note
                    const noteRef = doc(db, 'users', userData.uid, 'notes', noteToEdit.id);
                    batch.update(noteRef, {
                        text: messageText,
                        scripture: scripture,
                        chapter: chapter,
                        comment: comment,
                        title: gcMeta?.title || null,
                        speaker: gcMeta?.speaker || null
                    });

                    // SYNC TO GROUPS
                    // 1. Get the list of groups this note was shared with
                    const sharedMessageIds: Record<string, string> = { ...(noteToEdit.sharedMessageIds || {}) };
                    const groupsToCheck = noteToEdit.sharedWithGroups || [];
                    let idsUpdated = false;

                    for (const groupId of groupsToCheck) {
                        let messageId = sharedMessageIds[groupId];

                        if (!messageId) {
                            // Attempt to find the message in this group
                            try {
                                const messagesRef = collection(db, 'groups', groupId, 'messages');

                                // Strategy A: Check by originalNoteId (for future notes)
                                const qId = query(messagesRef, where('originalNoteId', '==', noteToEdit.id));
                                const snapId = await getDocs(qId);

                                if (!snapId.empty) {
                                    messageId = snapId.docs[0].id;
                                } else {
                                    // Strategy B: Check by content match (for legacy notes)
                                    const qText = query(messagesRef,
                                        where('senderId', '==', userData.uid),
                                        where('isNote', '==', true),
                                        where('text', '==', noteToEdit.text)
                                    );
                                    const snapText = await getDocs(qText);
                                    if (!snapText.empty) {
                                        messageId = snapText.docs[0].id;
                                        // Also update the message with originalNoteId for future robustness
                                        batch.update(doc(db, 'groups', groupId, 'messages', messageId), {
                                            originalNoteId: noteToEdit.id
                                        });
                                    } else {
                                        // Strategy C: Check by Timestamp (approximate match)
                                        if (noteToEdit.createdAt) {
                                            const noteTime = (noteToEdit.createdAt as Timestamp).toDate ? (noteToEdit.createdAt as Timestamp).toDate() : new Date((noteToEdit.createdAt as any).seconds * 1000);
                                            const startTime = new Date(noteTime.getTime() - 60000); // -1 minute
                                            const endTime = new Date(noteTime.getTime() + 60000); // +1 minute

                                            const qTime = query(messagesRef,
                                                where('senderId', '==', userData.uid),
                                                where('isNote', '==', true),
                                                where('createdAt', '>=', startTime),
                                                where('createdAt', '<=', endTime)
                                            );
                                            const snapTime = await getDocs(qTime);
                                            if (!snapTime.empty) {
                                                messageId = snapTime.docs[0].id;
                                                batch.update(doc(db, 'groups', groupId, 'messages', messageId), {
                                                    originalNoteId: noteToEdit.id
                                                });
                                            }
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error(`Error finding message in group ${groupId}:`, err);
                            }
                        }

                        if (messageId) {
                            try {
                                const msgRef = doc(db, 'groups', groupId, 'messages', messageId);
                                batch.update(msgRef, { text: messageText });
                                if (sharedMessageIds[groupId] !== messageId) {
                                    sharedMessageIds[groupId] = messageId;
                                    idsUpdated = true;
                                }
                            } catch (err) {
                                console.error(`Error adding update for message ${messageId} in group ${groupId} to batch:`, err);
                            }
                        }
                    }

                    // Save the discovered IDs back to the note so we don't have to search next time
                    if (idsUpdated) {
                        batch.update(noteRef, { sharedMessageIds });
                    }
                }
                await batch.commit();
                toast.success(t('newNote.successUpdate'));
            } else {
                // Creating a new note via Backend (Cloud Function style)
                const user = auth?.currentUser;
                if (!auth || !user) throw new Error("No user logged in");

                const idToken = await user.getIdToken(true);
                const response = await axios.post(`${API_BASE}/api/post-note`, {
                    chapter,
                    scripture,
                    title: gcMeta?.title || null,
                    speaker: gcMeta?.speaker || null,
                    comment,
                    shareOption,
                    selectedShareGroups,
                    isGroupContext,
                    currentGroupId,
                    language
                }, {
                    headers: {
                        Authorization: `Bearer ${idToken}`
                    }
                });

                const { streakUpdated } = response.data;
                toast.success(t('newNote.successPost'));

                // Handle Level Up Celebration (Simplified, using stats from when the modal opened + sync with what backend might have changed)
                // Note: ideally we'd get daysStudiedCount back too, but we can approximate or just rely on streakUpdated
                const currentDays = userData.daysStudiedCount || 0;
                const willLevelUp = streakUpdated && (currentDays + 1) % 7 === 0;

                if (willLevelUp) {
                    const newLevel = Math.floor((currentDays + 1) / 7) + 1;
                    toast.success(t('newNote.levelUp', { level: newLevel }) || `🎊 Congratulations! You reached Level ${newLevel}! 🎊`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                    });

                    // Level up confetti
                    const duration = 5 * 1000;
                    const animationEnd = Date.now() + duration;
                    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
                    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

                    const interval = setInterval(function () {
                        const timeLeft = animationEnd - Date.now();
                        if (timeLeft <= 0) return clearInterval(interval);
                        const particleCount = 50 * (timeLeft / duration);
                        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
                    }, 250);
                } else {
                    // Normal note confetti
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                }
            }

            setLoading(false);
            onClose();
            setChapter('');
            setScripture('');
            setComment('');

        } catch (e: any) {
            console.error("Error saving note:", e);
            if (e.response && e.response.data) {
                console.error("Server Error Details:", e.response.data);
                if (e.response.data.error) {
                    setError(`Server error: ${e.response.data.error}`);
                }
            }
            if (e.code === 'resource-exhausted' || (e.message && e.message.toLowerCase().includes('quota exceeded'))) {
                setError(t('systemErrors.quotaExceededMessage'));
            } else if (!error) {
                Sentry.captureException(e);
                setError(t('newNote.errorSave'));
            }
            setLoading(false);
        }
    };

    if (showRandomMenu) {
        return (
            <div className="ModalOverlay" onClick={onClose}>
                <div className="ModalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'center' }}>
                    <div className="modal-header" style={{ justifyContent: 'center' }}>
                        <h1>{t('newNote.surpriseMe')}</h1>
                    </div>
                    <p style={{ marginBottom: '1.5rem', color: '#666' }}>{t('newNote.chooseScripturePlaceholder')}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', padding: '0.5rem' }}>
                        <button
                            onClick={handleTodaysReading}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>📅</span>
                            {t('dashboard.todaysComeFollowMe')}
                        </button>

                        <button
                            onClick={handlePickRandomMastery}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>🎓</span>
                            {t('newNote.masteryScriptures')}
                        </button>

                        <button
                            onClick={handlePickRandomPeace}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>🕊️</span>
                            {t('newNote.peaceScriptures')}
                        </button>

                        <button
                            onClick={handlePickRandomAdversity}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>⛓️</span>
                            {t('newNote.adversityScriptures')}
                        </button>

                        <button
                            onClick={handlePickRandomRelationship}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>🤝</span>
                            {t('newNote.relationshipScriptures')}
                        </button>
                        <button
                            onClick={handlePickRandomJoy}
                            style={{
                                padding: '1.2rem',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                background: 'white',
                                cursor: 'pointer',
                                fontSize: '1.1rem',
                                fontWeight: '600',
                                color: '#2d3748',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(102, 126, 234, 0.15)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem' }}>😊</span>
                            {t('newNote.joyScriptures')}
                        </button>
                    </div>
                    <button
                        onClick={() => setShowRandomMenu(false)}
                        className="cancel-btn"
                        style={{ marginTop: '2rem', alignSelf: 'center', width: 'auto', background: '#e2e8f0', color: '#4a5568' }}
                    >
                        {t('newNote.cancel')}
                    </button>
                </div>
            </div>
        );
    }

    if (showScriptureSelectionModal) {
        return (
            <div className="ModalOverlay" onClick={onClose}>
                <div className="ModalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'center' }}>
                    <div className="modal-header" style={{ justifyContent: 'center' }}>
                        <h1>{t('dashboard.todaysComeFollowMe')}</h1>
                    </div>
                    <p style={{ marginBottom: '1rem', color: '#666' }}>{t('newNote.chooseScripturePlaceholder')}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%', overflowY: 'auto', padding: '0.5rem' }}>
                        {availableReadingPlanScripts.map((script, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    fillScriptureData(script);
                                    setShowScriptureSelectionModal(false);
                                }}
                                style={{
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    background: 'white',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: '500',
                                    color: '#2d3748',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                    transition: 'all 0.2s',
                                    textAlign: 'left'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = '#b794f4'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                            >
                                📖 {translateChapterField(script, language)}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowScriptureSelectionModal(false)}
                        className="cancel-btn"
                        style={{ marginTop: '1.5rem', alignSelf: 'center', width: 'auto', background: '#e2e8f0', color: '#4a5568' }}
                    >
                        {t('newNote.cancel')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {showCloseConfirm && (
                <div className="ModalOverlay" style={{ zIndex: 1100, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowCloseConfirm(false)}>
                    <div className="ModalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', height: 'auto', padding: '2rem' }}>
                        <div className="modal-header" style={{ justifyContent: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0, textAlign: 'center' }}>
                                {t('newNote.confirmCloseTitle')}
                            </h2>
                        </div>
                        <p style={{ textAlign: 'center', marginBottom: '2rem', color: '#666' }}>
                            {t('newNote.confirmCloseMessage')}
                        </p>
                        <div className="modal-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
                            <button
                                onClick={() => setShowCloseConfirm(false)}
                                className="cancel-btn"
                                style={{ background: '#e2e8f0', color: '#4a5568' }}
                            >
                                {t('newNote.confirmCloseKeepEditing')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCloseConfirm(false);
                                    onClose();
                                }}
                                className="cancel-btn"
                                style={{ background: '#fed7d7', color: '#c53030' }}
                            >
                                {t('newNote.confirmCloseDiscard')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCloseConfirm(false);
                                    handleSubmit();
                                }}
                                className="submit-btn"
                            >
                                {t('newNote.confirmCloseSave')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="ModalOverlay" onClick={handleClose}>
                <div className="ModalContent" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h1>{noteToEdit ? t('newNote.editTitle') : t('newNote.newTitle')}</h1>
                        {noteToEdit && (
                            <button
                                className="delete-btn"
                                onClick={onDelete}
                                title={t('newNote.deleteTitle')}
                            >
                                <UilTrashAlt size="24" />
                            </button>
                        )}
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label htmlFor="scripture-select" className="modal-label" style={{ marginBottom: 0 }}>{t('newNote.chooseScriptureLabel')}</label>
                        </div>
                        <Select<ScriptureOption>
                            id="scripture-select"
                            options={translatedScripturesOptions}
                            onChange={(option) => {
                                setSelectedOption(option);
                                setScripture(option?.value || '');
                            }}
                            value={selectedOption}
                            placeholder={t('newNote.chooseScripturePlaceholder')}
                            styles={{
                                control: (base) => ({
                                    ...base,
                                    backgroundColor: '#ffffff',
                                    borderColor: 'rgba(0, 0, 0, 0.05)',
                                    borderWidth: '2px',
                                    borderRadius: '0.5rem',
                                    padding: '0.2rem',
                                    color: '#333',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                                }),
                                placeholder: (base) => ({
                                    ...base,
                                    color: '#999',
                                }),
                                singleValue: (base) => ({
                                    ...base,
                                    color: '#333',
                                }),
                                input: (base) => ({
                                    ...base,
                                    color: '#333',
                                }),
                                menu: (base) => ({
                                    ...base,
                                    zIndex: 100,
                                    backgroundColor: '#ffffff',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                    borderRadius: '0.5rem',
                                }),
                                option: (base, { isFocused, isSelected }) => ({
                                    ...base,
                                    backgroundColor: isSelected ? 'var(--pink)' : isFocused ? 'rgba(255, 145, 157, 0.1)' : 'transparent',
                                    color: isSelected ? 'white' : '#333',
                                    cursor: 'pointer',
                                    '&:active': {
                                        backgroundColor: 'var(--pink)',
                                        color: 'white',
                                    },
                                })
                            }}
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}
                    <div className="suggestions-container">
                        <Input
                            label={scripture === "General Conference" ? t('newNote.urlLabel') : (scripture === "BYU Speeches" ? t('newNote.byuUrlLabel') : (scripture === "Other" ? t('newNote.otherUrlLabel') : t('newNote.chapterLabel')))}
                            type="text"
                            value={chapter}
                            onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                                const val = e.target.value;
                                setChapter(val);

                                if (val.length > 0 && scripture && scripture !== 'Other' && scripture !== 'General Conference' && scripture !== 'BYU Speeches') {
                                    const matched = getBookSuggestions(scripture, val, language, bookNameTranslations);
                                    setSuggestions(matched);
                                    setShowSuggestions(matched.length > 0);
                                } else {
                                    setSuggestions([]);
                                    setShowSuggestions(false);
                                }
                            }}
                            onBlur={() => {
                                // Delay hiding to allow click event to fire
                                setTimeout(() => setShowSuggestions(false), 200);
                            }}
                            required
                            placeholder={scripture === "General Conference" ? t('newNote.urlPlaceholder') : (scripture === "BYU Speeches" ? t('newNote.byuUrlPlaceholder') : (scripture === "Other" ? t('newNote.otherUrlPlaceholder') : currentChapterPlaceholder))}
                        />
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="suggestions-list">
                                {suggestions.map((book, idx) => (
                                    <div
                                        key={idx}
                                        className="suggestion-item"
                                        onClick={() => {
                                            setChapter(book.translated + ' ');
                                            setSuggestions([]);
                                            setShowSuggestions(false);
                                        }}
                                    >
                                        <span className="suggestion-translated">{book.translated}</span>
                                        {language !== 'en' && <span className="suggestion-english">{book.english}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {!noteToEdit && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={handleSurpriseMe}
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '20px',
                                    padding: '0.3rem 0.8rem',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    fontWeight: 'bold',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                                }}
                            >
                                <UilShuffle size="16" /> {t('newNote.surpriseMe')}
                            </button>
                        </div>
                    )}

                    {isUrl && (gcLoading || gcMeta) && (
                        <div style={{
                            marginTop: '0.2rem',
                            marginBottom: '1rem',
                            padding: '0.5rem 0.8rem',
                            backgroundColor: '#f7fafc',
                            borderRadius: '8px',
                            border: '1px solid #edf2f7',
                            fontSize: '0.85rem'
                        }}>
                            {gcLoading ? (
                                <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>Fetching title...</span>
                            ) : gcMeta && (
                                <div style={{ color: '#4a5568', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: 'bold', minWidth: 'fit-content' }}>{t('newNote.titleLabel')}</span>
                                        <span style={{ color: '#2d3748' }}>{gcMeta.title}</span>
                                    </div>
                                    {gcMeta.speaker && (
                                        <div style={{ fontSize: '0.8rem', opacity: 0.8, paddingLeft: 'calc(1.5rem + 0.5rem)' }}>
                                            {gcMeta.speaker}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {scripture && chapter && (['Old Testament', 'New Testament', 'Book of Mormon', 'Doctrine and Covenants', 'Pearl of Great Price', 'Ordinances and Proclamations'].includes(scripture) || (typeof chapter === 'string' && chapter.startsWith('http'))) && (
                        <div className="gospel-link-container">
                            <a
                                href={((typeof chapter === 'string' && chapter.startsWith('http') ? localizeLdsUrl(chapter, language) : getGospelLibraryUrl(scripture, chapter, language)) || "#") as string}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="gospel-library-link"
                            >
                                {scripture === 'BYU Speeches' ? t('myNotes.goToByuSpeech') : t('myNotes.readInGospelLibrary')} <i className="uil uil-external-link-alt" style={{ fontSize: '0.85em' }}></i>
                            </a>
                        </div>
                    )}

                    {/* AI Button - simple styling inline for now */}
                    {!noteToEdit && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={handleGenerateQuestions}
                                disabled={aiLoading || !scripture || !chapter}
                                style={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '20px',
                                    padding: '0.3rem 0.8rem',
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    opacity: (aiLoading || !scripture || !chapter) ? 0.7 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                                }}
                            >
                                {aiLoading ? 'Thinking...' : t('newNote.askAiQuestion')}
                            </button>
                        </div>
                    )}

                    {aiQuestion && (
                        <div style={{
                            backgroundColor: '#f0f4ff',
                            padding: '10px',
                            borderRadius: '8px',
                            marginBottom: '1rem',
                            border: '1px solid #dbe4ff',
                            position: 'relative'
                        }}>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#4a5568', whiteSpace: 'pre-wrap' }}>
                                <strong>{t('newNote.aiQuestion')}</strong><br />
                                {aiQuestion}
                            </p>
                            <button
                                onClick={() => setAiQuestion('')}
                                style={{
                                    position: 'absolute',
                                    top: '5px',
                                    right: '5px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#a0aec0',
                                    fontSize: '1rem',
                                    padding: '0 5px'
                                }}
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <Input
                        label={t('newNote.commentLabel')}
                        as="textarea"
                        value={comment}
                        onChange={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setComment(e.target.value)}
                        required
                        placeholder={currentCommentPlaceholder}
                    />

                    {!noteToEdit && (
                        <div className="sharing-options">
                            <label className="sharing-label">{t('newNote.shareLabel')}</label>

                            <div className="radio-group">
                                <label className={`radio-option ${userGroups.length === 0 ? 'disabled' : ''}`}>
                                    <input
                                        type="radio"
                                        value="all"
                                        checked={shareOption === 'all'}
                                        onChange={(e) => setShareOption(e.target.value)}
                                        disabled={userGroups.length === 0}
                                    />
                                    <span>{t('newNote.shareAll')}</span>
                                </label>

                                {isGroupContext && (currentGroupId || userData.groupId) && (
                                    <label className="radio-option">
                                        <input
                                            type="radio"
                                            value="current"
                                            checked={shareOption === 'current'}
                                            onChange={(e) => setShareOption(e.target.value)}
                                        />
                                        <span>{t('newNote.shareCurrent')}</span>
                                    </label>
                                )}

                                <label className={`radio-option ${userGroups.length === 0 ? 'disabled' : ''}`}>
                                    <input
                                        type="radio"
                                        value="specific"
                                        checked={shareOption === 'specific'}
                                        onChange={(e) => setShareOption(e.target.value)}
                                        disabled={userGroups.length === 0}
                                    />
                                    <span>{t('newNote.shareSpecific')}</span>
                                </label>

                                <label className="radio-option">
                                    <input
                                        type="radio"
                                        value="none"
                                        checked={shareOption === 'none'}
                                        onChange={(e) => setShareOption(e.target.value)}
                                    />
                                    <span>{t('newNote.shareNone')}</span>
                                </label>
                            </div>

                            {shareOption === 'specific' && (
                                <div className="group-selection-list">
                                    {userGroups.length === 0 && (
                                        <p style={{ color: 'var(--black)', fontStyle: 'italic', padding: '0.5rem' }}>
                                            {t('newNote.noGroups')}
                                        </p>
                                    )}
                                    {userGroups.map(group => (
                                        <label key={group.id} className="group-checkbox-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedShareGroups.includes(group.id)}
                                                onChange={() => handleGroupSelection(group.id)}
                                            />
                                            <span>{group.name || t('newNote.unnamedGroup')}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="modal-actions">
                        <button onClick={handleClose} className="cancel-btn">{t('newNote.cancel')}</button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !scripture || !chapter || !comment}
                            className="submit-btn"
                        >
                            {loading ? t('newNote.saving') : (noteToEdit ? <>✨ {t('newNote.update')}</> : <>✨ {t('newNote.post')}</>)}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default NewNote;
