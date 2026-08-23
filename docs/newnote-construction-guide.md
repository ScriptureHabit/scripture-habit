# Note Creation & Editing Modal (`NewNote`) Architecture & Implementation

This document provides an overview of the architecture and implementation details for the `src/components/newnote` module.
It covers form state management, URL metadata extraction, AI reflection question generation via Gemini, thematic & reading plan scripture suggestion engines, sharing scope control, and note submission transactions.

---

## 1. Overall Architecture Overview

The `NewNote` module is the primary interface where users log daily scripture readings, generate AI-assisted study reflections, record personal study notes, and share study progress with their groups.

```
                               ┌─────────────────────────┐
                               │       NewNote           │
                               │  (Modal Container)      │
                               └────────────┬────────────┘
                                            │
        ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
        ▼                  ▼                ▼                 ▼                  ▼
useUrlMetaFetcher   useAIGenerator   useRandomNote   useNoteSubmission    Subcomponents
(500ms Debounce URL)(Gemini Questions)(6 Categories/UrlLocalizer)(API/Confetti/Batch)(Pills/Modals)
```

### Key Capabilities
- **Scripture Autocomplete & Normalization**: Real-time suggestion filtering for scripture books with Hiragana/Unicode normalization via `suggestion-utils.ts`.
- **URL Metadata Extraction (`useUrlMetaFetcher`)**: Automatic parsing of web page titles and conference speakers via `/api/extract-url-metadata` after a 500ms debounce whenever a URL (starting with `http`) is typed into the chapter field.
- **AI Reflection Generator (Gemini) (`useAIGenerator`)**: On-demand generation of deep reflection questions via `/api/generate-questions`.
- **Random Scripture Picker Engine (`useRandomNote`)**: Random scripture selection across 6 categories: Daily Reading Plan (`getTodayReadingPlan`), Scripture Mastery (`MasteryScriptures`), Peace (`PeaceScriptures`), Adversity (`AdversityScriptures`), Relationship (`RelationshipScriptures`), and Joy (`JoyScriptures`). Automatically localizes LDS URLs via `localizeLdsUrl`.
- **Flexible Scope Sharing Controls (`NoteSharingOptions`)**: Multicast sharing options ("All Groups", "Personal Only", "Selected Groups").
- **Unified Creation & Edit Mode**: Direct Firestore WriteBatch (`writeBatch`) updates for editing existing group messages and personal notes. POST requests to `/api/notes` for new notes with level-up confetti bursts (`canvas-confetti`).

---

## 2. Directory Taxonomy & File Responsibilities

```
src/components/newnote/
├── new-note.tsx                        # Main Modal Component (Entry Point)
├── new-note.css                        # Modal & Form layout styling
├── new-note.test.tsx                   # Vitest component integration tests
├── hooks/
│   ├── use-url-meta-fetcher.ts        # 500ms debounced async URL metadata fetcher hook
│   ├── use-ai-generator.ts            # Gemini API (/api/generate-questions) reflection question generator hook
│   ├── use-random-note.ts             # 6 categories with URL localizer random scripture picker hook
│   ├── use-note-submission.ts         # Note submission (/api/notes), WriteBatch edit sync, and confetti hook
│   └── use-note-submission.test.ts    # Submission logic unit tests
└── subcomponents/
    ├── random-scripture-menu.tsx      # Shuffle icon button & popup menu UI
    ├── scripture-selection-modal.tsx  # Topic selection modal for random scriptures
    ├── note-sharing-options.tsx       # Group sharing scope selector pills UI
    └── close-confirm-modal.tsx        # Unsaved changes confirmation dialog
```

---

## 3. Step-by-Step Construction Phases (Phase 1 to Phase 6)

### Phase 1: Data Models & Utility Dependencies

```typescript
export interface NewNoteProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserData;
    userGroups?: Group[];
    currentGroupId?: string | null;
    noteToEdit?: Message | Note | null;
}
```

---

### Phase 2: Domain Custom Hooks Architecture

#### 1. URL Metadata Extraction Hook (`hooks/use-url-meta-fetcher.ts`)

