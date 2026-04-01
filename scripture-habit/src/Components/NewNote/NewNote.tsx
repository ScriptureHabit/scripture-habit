import { useState, useEffect, FC, useMemo } from 'react';
import Select from 'react-select';
import { UilShuffle, UilRobot } from '@iconscout/react-unicons';
import { useLanguage } from '../../Context/LanguageContext';
import Input from '../Input/Input';
import './NewNote.css';

// Hooks
import { useUrlMetaFetcher } from './hooks/useUrlMetaFetcher';
import { useAIGenerator } from './hooks/useAIGenerator';
import { useNoteSubmission } from './hooks/useNoteSubmission';

// Subcomponents
import RandomScriptureMenu from './SubComponents/RandomScriptureMenu';
import ScriptureSelectionModal from './SubComponents/ScriptureSelectionModal';
import CloseConfirmModal from './SubComponents/CloseConfirmModal';

import { getTodayReadingPlan } from '../../Data/DailyReadingPlan';
import { AdversityScriptures } from '../../Data/AdversityScriptures';
import { JoyScriptures } from '../../Data/JoyScriptures';
import { RelationshipScriptures } from '../../Data/RelationshipScriptures';
import { MasteryScriptures } from '../../Data/MasteryScriptures';
import { PeaceScriptures } from '../../Data/PeaceScriptures';
import { localizeLdsUrl } from '../../Utils/urlLocalizer';
import { getBookSuggestions } from '../../Utils/suggestionUtils';
import { getGospelLibraryUrl, getCategoryFromScripture } from '../../Utils/gospelLibraryMapper';
import { removeNoteHeader } from '../../Utils/noteUtils';
import { UserData } from '../../types/user';

interface NewNoteProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserData;
    isGroupContext?: boolean;
    userGroups?: any[];
    currentGroupId?: string | null;
    noteToEdit?: any;
}

