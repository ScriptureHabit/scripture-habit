
import { useState, useEffect, FC, useMemo } from 'react';
import Select from 'react-select';
import { UilShuffle, UilRobot } from '@iconscout/react-unicons';
import { useLanguage } from '../../hooks/use-language';
import Input from '../input/input';
import './new-note.css';

// Hooks
import { useUrlMetaFetcher } from './hooks/use-url-meta-fetcher';
import { useAIGenerator } from './hooks/use-ai-generator';
import { useNoteSubmission } from './hooks/use-note-submission';
import { useRandomNote } from './hooks/use-random-note';

// Subcomponents
import RandomScriptureMenu from './subcomponents/random-scripture-menu';
import ScriptureSelectionModal from './subcomponents/scripture-selection-modal';
import CloseConfirmModal from './subcomponents/close-confirm-modal';
import NoteSharingOptions from './subcomponents/note-sharing-options';

import { getBookSuggestions } from '../../utils/suggestion-utils';
import { getGospelLibraryUrl, getCategoryFromScripture } from '../../utils/gospel-library-mapper';
import { removeNoteHeader } from '../../utils/note-utils';
import { UserData } from '../../types/user';
import { Group, Message } from '../../types/chat';
import { Note } from '../../types/note';

interface Suggestion {
    translated: string;
    english: string;
}

interface NewNoteProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserData;
    userGroups?: Group[];
    currentGroupId?: string | null;
    noteToEdit?: Message | Note | null;
}

