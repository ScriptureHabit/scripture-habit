import { FC, RefObject, KeyboardEvent, FormEvent, useEffect } from 'react';
import { UilPlus, UilTimes } from '@iconscout/react-unicons';
import { Message } from '../../../types/chat';

import './message-input.css';

interface MessageInputProps {
    handleSendMessage: (e: FormEvent) => void;
    isAnyModalOpen: boolean;
    replyTo: Message | null;
    setReplyTo: (msg: Message | null) => void;
    t: (key: string) => string;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    newMessage: string;
    setNewMessage: (msg: string) => void;
    handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
    onInputFocusChange?: (focused: boolean) => void;
    containerRef: RefObject<HTMLElement | null>;
    inputPlaceholder: string;
    showAddNoteTooltip: boolean;
    handleDismissTooltip: () => void;
    setIsNewNoteOpen: (open: boolean) => void;
}

const MessageInput: FC<MessageInputProps> = ({
    handleSendMessage,
    isAnyModalOpen,
    replyTo,
    setReplyTo,
    t,
    textareaRef,
    newMessage,
    setNewMessage,
    handleKeyDown,
    onInputFocusChange,
    containerRef,
    inputPlaceholder,
    showAddNoteTooltip,
    handleDismissTooltip,
    setIsNewNoteOpen
}) => {
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            // If message is empty, use a base height to avoid placeholder wrapping affecting height
            const scrollHeight = newMessage ? textarea.scrollHeight : 0;
            const newHeight = newMessage ? Math.min(scrollHeight, 250) : 40; 
            textarea.style.height = `${newHeight}px`;
        }

    }, [newMessage, textareaRef, inputPlaceholder]);

    return (
        <form
            onSubmit={handleSendMessage}
            className="send-message-form"
            style={window.innerWidth <= 768 && isAnyModalOpen ? { display: 'none' } : {}}
        >
            {replyTo && (
                <div className="reply-preview">
                    <div className="reply-info">
                        <span className="replying-to">{t('groupChat.replyingTo')} <strong>{replyTo.senderNickname}</strong></span>
                        <p className="reply-text-preview">
                            {replyTo.isNote || replyTo.isEntry
                                ? t('groupChat.studyNote')
                                : (replyTo.text ? (replyTo.text.substring(0, 50) + (replyTo.text.length > 50 ? '...' : '')) : 'Image/Note')
                            }
                        </p>
                    </div>
                    <div className="cancel-reply" onClick={() => setReplyTo(null)}>
                        <UilTimes size="16" />
                    </div>
                </div>
            )}
            <div className="input-wrapper">
                <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (onInputFocusChange) onInputFocusChange(true);
                        // Scroll to bottom when keyboard appears on mobile
                        if (containerRef.current && window.innerWidth <= 768) {
                            const container = containerRef.current;
                            setTimeout(() => {
                                container.scrollTop = container.scrollHeight;
                            }, 300);
                        }
                    }}
                    onBlur={() => onInputFocusChange && onInputFocusChange(false)}
                    placeholder={inputPlaceholder}
                    rows={1}
                    maxLength={2000}
                />
                <div className="add-entry-btn-wrapper">
                    {showAddNoteTooltip && (
                        <div className="add-note-tooltip" onClick={(e) => { e.stopPropagation(); handleDismissTooltip(); }}>
                            <div className="tooltip-content">
                                {t('groupChat.addNoteTooltip')}
                            </div>
                            <div className="tooltip-arrow"></div>
                        </div>
                    )}
                    <div className="add-entry-btn" onClick={() => { setIsNewNoteOpen(true); handleDismissTooltip(); }} data-testid="new-note-button">
                        <UilPlus />
                    </div>
                </div>
                <button type="submit">{t('groupChat.send')}</button>
                {newMessage.length > 1800 && (
                    <div className="char-counter" style={{
                        position: 'absolute',
                        bottom: '-20px',
                        right: '10px',
                        fontSize: '10px',
                        color: newMessage.length >= 2000 ? '#ff4d4d' : '#888',
                        pointerEvents: 'none'
                    }}>
                        {newMessage.length}/2000
                    </div>
                )}
            </div>
        </form>
    );
};

export default MessageInput;
