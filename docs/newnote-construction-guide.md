# Scripture Habit Note Creation & Editing Modal (`NewNote`) Comprehensive Step-by-Step Construction Guide

This document is an exhaustive engineering and architecture guide for building the entire `src/components/newnote` module from scratch.
It covers form state management, URL metadata extraction, AI reflection question generation via Gemini, random scripture suggestion engine, sharing scope control, note submission & streak transaction workflows, and unit testing.

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
(URL Title/Speaker) (Gemini Questions)(6 Categories) (API/Streak/Confetti)(Menu, Pills, Modals)
```

### Key Capabilities
- **Scripture Autocomplete & Normalization**: Real-time suggestion filtering for scripture books with Hiragana/Unicode normalization via `suggestion-utils.ts`.
- **URL Metadata Extraction**: Automatic parsing of web page titles and conference speakers when a General Conference or article URL is entered into the chapter field.
- **AI Reflection Generator (Gemini)**: On-demand generation of deep reflection questions based on the selected scripture verse.
- **Random Scripture Picker Engine**: Random scripture selection from 6 predefined categories (Daily Reading Plan, Scripture Mastery, Peace, Adversity, Relationship, Joy).
- **Flexible Scope Sharing Controls**: Multicast sharing options (All Groups, Personal Only, or Selected Groups).
- **Unified Creation & Edit Mode**: Editing existing notes and group messages with bi-directional synchronization.
- **Submission & Streak Engine**: POST API handling, streak progression, level-up celebration triggers (`canvas-confetti`), and onboarding tooltips.

---

## 2. Directory Taxonomy & File Responsibilities

```
src/components/newnote/
├── new-note.tsx                        # Main Modal Component (Entry Point)
├── new-note.css                        # Modal & Form layout styling
├── new-note.test.tsx                   # Vitest component integration tests
├── hooks/
│   ├── use-note-state.ts              # Form state and modal visibility hook
│   ├── use-url-meta-fetcher.ts        # Async URL metadata fetcher hook
│   ├── use-ai-generator.ts            # Gemini API reflection question generator hook
│   ├── use-random-note.ts             # Random scripture picker hook across 6 categories
│   ├── use-note-submission.ts         # Note submission, edit sync, and streak API hook
│   └── use-note-submission.test.ts    # Submission logic unit tests
└── subcomponents/
    ├── random-scripture-menu.tsx      # Random scripture picker button & menu UI
    ├── scripture-selection-modal.tsx  # Topic selection modal for random scriptures
    ├── note-sharing-options.tsx       # Group sharing scope selector pills UI
    └── close-confirm-modal.tsx        # Unsaved changes confirmation dialog
```

---

## 3. Step-by-Step Construction Phases (Phase 1 to Phase 6)

### Phase 1: Data Models & Utility Dependencies

First, prepare the data models and core utility functions required for note creation.

```typescript
// Core helper utility imports
import { getBookSuggestions } from '../../utils/suggestion-utils';
import { getGospelLibraryUrl, getCategoryFromScripture } from '../../utils/gospel-library-mapper';
import { formatNoteText, getNoteValidationError } from '../../utils/note-logic';
import { buildNoteSearchTokens } from '../../utils/search-token-utils';

// Component Props Definition
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

The `NewNote` component relies on 5 specialized custom hooks, following the Logic-Component Split pattern.

#### 1. URL Metadata Extraction Hook (`hooks/use-url-meta-fetcher.ts`)
Detects when a URL is typed or pasted into the `chapter` field, fetching article titles and speaker names via `/api/extract-url-metadata`.