const NewNote: FC<NewNoteProps> = ({
    isOpen, onClose, userData,
    userGroups = [], currentGroupId = null, noteToEdit = null
}) => {
    const { t, language, tArray, translateChapterField, bookTranslations } = useLanguage();
    
    // Form State
    const [scripture, setScripture] = useState<string>('');
    const [chapter, setChapter] = useState<string>('');
    const [comment, setComment] = useState<string>('');
    const [shareOption, setShareOption] = useState<string>('all');
    const [selectedShareGroups, setSelectedShareGroups] = useState<string[]>([]);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // Suggestions UI State
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Modular Hooks
    const { urlMeta, urlLoading } = useUrlMetaFetcher(chapter, scripture, language || 'en');
    const { aiQuestion, setAiQuestion, aiLoading, handleGenerateQuestions } = useAIGenerator(language);
    const { loading, handleSubmit } = useNoteSubmission(userData, language, t);
    const { 
        showRandomMenu, setShowRandomMenu, 
        showSelectionModal, setShowSelectionModal,
        availableReadingPlanScripts,
        handlePickRandomReadingPlan,
        handlePickRandomMastery, handlePickRandomPeace,
        handlePickRandomAdversity, handlePickRandomRelationship,
        handlePickRandomJoy 
    } = useRandomNote(language, translateChapterField, (s, c) => {
        setScripture(s);
        setChapter(c);
    });

    // Random Placeholders
    const commentPlaceholder = useMemo(() => {
        const placeholders = tArray('newNote.commentPlaceholder');
        return placeholders[Math.floor(Math.random() * placeholders.length)] || '';
    }, [tArray]);

    const chapterPlaceholder = useMemo(() => {
        const placeholders = tArray('newNote.chapterPlaceholder');
        return placeholders[Math.floor(Math.random() * placeholders.length)] || '';
    }, [tArray]);

    // Sync state for Edit Mode
    const onboardingGuideStepText = useMemo(() => {
        const step2Done = userData?.hasCompletedOnboarding || (userData?.totalNotes && userData.totalNotes > 0);
        if (step2Done || noteToEdit) return null;
        if (!scripture) {
            return t('onboardingGuide.newNoteStep1') || 'First, choose a category for the scriptures you are reading today!';
        }
        if (!chapter) {
            return t('onboardingGuide.newNoteStep2') || 'Perfect! Next, enter the chapter or URL you read (e.g. 1 Nephi 3:7).';
        }
        if (!comment.trim()) {
            return t('onboardingGuide.newNoteStep3') || 'Wonderful! Finally, write down your thoughts or impressions in the comment box!';
        }
        return t('onboardingGuide.newNoteStep4') || 'All ready! Click the [Post Note] button at the bottom right to share your first note! 🎉';
    }, [userData?.hasCompletedOnboarding, userData?.totalNotes, noteToEdit, scripture, chapter, comment, t]);

    // Computed Values
    const glUrl = useMemo(() => getGospelLibraryUrl(scripture, chapter, language), [scripture, chapter, language]);
    const isUrl = typeof chapter === 'string' && chapter.startsWith('http');


    // Sync state for Edit Mode
    useEffect(() => {
        if (noteToEdit) {
            setScripture(noteToEdit.scripture || '');
            setChapter(noteToEdit.chapter || '');
            setComment(noteToEdit.comment || (noteToEdit.text ? removeNoteHeader(noteToEdit.text) : ''));
        } else {
            setScripture('');
            setChapter('');
            setComment('');
            setShareOption('all');
        }
    }, [noteToEdit, isOpen]);

    if (!isOpen) return null;

    const getPlaceholder = () => {
        if (isUrl) return t('newNote.urlPlaceholder');
        if (scripture === "General Conference") return t('newNote.urlPlaceholder');
        if (scripture === "BYU Speeches") return t('newNote.byuUrlPlaceholder');
        if (scripture === "Other") return t('newNote.otherUrlPlaceholder');
        return chapterPlaceholder;
    };

    const handleClose = () => {
        if (chapter || comment) setShowCloseConfirm(true);
        else onClose();
    };

    const handleGroupSelection = (groupId: string) => {
        setSelectedShareGroups(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    const translatedScripturesOptions = [
        { value: 'Old Testament', label: t('scriptures.oldTestament') },
        { value: 'New Testament', label: t('scriptures.newTestament') },
        { value: 'Book of Mormon', label: t('scriptures.bookOfMormon') },
        { value: 'Doctrine and Covenants', label: t('scriptures.doctrineAndCovenants') },
        { value: 'Pearl of Great Price', label: t('scriptures.pearlOfGreatPrice') },
        { value: 'General Conference', label: t('scriptures.generalConference') },
        { value: 'BYU Speeches', label: t('scriptures.byuSpeeches') },
        { value: 'Ordinances and Proclamations', label: t('scriptures.ordinancesAndProclamations') },
        { value: 'Other', label: t('scriptures.other') },
    ];

    // Sub-modal views
    if (showRandomMenu) {
        return (
            <RandomScriptureMenu
                t={t}
                setShowRandomMenu={setShowRandomMenu}
                availableReadingPlanScripts={availableReadingPlanScripts}
                handlePickRandomReadingPlan={handlePickRandomReadingPlan}
                handlePickRandomMastery={handlePickRandomMastery}
                handlePickRandomPeace={handlePickRandomPeace}
                handlePickRandomAdversity={handlePickRandomAdversity}
                handlePickRandomRelationship={handlePickRandomRelationship}
                handlePickRandomJoy={handlePickRandomJoy}
            />
        );
    }

    if (showSelectionModal) {
        return (
            <ScriptureSelectionModal
                t={t}
                onClose={() => setShowSelectionModal(false)}
                availableReadingPlanScripts={availableReadingPlanScripts}
                fillScriptureData={(script) => {
                    const detectedCategory = getCategoryFromScripture(script);
                    setScripture(detectedCategory !== 'Other' ? detectedCategory : 'Book of Mormon');
                    setChapter(translateChapterField(script));
                }}
                setShowScriptureSelectionModal={setShowSelectionModal}
                translateChapterField={translateChapterField}
            />
        );
    }

    return (
        <>
            {showCloseConfirm && (
                <CloseConfirmModal
                    t={t}
                    onClose={onClose}
                    setShowCloseConfirm={setShowCloseConfirm}
                    handleSubmit={() => handleSubmit(noteToEdit, scripture, chapter, comment, shareOption, selectedShareGroups, currentGroupId, urlMeta, onClose)}
                />
            )}
            <div className="ModalOverlay" onClick={handleClose}>
                <div className="ModalContent" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h1>{noteToEdit ? t('newNote.editTitle') : t('newNote.newTitle')}</h1>
                    </div>

                    {onboardingGuideStepText && (
                        <div className="mascot-helper-card" data-testid="mascot-onboarding-helper">
                            <img src="/images/mascot.png" alt="Mascot" className="mascot-helper-icon" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                            <div className="mascot-helper-text-container">
                                <p className="mascot-helper-bubble">{onboardingGuideStepText}</p>
                            </div>
                        </div>
                    )}

                    <div className="form-group" data-testid="new-note-category">
                        <label className="input-label">{t('newNote.chooseScriptureLabel')}</label>
                        <Select
                            value={translatedScripturesOptions.find(o => o.value === scripture) || null}
                            onChange={(option) => setScripture(option?.value || '')}
                            options={translatedScripturesOptions}
                            placeholder={t('newNote.chooseScripturePlaceholder')}
                            classNamePrefix="react-select"
                            styles={{
                                control: (base) => ({
                                    ...base,
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    padding: '2px',
                                    boxShadow: 'none',
                                    '&:hover': { borderColor: 'var(--pink)' }
                                }),
                                option: (base, { isFocused, isSelected }) => ({
                                    ...base,
                                    backgroundColor: isSelected ? 'var(--pink)' : isFocused ? 'rgba(255, 145, 157, 0.1)' : 'transparent',
                                    color: isSelected ? 'white' : '#333',
                                    cursor: 'pointer'
                                })
                            }}
                        />
                    </div>

                    <div className="suggestions-container">
                        <Input
                            label={['General Conference', 'BYU Speeches', 'Other'].includes(scripture) ? t('newNote.urlLabel') : t('newNote.chapterLabel')}
                            type="text"
                            value={chapter}
                            data-testid="new-note-chapter"
                            onChange={(e) => {
                                const val = e.target.value;
                                setChapter(val);
                                if (val.length > 0 && !['Other', 'General Conference', 'BYU Speeches'].includes(scripture)) {
                                    const matched = getBookSuggestions(scripture, val, language, bookTranslations);
                                    setSuggestions(matched);
                                    setShowSuggestions(matched.length > 0);
                                } else {
                                    setSuggestions([]);
                                    setShowSuggestions(false);
                                }
                            }}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            required
                            placeholder={getPlaceholder()}
                        />
                        {['General Conference', 'BYU Speeches'].includes(scripture) && chapter && !isUrl && (
                            <div className="url-warning-hint">
                                ⚠️ {scripture === "General Conference" ? t('newNote.urlRequiredForGC') : t('newNote.urlRequiredForBYU')}
                            </div>
                        )}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="suggestions-list">
                                {suggestions.map((book, idx) => (
                                    <div key={idx} className="suggestion-item" onClick={() => {
                                        setChapter(book.translated + ' ');
                                        setSuggestions([]);
                                        setShowSuggestions(false);
                                    }}>
                                        <span className="suggestion-translated">{book.translated}</span>
                                        {language !== 'en' && <span className="suggestion-english">{book.english}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {!noteToEdit && (
                        <div className="action-buttons-stack">
                            <div className="action-btn-wrapper">
                                <button type="button" onClick={() => setShowRandomMenu(true)} className="modern-action-btn">
                                    <UilShuffle size="16" />
                                    <span>{t('newNote.surpriseMe')}</span>
                                </button>
                            </div>
                            <div className="action-btn-wrapper">
                                <button type="button" onClick={() => handleGenerateQuestions(scripture, chapter)} disabled={aiLoading || !chapter} className="modern-action-btn">
                                    <UilRobot size="16" />
                                    <span>{aiLoading ? '...' : t('newNote.askAiQuestion')}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {glUrl && (
                        <div className="gl-link-preview">
                            <a href={glUrl} target="_blank" rel="noopener noreferrer" className="gl-preview-link">
                                {t('dashboard.readInGospelLibrary')}
                            </a>
                        </div>
                    )}

                    {isUrl && (urlLoading || urlMeta) && (
                        <div className="url-meta-box">
                            {urlLoading ? <span>Fetching title...</span> : urlMeta && (
                                <div>
                                    <strong>{urlMeta.title}</strong>
                                    {urlMeta.speaker && <div className="url-meta-speaker">{urlMeta.speaker}</div>}
                                </div>
                            )}
                        </div>
                    )}

                    {aiQuestion && (
                        <div className="ai-question-box">
                            <p><strong>{t('newNote.aiQuestion')}</strong><br />{aiQuestion}</p>
                            <button onClick={() => setAiQuestion('')} className="close-btn">×</button>
                        </div>
                    )}

                    <Input
                        label={t('newNote.commentLabel')}
                        as="textarea"
                        value={comment}
                        data-testid="new-note-comment"
                        onChange={(e) => setComment(e.target.value)}
                        required
                        placeholder={commentPlaceholder}
                        maxLength={2000}
                    />

                    {!noteToEdit && (
                        <NoteSharingOptions
                            userGroups={userGroups}
                            shareOption={shareOption}
                            setShareOption={setShareOption}
                            selectedShareGroups={selectedShareGroups}
                            handleGroupSelection={handleGroupSelection}
                            t={t}
                        />
                    )}

                    <div className="modal-actions">
                        <button onClick={handleClose} className="cancel-btn">{t('newNote.cancel')}</button>
                        <button
                            onClick={() => handleSubmit(noteToEdit, scripture, chapter, comment, shareOption, selectedShareGroups, currentGroupId, urlMeta, onClose)}
                            disabled={loading || !scripture || !chapter || !comment}
                            className="submit-btn"
                            data-testid={noteToEdit ? "update-note-button" : "post-note-button"}
                        >
                            {loading ? t('newNote.saving') : (noteToEdit ? t('newNote.update') : t('newNote.post'))}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default NewNote;


