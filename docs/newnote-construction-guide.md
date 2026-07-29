# Scripture Habit Note Creation & Editing Modal (`NewNote`) Comprehensive Step-by-Step Construction Guide

This document is an exhaustive engineering and architecture guide for building the entire `src/components/newnote` module from scratch.
It covers form state management, 500ms debounced URL metadata extraction, AI reflection question generation via Gemini, 5 thematic plus reading plan random scripture engines with URL localization, sharing scope control, note submission & WriteBatch edit transactions, and unit testing.

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
│   ├── use-note-state.ts              # Form state, visibility, and initial note state hook
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

---

### Phase 5: Styling & Visual Design (`new-note.css`)

---

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