```typescript
export const useUrlMetaFetcher = (chapter: string, scripture: string, language: string) => {
    const [urlMeta, setUrlMeta] = useState<{ title: string; speaker?: string } | null>(null);
    const [urlLoading, setUrlLoading] = useState(false);

    useEffect(() => {
        if (!chapter || !chapter.startsWith('http')) {
            setUrlMeta(null);
            return;
        }

        const fetchMeta = async () => {
            setUrlLoading(true);
            try {
                const res = await apiClient.post('/api/extract-url-metadata', { url: chapter, language });
                if (res.data?.success) {
                    setUrlMeta({ title: res.data.title, speaker: res.data.speaker });
                }
            } catch (err) {
                console.error("Failed to extract URL metadata:", err);
            } finally {
                setUrlLoading(false);
            }
        };

        const timer = setTimeout(fetchMeta, 500);
        return () => clearTimeout(timer);
    }, [chapter, language]);

    return { urlMeta, urlLoading };
};
```

#### 2. Random Scripture Picker Hook (`hooks/use-random-note.ts`)

```typescript
export const useRandomNote = (
    language: string | null,
    translateChapterField: (field: string) => string,
    onFill: (scripture: string, chapter: string) => void
) => {
    const [showRandomMenu, setShowRandomMenu] = useState(false);
    const [showSelectionModal, setShowSelectionModal] = useState(false);

    const pickAndFill = useCallback((random: { scripture: string; chapter: string }) => {
        let finalChapter = random.chapter;
        if (finalChapter.startsWith('http')) {
            finalChapter = localizeLdsUrl(finalChapter, language || 'en') || finalChapter;
        } else {
            finalChapter = translateChapterField(finalChapter);
        }
        onFill(random.scripture, finalChapter);
        setShowRandomMenu(false);
        setShowSelectionModal(false);
    }, [language, translateChapterField, onFill]);

    return {
        showRandomMenu, setShowRandomMenu,
        showSelectionModal, setShowSelectionModal,
        handlePickRandomMastery: () => pickRandomFromSet(MasteryScriptures),
        handlePickRandomPeace: () => pickRandomFromSet(PeaceScriptures),
        handlePickRandomAdversity: () => pickRandomFromSet(AdversityScriptures),
        handlePickRandomRelationship: () => pickRandomFromSet(RelationshipScriptures),
        handlePickRandomJoy: () => pickRandomFromSet(JoyScriptures),
    };
};
```

#### 3. Note Submission & WriteBatch Hook (`hooks/use-note-submission.ts`)

```typescript
export const useNoteSubmission = (
    userData: UserData,
    language: string | null,
    t: (key: string) => string
) => {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (...) => {
        if (loading) return;

        const validationError = getNoteValidationError(scripture, chapter);
        if (validationError) {
            toast.error(t(validationError));
            return;
        }

        setLoading(true);
        try {
            if (noteToEdit) {
                // EDIT MODE: Direct Firestore WriteBatch update across group messages & personal notes
                const batch = writeBatch(db);
                // ...
                await batch.commit();
            } else {
                // CREATE MODE: POST to /api/notes
                const res = await apiClient.post('/api/notes', { scripture, chapter, comment, shareOption, selectedShareGroups });
                if (res.data?.leveledUp) {
                    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                }
            }
            onSuccess();
        } catch (err) {
            toast.error(t('newNote.submitError'));
        } finally {
            setLoading(false);
        }
    };

    return { loading, handleSubmit };
};
```

---

### Phase 4: Main Component Assembly (`new-note.tsx`)

The main modal container orchestrates the 5 custom hooks and subcomponents into a responsive, accessible dialog:

