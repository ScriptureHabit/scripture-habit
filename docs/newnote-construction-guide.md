# Note Creation & Edit Modal (`NewNote`)

::: tip Interactive Architecture Tour
Explore the live data-flow blueprint and guided walkthrough for this feature:
- **Online (GitHub Browser Preview)**: [Open Interactive Tour (Create New Note & Scripture Tags)](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=tour-newnote&lang=en)
- **VitePress / Local**: [Open Create New Note & Scripture Tags Tour](/architecture-tour.html?tour=tour-newnote&lang=en)
:::

This document describes the structure, form state management, custom hook separation, and implementation of the study note creation modal (`src/components/newnote`).

---

## 1. High-Level Architecture

`NewNote` is the modal container where users record daily study notes, save private reflections, and share posts with study groups.

```
                               ┌─────────────────────────┐
                               │       NewNote           │
                               │   (Modal Container)     │
                               └────────────┬────────────┘
                                            │
        ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
        ▼                  ▼                ▼                 ▼                  ▼
useUrlMetaFetcher   useAIGenerator   useRandomNote   useNoteSubmission    Subcomponents
(Debounced URLs)   (Gemini Prompts) (Themed Verses)  (Submit/Batch Sync) (Pills/Dialogs)
```

### Key Capabilities
- **Scripture Autocomplete**: Real-time suggestions for book names across supported languages.
- **Automated URL Metadata (`useUrlMetaFetcher`)**: Debounces inputs by 500ms to fetch titles and speaker names for General Conference or external URLs.
- **AI Reflection Prompts (`useAIGenerator`)**: Generates contextual questions using Gemini AI based on selected verses.
- **Themed Scripture Suggestions (`useRandomNote`)**: Draws verses randomly from curated themes (Mastery, Peace, Adversity, Joy, Relationships, Daily Plan).
- **Granular Sharing Options (`NoteSharingOptions`)**: Share with all groups, keep private, or select specific target circles.
- **Unified Create & Edit Lifecycles**: Uses `writeBatch` to synchronize edits between private archives (`users/{uid}/notes`) and group messages (`groups/{gid}/messages`).

---

## 2. Directory Structure

```
src/components/newnote/
├── new-note.tsx                        # Main modal entry point
├── new-note.css                        # Styling
├── new-note.test.tsx                   # Component integration tests
├── hooks/
│   ├── use-url-meta-fetcher.ts        # 500ms debounced URL metadata hook
│   ├── use-ai-generator.ts            # Gemini API reflection prompts
│   ├── use-random-note.ts             # Themed random scripture selection
│   ├── use-note-submission.ts         # Note submission & Batch sync hook
│   └── use-note-submission.test.ts    # Unit tests for submission logic
└── subcomponents/
    ├── random-scripture-menu.tsx      # Random prompt trigger menu
    ├── scripture-selection-modal.tsx  # Themed scripture category dialog
    ├── note-sharing-options.tsx       # Share visibility pill selectors
    └── close-confirm-modal.tsx        # Unsaved changes confirmation dialog
```

---

## 3. Core Hook Implementations

### ① URL Metadata Fetcher (`useUrlMetaFetcher`)
When an input in the chapter field begins with `http`, the hook waits 500ms before calling `/api/preview` to fetch the title and speaker.

### ② Themed Random Verses (`useRandomNote`)
Picks verses randomly from daily reading plans or themed scripture categories, auto-populating form fields and localizing LDS URLs.

### ③ Submission & Sync (`useNoteSubmission`)
- **New Notes**: Dispatches a POST request to `/api/notes`. Triggers a confetti animation (`canvas-confetti`) when leveling up.
- **Existing Notes**: Executes a Firestore `writeBatch` to update the private note copy and group message in a single atomic operation.

---

## 4. Related Documentation

- [Note Posting & Streak Logic](./logic-note-posting.md)
- [URL Metadata & Speaker Extraction](./url-metadata-extraction.md)
- [AI Integration (Gemini)](./feature-ai-integration.md)
- [Dashboard & MyNotes Guide](./dashboard-mynotes-construction-guide.md)