const NewNote: FC<NewNoteProps> = ({
    isOpen, onClose, userData, isGroupContext = false,
    userGroups = [], currentGroupId = null, noteToEdit = null
}) => {
    const { t, language, tArray, translateChapterField, bookTranslations } = useLanguage();
    const [scripture, setScripture] = useState<string>('');
    const [chapter, setChapter] = useState<string>('');
    const [comment, setComment] = useState<string>('');
    const [shareOption, setShareOption] = useState<string>('all');
    const [selectedShareGroups, setSelectedShareGroups] = useState<string[]>([]);
    const [showRandomMenu, setShowRandomMenu] = useState(false);
    const [showScriptureSelectionModal, setShowScriptureSelectionModal] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // Auto-suggestions logic
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const { urlMeta, urlLoading } = useUrlMetaFetcher(chapter, scripture, language);
    const { aiQuestion, setAiQuestion, aiLoading, handleGenerateQuestions } = useAIGenerator(language);
    const { loading, handleSubmit } = useNoteSubmission(userData, language, t);

    const commentPlaceholder = useMemo(() => {
        const placeholders = tArray('newNote.commentPlaceholder');
        return placeholders[Math.floor(Math.random() * placeholders.length)] || '';
    }, [tArray]);

    const chapterPlaceholder = useMemo(() => {
        const placeholders = tArray('newNote.chapterPlaceholder');
        return placeholders[Math.floor(Math.random() * placeholders.length)] || '';
    }, [tArray]);

    const glUrl = useMemo(() => getGospelLibraryUrl(scripture, chapter, language), [scripture, chapter, language]);

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
    }, [noteToEdit, isOpen, isGroupContext, currentGroupId]);

    if (!isOpen) return null;

    const availableReadingPlanScripts = getTodayReadingPlan()?.scripts || [];
    const isUrl = typeof chapter === 'string' && chapter.startsWith('http');

    const getPlaceholder = () => {
        if (isUrl) return t('newNote.urlPlaceholder');
        if (scripture === "General Conference") return t('newNote.urlPlaceholder');
        if (scripture === "BYU Speeches") return t('newNote.byuUrlPlaceholder');
        if (scripture === "Other") return t('newNote.otherUrlPlaceholder');
        return chapterPlaceholder;
    };

    const handleSurpriseMe = () => {
        setShowRandomMenu(true);
    };

    const handleClose = () => {
        if (chapter || comment) {
            setShowCloseConfirm(true);
        } else {
            onClose();
        }
    };

    const handleGroupSelection = (groupId: string) => {
        setSelectedShareGroups(prev =>
            prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
        );
    };

    const pickAndFillRandom = (randomScripture: any) => {
        setScripture(randomScripture.scripture);
        let finalChapter = randomScripture.chapter;
        if (finalChapter.startsWith('http')) {
            finalChapter = localizeLdsUrl(finalChapter, language);
        } else {
            finalChapter = translateChapterField(finalChapter);
        }
        setChapter(finalChapter);
        setShowRandomMenu(false);
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

    if (showRandomMenu) {
        return (
            <RandomScriptureMenu
                t={t}
                setShowRandomMenu={setShowRandomMenu}
                availableReadingPlanScripts={availableReadingPlanScripts}
                handlePickRandomReadingPlan={() => {
                    if (availableReadingPlanScripts.length === 1) {
                        const script = availableReadingPlanScripts[0];
                        const detectedCategory = getCategoryFromScripture(script);
                        pickAndFillRandom({ scripture: detectedCategory !== 'Other' ? detectedCategory : 'Book of Mormon', chapter: script });
                        setShowRandomMenu(false);
                    } else {
                        setShowScriptureSelectionModal(true);
                        setShowRandomMenu(false);
                    }
                }}
                handlePickRandomMastery={() => pickAndFillRandom(MasteryScriptures[Math.floor(Math.random() * MasteryScriptures.length)])}
                handlePickRandomPeace={() => pickAndFillRandom(PeaceScriptures[Math.floor(Math.random() * PeaceScriptures.length)])}
                handlePickRandomAdversity={() => pickAndFillRandom(AdversityScriptures[Math.floor(Math.random() * AdversityScriptures.length)])}
                handlePickRandomRelationship={() => pickAndFillRandom(RelationshipScriptures[Math.floor(Math.random() * RelationshipScriptures.length)])}
                handlePickRandomJoy={() => pickAndFillRandom(JoyScriptures[Math.floor(Math.random() * JoyScriptures.length)])}
            />
        );
    }

    if (showScriptureSelectionModal) {
        return (
            <ScriptureSelectionModal
                t={t}
                onClose={() => setShowScriptureSelectionModal(false)}
                availableReadingPlanScripts={availableReadingPlanScripts}
                fillScriptureData={(script) => {
                    const detectedCategory = getCategoryFromScripture(script);
                    setScripture(detectedCategory !== 'Other' ? detectedCategory : 'Book of Mormon');
                    setChapter(translateChapterField(script));
                }}
                setShowScriptureSelectionModal={setShowScriptureSelectionModal}
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

                    <div className="form-group">
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
                            label={scripture === "General Conference" ? t('newNote.urlLabel') : t('newNote.chapterLabel')}
                            type="text"
                            value={chapter}
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
                                <button type="button" onClick={handleSurpriseMe} className="modern-action-btn">
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
                                    {urlMeta.speaker && (
                                        <div className="url-meta-speaker">
                                            {urlMeta.speaker}
                                        </div>
                                    )}
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
                        onChange={(e) => setComment(e.target.value)}
                        required
                        placeholder={commentPlaceholder}
                    />

                    {!noteToEdit && (
                        <div className="sharing-options">
                            <label className="sharing-label">{t('newNote.shareLabel')}</label>
                            <div className="radio-group">
                                {(userGroups.length === 1 ? ['all', 'none'] : ['all', 'specific', 'none']).map(opt => (
                                    <label key={opt} className={`radio-option ${(opt === 'all' || opt === 'specific') && userGroups.length === 0 ? 'disabled' : ''}`}>
                                        <input
                                            type="radio" value={opt}
                                            checked={shareOption === opt}
                                            onChange={(e) => setShareOption(e.target.value)}
                                            disabled={(opt === 'all' || opt === 'specific') && userGroups.length === 0}
                                        />
                                        <span>
                                            {userGroups.length === 1 && opt === 'all'
                                                ? t('newNote.shareToGroup')
                                                : t(`newNote.share${opt.charAt(0).toUpperCase() + opt.slice(1)}`)
                                            }
                                        </span>
                                    </label>
                                ))}
                            </div>

                            {shareOption === 'specific' && (
                                <div className="group-selection-list">
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
                            onClick={() => handleSubmit(noteToEdit, scripture, chapter, comment, shareOption, selectedShareGroups, currentGroupId, urlMeta, onClose)}
                            disabled={loading || !scripture || !chapter || !comment}
                            className="submit-btn"
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