```typescript
const NewNote: FC<NewNoteProps> = ({
    isOpen, onClose, userData,
    userGroups = [], currentGroupId = null, noteToEdit = null
}) => {
    const { t, language, tArray, translateChapterField } = useLanguage();
    
    // Form State
    const [scripture, setScripture] = useState<string>('');
    const [chapter, setChapter] = useState<string>('');
    const [comment, setComment] = useState<string>('');
    const [shareOption, setShareOption] = useState<string>('all');
    const [selectedShareGroups, setSelectedShareGroups] = useState<string[]>([]);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // Modular Hooks Composition
    const { urlMeta, urlLoading } = useUrlMetaFetcher(chapter, scripture, language || 'en');
    const { aiQuestion, setAiQuestion, aiLoading, handleGenerateQuestions } = useAIGenerator(language);
    const { loading, handleSubmit } = useNoteSubmission(userData, language, t);
    const { 
        showRandomMenu, setShowRandomMenu, 
        showSelectionModal, setShowSelectionModal,
        handlePickRandomMastery, handlePickRandomPeace,
        handlePickRandomAdversity, handlePickRandomRelationship, handlePickRandomJoy 
    } = useRandomNote(language, translateChapterField, (s, c) => {
        setScripture(s);
        setChapter(c);
    });

    if (!isOpen) return null;

    return (
        <div className="new-note-overlay" onClick={handleOverlayClick}>
            <div className="ModalContent" onClick={e => e.stopPropagation()}>
                {/* Header & Category Selection */}
                <div className="modal-header">
                    <h1>{noteToEdit ? t('newNote.editTitle') : t('newNote.title')}</h1>
                    <RandomScriptureMenu 
                        onOpenMenu={() => setShowRandomMenu(true)} 
                        onOpenModal={() => setShowSelectionModal(true)} 
                    />
                </div>

                {/* Scripture Category & Book Autocomplete */}
                <Select
                    options={categoryOptions}
                    value={categoryOptions.find(o => o.value === scripture)}
                    onChange={opt => setScripture(opt?.value || '')}
                    placeholder={t('newNote.selectCategoryPlaceholder')}
                />

                {/* Chapter / URL Input with Debounced Meta Preview */}
                <Input 
                    value={chapter}
                    onChange={e => setChapter(e.target.value)}
                    placeholder={chapterPlaceholder}
                />
                {urlLoading && <span className="url-meta-loader">{t('newNote.extractingUrl')}</span>}
                {urlMeta && (
                    <div className="url-meta-card">
                        <strong>{urlMeta.title}</strong>
                        {urlMeta.speaker && <span> - {urlMeta.speaker}</span>}
                    </div>
                )}

                {/* AI Reflection Generator Trigger & Display */}
                <button 
                    type="button" 
                    className="ai-question-btn"
                    onClick={() => handleGenerateQuestions(scripture, chapter)}
                    disabled={aiLoading}
                >
                    <UilRobot /> {t('newNote.generateAiQuestion')}
                </button>
                {aiQuestion && (
                    <div className="ai-question-card" onClick={() => setComment(prev => `${prev}\n${aiQuestion}`)}>
                        <p>{aiQuestion}</p>
                    </div>
                )}

                {/* Study Notes Textarea */}
                <textarea 
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={commentPlaceholder}
                    rows={4}
                />

                {/* Group Multicast Sharing Selector */}
                <NoteSharingOptions 
                    userGroups={userGroups}
                    shareOption={shareOption}
                    setShareOption={setShareOption}
                    selectedShareGroups={selectedShareGroups}
                    setSelectedShareGroups={setSelectedShareGroups}
                />

                {/* Actions */}
                <div className="ModalActions">
                    <button className="modal-btn cancel" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="modal-btn primary" onClick={onSubmit} disabled={loading}>
                        {loading ? t('common.saving') : t('common.save')}
                    </button>
                </div>
            </div>

            {/* Modals */}
            <ScriptureSelectionModal isOpen={showSelectionModal} onClose={() => setShowSelectionModal(false)} />
            <CloseConfirmModal isOpen={showCloseConfirm} onConfirm={onClose} onCancel={() => setShowCloseConfirm(false)} />
        </div>
    );
};
```

---

### Phase 5: Styling & Visual Design (`new-note.css`)

The modal employs modern backdrop filters (glassmorphism), responsive layout boundaries, and subtle micro-animations for AI questions and URL preview cards:

```css
/* Glassmorphism Backdrop & Modal Container */
.new-note-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.ModalContent {
  background: rgba(255, 255, 255, 0.85);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  border-radius: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.8);
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
}

/* AI Question Prompt Card & Hover Micro-Animation */
.ai-question-card {
  background: linear-gradient(135deg, rgba(238, 242, 255, 0.9), rgba(224, 231, 255, 0.9));
  border: 1px solid rgba(199, 210, 254, 0.8);
  border-radius: 12px;
  padding: 0.85rem 1rem;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.ai-question-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

/* URL Metadata Live Preview Pill */
.url-meta-card {
  background: #f8fafc;
  border-left: 4px solid var(--pink, #ec4899);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #334155;
}
```

### Phase 6: Automated Testing & Verification

Vitest integration test suite (`new-note.test.tsx` and `use-note-submission.test.ts`):

```typescript
describe('useNoteSubmission', () => {
    it('prevents submission when scripture or chapter is empty', async () => {
        const { result } = renderHook(() => useNoteSubmission(mockUser, 'en', key => key));
        await act(async () => {
            await result.current.handleSubmit(null, '', '', '', 'all', [], null, null, vi.fn());
        });
        expect(toast.error).toHaveBeenCalled();
    });
});
```

---

## 4. Summary

The `NewNote` component cleanly separates UI rendering from side-effects (500ms debounced URL parsing, AI prompt generation, URL localized random scripture picking, WriteBatch edit sync) via 5 modular custom hooks and 4 dedicated subcomponents.
