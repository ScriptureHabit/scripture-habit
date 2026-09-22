
import { useState, useEffect, useRef, useMemo } from 'react';
import { UilTimes, UilPen, UilTrashAlt, UilComment, UilThumbsUp } from '@iconscout/react-unicons';
import { db } from '../../firebase';
import { doc, collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import NoteDisplay from '../notedisplay/note-display';
import { useLanguage } from '../../hooks/use-language';
import { useModalA11y } from '../../hooks/use-modal-a11y';
import './note-detail-modal.css';
import { Note } from '../../types/note';
import { Group, Message, FirebaseTimestamp } from '../../types/chat';
import { UserData } from '../../types/user';
import { parseTimestampToDate } from '../../utils/time-utils';

interface NoteDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    note: Note | null;
    userGroups: Group[];
    userData: UserData;
    onEdit: (note: Note) => void;
    onDelete: (note: Note) => void;
}

interface SharedDetail {
    groupId: string;
    messageId: string;
    groupName: string;
    isMember: boolean;
}

const NoteDetailModal = (props: NoteDetailModalProps) => {
    const { isOpen, onClose, note, userGroups, onEdit, onDelete } = props;
    const { t, language } = useLanguage();
    const modalRef = useRef<HTMLDivElement>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    useModalA11y({
        isOpen: Boolean(isOpen && note),
        onClose,
        containerRef: modalRef,
        initialFocusRef: closeBtnRef
    });

    const sharedDetails: SharedDetail[] = useMemo(() => {
        if (!isOpen || !note || !note.sharedMessageIds || Object.keys(note.sharedMessageIds).length === 0) {
            return [];
        }

        return Object.entries(note.sharedMessageIds).map(([groupId, messageId]) => {
            let groupName = t('newNote.unnamedGroup');
            let isMember = false;

            if (userGroups) {
                const group = userGroups.find(g => g.id === groupId);
                if (group) {
                    groupName = group.name || '';
                    isMember = true;
                }
            }

            return { groupId, messageId, groupName, isMember };
        });
    }, [isOpen, note, userGroups, t]);

    if (!isOpen || !note) return null;

    const handleEdit = () => {
        onEdit(note);
    };

    const handleDelete = () => {
        onDelete(note);
    };

    return (
        <div className="ModalOverlay detail-modal-overlay" onClick={onClose}>
            <div 
                ref={modalRef}
                className="ModalContent NoteDetailModal" 
                role="dialog"
                aria-modal="true"
                aria-labelledby="note-detail-date"
                onClick={(e) => e.stopPropagation()}
            >
                <button 
                    ref={closeBtnRef}
                    className="close-btn" 
                    onClick={onClose} 
                    title={t('common.close') || 'Close'}
                    aria-label={t('common.close') || 'Close'}
                >
                    <UilTimes size="24" />
                </button>

                <div className="note-detail-content">
                    <div className="detail-header">
                        <span id="note-detail-date" className="note-date">
                            {note.createdAt 
                                ? parseTimestampToDate(note.createdAt as FirebaseTimestamp).toLocaleDateString(language === 'en' ? 'sv-SE' : language) 
                                : 'Unknown Date'}
                        </span>
                        <div className="detail-actions">
                            <button 
                                className="action-btn edit" 
                                onClick={handleEdit}
                                title={t('groupChat.editMessage') || 'Edit'}
                                aria-label={t('groupChat.editMessage') || 'Edit'}
                                data-testid="edit-note-btn"
                            >
                                <UilPen size="18" />
                            </button>
                            <button 
                                className="action-btn delete" 
                                onClick={handleDelete}
                                title={t('groupChat.deleteMessage') || 'Delete'}
                                aria-label={t('groupChat.deleteMessage') || 'Delete'}
                                data-testid="delete-note-btn"
                            >
                                <UilTrashAlt size="18" />
                            </button>
                        </div>
                    </div>

                    <div className="note-body">
                        <NoteDisplay text={note.text || ''} isSent={false} linkColor="inherit" scripture={note.scripture} chapter={note.chapter} />
                    </div>

                    <div className="shared-activity-section">
                        <h4>{t('myNotes.sharedActivity')}</h4>

                        {sharedDetails.length === 0 ? (
                            <p className="no-shares">{t('newNote.shareNone') || 'Not shared (Private)'}</p>
                        ) : (
                            sharedDetails.map(detail => (
                                <SharedGroupSection
                                    key={detail.groupId}
                                    groupId={detail.groupId}
                                    messageId={detail.messageId}
                                    groupName={detail.groupName}
                                    isMember={detail.isMember}
                                    t={t}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


interface SharedGroupSectionProps {
    groupId: string;
    messageId: string;
    groupName: string;
    t: (key: string) => string;
    isMember: boolean;
}

const SharedGroupSection = ({ groupId, messageId, groupName, t, isMember }: SharedGroupSectionProps) => {
    const [reactions, setReactions] = useState<Record<string, string[]>>({});
    const [replies, setReplies] = useState<Message[]>([]);
    const [error, setError] = useState<boolean | null>(null);

    useEffect(() => {
        if (!isMember) {
            return;
        }


        // 1. Listen to the message for reactions
        const messageRef = doc(db, 'groups', groupId, 'messages', messageId);
        const unsubMsg = onSnapshot(messageRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setReactions(data.reactions || {});
            }
        }, (err: unknown) => {
            const error = err as Error & { code?: string }; 
            console.warn("Could not fetch message details (likely permission):", error);
            // If permission denied, likely user is not in group anymore
            if (error.code === 'permission-denied') {
                setError(true);
            }
        });

        // 2. Listen for replies - REMOVE orderBy to avoid index requirement for now
        const messagesRef = collection(db, 'groups', groupId, 'messages');
        const q = query(messagesRef, where('replyTo.id', '==', messageId));

        const unsubReplies = onSnapshot(q, (snapshot) => {
            const fetchedReplies: Message[] = [];
            snapshot.forEach(docSnap => {
                fetchedReplies.push({ id: docSnap.id, ...docSnap.data() } as Message);
            });
            // Client-side sort
            fetchedReplies.sort((a, b) => {
                const tA = (a.createdAt as Timestamp)?.toDate ? (a.createdAt as Timestamp).toDate().getTime() : 0;
                const tB = (b.createdAt as Timestamp)?.toDate ? (b.createdAt as Timestamp).toDate().getTime() : 0;
                return tA - tB;
            });

            setReplies(fetchedReplies);
        }, (error: unknown) => {
            const err = error as Error & { code?: string };
            console.log("Error fetching replies:", err);
            if (err.code === 'permission-denied') {
                setError(true);
            }
        });

        return () => {
            unsubMsg();
            unsubReplies();
        };
    }, [groupId, messageId, isMember]);

    if (!isMember) {
        return (
            <div className="shared-group-item disabled">
                <h5 className="group-name-header">{groupName}</h5>
                <p className="status-label">
                    {t('myNotes.notMember')}
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="shared-group-item error">
                <h5 className="group-name-header">{groupName}</h5>
                <p className="status-label">
                    {t('groupCard.unableToJoin') || "Unavailable (Permission Denied)"}
                </p>
            </div>
        );
    }

    return (
        <div className="shared-group-item">
            <h5 className="group-name-header">{groupName}</h5>

            <div className="activity-stats">
                <div className="reaction-count">
                    <UilThumbsUp size="16" className="icon" />
                    <span>{Object.values(reactions).flat().length}</span>
                    {Object.values(reactions).flat().length > 0 && (
                        <div className="reaction-avatars">
                            {/* Simple text for now, or sliced list */}
                            {/* reactions.map(...) */}
                        </div>
                    )}
                </div>
                <div className="reply-count-label">
                    <UilComment size="16" className="icon" />
                    <span>{replies.length} {t('groupChat.reply') || 'Replies'}</span>
                </div>
            </div>

            {replies.length > 0 && (
                <div className="replies-list">
                    {replies.map(reply => (
                        <div key={reply.id} className="reply-item">
                            <span className="reply-sender">{reply.senderNickname}:</span>
                            <span className="reply-text">{reply.text}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NoteDetailModal;


