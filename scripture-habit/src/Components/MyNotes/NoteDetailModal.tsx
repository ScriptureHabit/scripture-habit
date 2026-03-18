import { useState, useEffect, FC } from 'react';
import { UilTimes, UilPen, UilTrashAlt, UilComment, UilThumbsUp } from '@iconscout/react-unicons';
import { db } from '../../firebase';
import { doc, collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import NoteDisplay from '../NoteDisplay/NoteDisplay';
import { useLanguage } from '../../Context/LanguageContext';
import './NoteDetailModal.css';
import { Note } from '../../types/note';
import { Group } from '../../types/chat';
import { UserData } from '../../types/user';

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

const NoteDetailModal: FC<NoteDetailModalProps> = ({ isOpen, onClose, note, userGroups, onEdit, onDelete }) => {
    const { t, language } = useLanguage();
    const [sharedDetails, setSharedDetails] = useState<SharedDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        if (!isOpen || !note) {
            setSharedDetails([]);
            return;
        }

        const fetchSharedDetails = async () => {
            if (!note.sharedMessageIds || Object.keys(note.sharedMessageIds).length === 0) {
                setSharedDetails([]);
                return;
            }

            setLoadingDetails(true);
            const details: SharedDetail[] = [];

            // Iterate through each group where the note is shared
            for (const [groupId, messageId] of Object.entries(note.sharedMessageIds)) {
                // 1. Get Group Name and Membership Status
                let groupName = t('newNote.unnamedGroup');
                let isMember = false;

                if (userGroups) {
                    const group = userGroups.find(g => g.id === groupId);
                    if (group) {
                        groupName = group.name;
                        isMember = true;
                    }
                }

                // If not found in userGroups, we assume user is NOT a member and cannot fetch details.
                // We will still display the group "slot" but marked as unavailable.

                details.push({ groupId, messageId, groupName, isMember });
            }
            setSharedDetails(details);
            setLoadingDetails(false);
        };

        fetchSharedDetails();
    }, [isOpen, note, userGroups, t]);

    if (!isOpen || !note) return null;

    const handleEdit = () => {
        onEdit(note);
    };

    const handleDelete = () => {
        onDelete(note);
    };

    return (
        <div className="ModalOverlay" onClick={onClose} style={{ zIndex: 1050 }}>
            <div className="ModalContent NoteDetailModal" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>
                    <UilTimes size="24" />
                </button>

                <div className="note-detail-content">
                    <div className="detail-header">
                        <span className="note-date">
                            {note.createdAt?.toDate().toLocaleDateString(language === 'en' ? 'sv-SE' : language) || 'Unknown Date'}
                        </span>
                        <div className="detail-actions">
                            <button className="action-btn edit" onClick={handleEdit}>
                                <UilPen size="18" /> {t('groupChat.editMessage') || 'Edit'}
                            </button>
                            <button className="action-btn delete" onClick={handleDelete}>
                                <UilTrashAlt size="18" /> {t('groupChat.deleteMessage') || 'Delete'}
                            </button>
                        </div>
                    </div>

                    <div className="note-body">
                        <NoteDisplay text={note.text || ''} isSent={false} linkColor="#1E88E5" />
                        {/* Show Scripture Reference/Link if acceptable, maybe modify NoteDisplay or add here */}
                        <div className="note-scripture-ref">
                            {note.scripture !== 'Other' && (
                                <span className="scripture-tag">{t(`scriptures.${getScriptureKey(note.scripture || '')}`) || note.scripture} {note.chapter}</span>
                            )}
                            {note.scripture === 'Other' && note.chapter && (
                                <span className="scripture-tag">{note.chapter}</span>
                            )}
                        </div>
                    </div>

                    <div className="shared-activity-section">
                        <h4>{t('myNotes.sharedActivity') || (language === 'ja' ? '共有されたグループのアクティビティ' : 'Shared Activity')}</h4>

                        {loadingDetails ? (
                            <div className="loading-spinner">{t('myNotes.loading') || 'Loading...'}</div>
                        ) : sharedDetails.length === 0 ? (
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
                                    language={language}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const getScriptureKey = (scriptureName: string) => {
    const map: Record<string, string> = {
        'Old Testament': 'oldTestament',
        'New Testament': 'newTestament',
        'Book of Mormon': 'bookOfMormon',
        'Doctrine and Covenants': 'doctrineAndCovenants',
        'Pearl of Great Price': 'pearlOfGreatPrice',
        'General Conference': 'generalConference',
        'BYU Speeches': 'byuSpeeches',
        'Other': 'other'
    };
    return map[scriptureName] || 'other';
};

interface SharedGroupSectionProps {
    groupId: string;
    messageId: string;
    groupName: string;
    t: (key: string) => string;
    isMember: boolean;
    language: string;
}

const SharedGroupSection: FC<SharedGroupSectionProps> = ({ groupId, messageId, groupName, t, isMember, language }) => {
    const [reactions, setReactions] = useState<any[]>([]);
    const [replies, setReplies] = useState<any[]>([]);
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
                setReactions(data.reactions || []);
            }
        }, (err: any) => {
            console.warn("Could not fetch message details (likely permission):", err);
            // If permission denied, likely user is not in group anymore
            if (err.code === 'permission-denied') {
                setError(true);
            }
        });

        // 2. Listen for replies - REMOVE orderBy to avoid index requirement for now
        const messagesRef = collection(db, 'groups', groupId, 'messages');
        const q = query(messagesRef, where('replyTo.id', '==', messageId));

        const unsubReplies = onSnapshot(q, (snapshot) => {
            const fetchedReplies: any[] = [];
            snapshot.forEach(docSnap => {
                fetchedReplies.push({ id: docSnap.id, ...docSnap.data() });
            });
            // Client-side sort
            fetchedReplies.sort((a, b) => {
                const tA = (a.createdAt as Timestamp)?.toDate ? (a.createdAt as Timestamp).toDate().getTime() : 0;
                const tB = (b.createdAt as Timestamp)?.toDate ? (b.createdAt as Timestamp).toDate().getTime() : 0;
                return tA - tB;
            });

            setReplies(fetchedReplies);
        }, (error: any) => {
            console.log("Error fetching replies:", error);
            if (error.code === 'permission-denied') {
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
            <div className="shared-group-item disabled" style={{ opacity: 0.6 }}>
                <h5 className="group-name-header">{groupName}</h5>
                <p style={{ fontSize: '0.8rem', color: '#999', margin: 0, fontStyle: 'italic' }}>
                    {t('groupCard.signInFirst') ? (language === 'ja' ? 'グループに参加していません' : 'You are not a member of this group') : 'Not a member'}
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="shared-group-item error">
                <h5 className="group-name-header">{groupName}</h5>
                <p style={{ fontSize: '0.8rem', color: '#999', margin: 0 }}>
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
                    <span>{reactions.length}</span>
                    {reactions.length > 0 && (
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
