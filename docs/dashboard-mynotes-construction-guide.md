# Dashboard & MyNotes (`Dashboard` / `MyNotes` / `NoteCard`)

> [!TIP]
> **Interactive Architecture Tour**: [Open Live Tour (Habit Dashboard & Streaks)](https://htmlpreview.github.io/?https://github.com/ScriptureHabit/scripture-habit/blob/main/docs/public/architecture-tour.html?tour=tour-dashboard&lang=en)

This document outlines the architecture, data management, and visual components of the personal hub: `Dashboard`, `MyNotes`, and `NoteCard`.

---

## 1. High-Level Architecture

`Dashboard` serves as the primary navigation hub, integrating progress visualization, active group switching, and note discovery (`MyNotes`).

```
                               ┌─────────────────────────┐
                               │       Dashboard         │
                               │   (Main Container)      │
                               └────────────┬────────────┘
                                            │
        ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
        ▼                  ▼                ▼                 ▼                  ▼
useDashboardSync   useDashboardGroups useHabitPace/Warnings  DashboardLayout      MyNotes
(Auth/User Sync)   (Group Selection)  (Pace Settings)      (Overview/Calendar) (Search/List)
                                                                                  │
                                                                                  ▼
                                                                              NoteCard
                                                                        (Card & Deep-Link)
```

### Key Capabilities
- **User State Sync (`useDashboardSync`)**: Real-time synchronization of Firebase Auth and Firestore user profile data.
- **Study Calendar (`StreakCalendar`)**: Monthly grid highlighting studied dates (`isStudied`) and milestone progress.
- **Habit Pace Setting (`useDashboardHabitPace`)**: Onboarding modal allowing users to configure comfortable study paces.
- **Onboarding Quests (`QuestCard`)**: Interactive 2-step guide helping newcomers join a group and post their first note.
- **Note Search & Categorization (`useMyNotes`)**: Filters notes by volume/category and keyword search tokens.
- **Weekly AI Reflection Letters (`useRecap`)**: Generates personalized weekly reflections using Gemini AI.
- **Scripture Deep-Linking (`NoteCard`)**: Direct links to study scriptures on the official Gospel Library app or website.

---

## 2. Directory Structure

```
src/components/
├── dashboard/
│   ├── dashboard.tsx                   # Main dashboard entry point
│   ├── dashboard.css                   # Grid styling
│   ├── components/
│   │   ├── dashboard-layout.tsx        # View switching shell
│   │   ├── dashboard-overview.tsx      # Overview & Quests
│   │   ├── streak-calendar.tsx         # Monthly study calendar
│   │   └── quest-card.tsx              # Onboarding quest card
│   └── hooks/
│       ├── use-dashboard-sync.ts       # Auth & user sync hook
│       ├── use-dashboard-groups.ts     # Group switcher hook
│       └── use-dashboard-habit-pace.ts # Habit pace configuration
├── mynotes/
│   ├── my-notes.tsx                    # Notes search and list container
│   ├── note-detail-modal.tsx           # Full note detail modal
│   └── hooks/
│       ├── use-my-notes.ts             # Search & pagination hook
│       └── use-recap.ts                # Weekly AI letter generator
└── notecard/
    └── note-card.tsx                   # Note card component
```

---

## 3. Core Component Implementations

### ① Study Calendar (`StreakCalendar`)
Renders a monthly calendar grid that highlights days when study notes were submitted, fostering consistent daily habit loops.

### ② Onboarding Quest Card (`QuestCard`)
Guides new users through joining their first group and publishing their first note. Confetti celebrates the completion of the onboarding quest.

### ③ MyNotes Search & Filters (`useMyNotes`)
Queries the `users/{uid}/notes` subcollection with `array-contains-any` token searches and category filters.

---

## 4. Related Documentation

- [AI Reflection Letters & Retention Psychology](./ux-ai-reflection-letters.md)
- [Note Creation & Edit Modal Architecture](./newnote-construction-guide.md)
- [Milestone Celebrations & Retention Psychology](./logic-milestone-retention.md)