```typescript
import { useState, useEffect } from 'react';
import apiClient from '../../../utils/api-client';

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

#### 2. AI Reflection Generator Hook (`hooks/use-ai-generator.ts`)
Calls Gemini API via `/api/generate-questions` to generate study prompt questions tailored to the selected scripture.

```typescript
export const useAIGenerator = (language: string | null) => {
    const [aiQuestion, setAiQuestion] = useState<string>('');
    const [aiLoading, setAiLoading] = useState(false);

    const handleGenerateQuestions = async (scripture: string, chapter: string) => {
        if (!scripture) return;
        setAiLoading(true);
        try {
            const res = await apiClient.post('/api/generate-questions', { scripture, chapter, language });
            setAiQuestion(res.data?.question || '');
        } catch (err) {
            console.error("AI question generation error:", err);
        } finally {
            setAiLoading(false);
        }
    };

    return { aiQuestion, setAiQuestion, aiLoading, handleGenerateQuestions };
};
```

#### 3. Random Scripture Picker Hook (`hooks/use-random-note.ts`)
Selects random scripture references across 6 category stores (Reading Plan, Scripture Mastery, Peace, Adversity, Relationship, Joy).

```typescript
export const useRandomNote = (
    language: string | null,
    translateChapterField: (ch: string) => string,
    onSelectScripture: (scripture: string, chapter: string) => void
) => {
    const [showRandomMenu, setShowRandomMenu] = useState(false);
    const [showSelectionModal, setShowSelectionModal] = useState(false);

    const handlePickRandomMastery = () => {
        const pool = SCRIPTURE_MASTERY_LIST;
        const item = pool[Math.floor(Math.random() * pool.length)];
        onSelectScripture(item.scripture, item.chapter);
    };

    // Category handlers: handlePickRandomPeace, handlePickRandomAdversity, etc.

    return {
        showRandomMenu, setShowRandomMenu,
        showSelectionModal, setShowSelectionModal,
        handlePickRandomMastery,
        // ...
    };
};
```

#### 4. Note Submission & Edit Sync Hook (`hooks/use-note-submission.ts`)
Handles validation, POST submission to `/api/notes`, streak recalculation, confetti animations, and Firestore Batch updates for editing.

```typescript
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

        const validationError = getNoteValidationError(scripture, chapter);
        if (validationError) {
            toast.error(t(validationError));
            return;
        }

        setLoading(true);
        try {
            if (noteToEdit) {
                // EDIT MODE: Direct Firestore Batch update
                const batch = writeBatch(db);
                // ... update group message and personal note
                await batch.commit();
            } else {
                // CREATE MODE: POST to /api/notes
                const res = await apiClient.post('/api/notes', {
                    scripture, chapter, comment, shareOption, selectedShareGroups
                });

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

### Phase 3: Subcomponents Layer

1. **`random-scripture-menu.tsx`**: Shuffle button trigger and popup menu for choosing random scripture categories.
2. **`scripture-selection-modal.tsx`**: Modal for choosing specific categories (Peace, Adversity, Relationship, Joy).
3. **`note-sharing-options.tsx`**: Pill buttons for choosing sharing scope ("All Groups", "Personal Only", "Select Groups").
4. **`close-confirm-modal.tsx`**: Confirmation modal when attempting to close with unsaved edits.

---

### Phase 4: Main Component Assembly (`new-note.tsx`)

Integrates state, hooks, subcomponents, and onboarding step tooltips.

```tsx
const NewNote: FC<NewNoteProps> = ({
    isOpen, onClose, userData, userGroups = [], currentGroupId = null, noteToEdit = null
}) => {
    const { t, language } = useLanguage();
    const [scripture, setScripture] = useState('');
    const [chapter, setChapter] = useState('');
    const [comment, setComment] = useState('');

    const { urlMeta, urlLoading } = useUrlMetaFetcher(chapter, scripture, language || 'en');
    const { aiQuestion, aiLoading, handleGenerateQuestions } = useAIGenerator(language);
    const { loading, handleSubmit } = useNoteSubmission(userData, language, t);

    // Sync Edit Mode data
    useEffect(() => {
        if (noteToEdit) {
            setScripture(noteToEdit.scripture || '');
            setChapter(noteToEdit.chapter || '');
            setComment(noteToEdit.comment || '');
        }
    }, [noteToEdit]);

    if (!isOpen) return null;

    return (
        <div className="new-note-overlay">
            <div className="new-note-modal">
                <Header title={noteToEdit ? t('editNote.title') : t('newNote.title')} />
                
                {/* Inputs & Autocomplete */}
                <ScriptureInput value={scripture} onChange={setScripture} />
                <ChapterInput value={chapter} onChange={setChapter} />
                
                {/* AI Question Button */}
                <button onClick={() => handleGenerateQuestions(scripture, chapter)}>
                    <UilRobot /> {t('newNote.generateAiQuestion')}
                </button>

                {/* Comment Textarea */}
                <textarea value={comment} onChange={e => setComment(e.target.value)} />

                {/* Sharing Options */}
                <NoteSharingOptions ... />

                {/* Submit / Cancel Buttons */}
                <button onClick={onSubmit} disabled={loading}>{t('common.save')}</button>
            </div>
        </div>
    );
};
```

---

### Phase 5: Visual Design & Styling (`new-note.css`)

- **Modal Overlay**: `backdrop-filter: blur(8px)` with dark mode contrast.
- **Responsive Sheet**: Slide-up sheet on mobile viewports (`@media (max-width: 768px)`), centered dialog on desktop.
- **Suggestion Pills**: Interactive hover transitions and focused state indicators.

---

### Phase 6: Automated Testing & Verification

Comprehensive Vitest tests (`new-note.test.tsx` and `use-note-submission.test.ts`):

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

The `NewNote` component cleanly separates UI rendering from side-effects (URL parsing, AI prompt generation, random scripture picking, submission transactions) via 5 modular custom hooks and 4 dedicated subcomponents.
This architecture guarantees high maintainability, reusability, and simple unit testing.
