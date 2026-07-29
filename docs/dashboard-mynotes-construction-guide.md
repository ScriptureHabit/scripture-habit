# Scripture Habit Dashboard & My Notes (`Dashboard` / `MyNotes` / `NoteCard`) Comprehensive Step-by-Step Construction Guide

This document is an exhaustive engineering and architecture guide for building the core personal dashboard modules of Scripture Habit: `src/components/dashboard`, `src/components/mynotes`, and `src/components/notecard` from scratch.
It covers real-time user state synchronization, the streak calendar grid, 3-7 day habit pace threshold configuration, 2-step onboarding quest cards for new users, note search token filtering engines, weekly AI recap generation, and responsive note card components with Gospel Library deep links.

---

## 1. Overall Architecture Overview

The `Dashboard` module is the primary hub of the application, coordinating reading analytics, group selection, navigation routing, and user note management (`MyNotes`).

```
                               ┌─────────────────────────┐
                               │       Dashboard         │
                               │   (Main Container)      │
                               └────────────┬────────────┘
                                            │
        ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
        ▼                  ▼                ▼                 ▼                  ▼
useDashboardSync   useDashboardGroups useHabitPace/Warnings  DashboardLayout      MyNotes
(Auth & User Sync)  (Group Subscription)(3-7 Day Habit Pace) (Overview/Streak) (Search & Filter)
                                                                                  │
                                                                                  ▼
                                                                              NoteCard
                                                                        (Card & Deep Link)
```

### Key Capabilities
- **User & Auth Sync (`useDashboardSync`)**: Real-time synchronization of Firebase Auth and Firestore `users/{uid}` document with local midnight timezone flips (`useToday`).
- **Streak Calendar (`StreakCalendar`)**: Monthly reading grid displaying study completions (`isStudied`) and kick deadline warnings (`isKickDate`).
- **3-7 Day Habit Pace Hook (`useDashboardHabitPace`)**: Manages the onboarding welcome modal for setting and persisting a user's autokick threshold (`selectedKickDays` between 3 and 7 days) via `/api/groups/update-kick-threshold`.
- **2-Step Onboarding Quest Card (`QuestCard`)**: Guides new users through Step 1 (Join/Create Group) and Step 2 (Post First Note). Fires confetti (`canvas-confetti`) on completion and updates `hasCompletedOnboarding`.
- **Note Search & Category Filter Engine (`useMyNotes`)**: Full-text note search via search tokens (`createSearchTokens`), `array-contains-any` Firestore queries, scripture category filtering, and cursor pagination (`startAfter`).
- **Weekly AI Recap (`useRecap` / `useRecapOperations`)**: Automated generation of personalized study recaps via Gemini API (`/api/ai/generate-personal-weekly-recap`) with a 6-day cooldown check, saving recaps to the user's LetterBox (`users/{uid}/letters`).
- **Scripture Deep Linking (`NoteCard`)**: Direct deep links to the Gospel Library app / web interface with full modal detail views (`NoteDetailModal`).

---

## 2. Directory Taxonomy & File Responsibilities

```
src/components/
├── dashboard/
│   ├── dashboard.tsx                   # Dashboard central entry point
│   ├── dashboard.css                   # Layout grid and core CSS
│   ├── components/
│   │   ├── dashboard-layout.tsx        # View switcher shell
│   │   ├── dashboard-overview.tsx      # Overview section combining streak & quest cards
│   │   ├── dashboard-modals.tsx        # Modal switch router for dashboard-specific dialogs
│   │   ├── streak-calendar.tsx         # Monthly study streak & kick deadline grid component
│   │   ├── streak-calendar.css
│   │   ├── quest-card.tsx              # 2-step onboarding quest card for new users
│   │   └── quest-card.css
│   └── hooks/
│       ├── use-dashboard-sync.ts       # Auth state listener and user data sync hook
│       ├── use-dashboard-groups.ts     # User group list & active group state hook
│       ├── use-dashboard-habit-pace.ts # 3-7 day habit pace (autokick threshold) setup hook
│       ├── use-dashboard-invitations.ts # Group invite acceptance hook
│       ├── use-dashboard-notifications.ts # FCM notification prompt handler hook
│       ├── use-dashboard-warnings.ts   # Inactivity autokick warning detector hook
│       └── use-dashboard-actions.ts    # User profile mutation & dialog action hook
├── mynotes/
│   ├── my-notes.tsx                    # Notes search header & card list container
│   ├── my-notes.css
│   ├── note-detail-modal.tsx           # Full note detail dialog
│   ├── note-detail-modal.css
│   └── hooks/
│       ├── use-my-notes.ts             # Search token & category pagination subscription hook
│       ├── use-note-actions.ts         # Note deletion & edit mutation hook
│       └── use-recap.ts                # Weekly AI recap generator & LetterBox saver hook
└── notecard/
    ├── note-card.tsx                   # Individual note card component
    └── note-card.css
```

---

## 3. Step-by-Step Construction Phases (Phase 1 to Phase 7)

### Phase 1: User Sync & Habit Pace Configuration Hooks

#### 1. User Sync Hook (`hooks/use-dashboard-sync.ts`)
Listens to Firebase Auth state changes and subscribes to the Firestore `users/{uid}` document in real-time.

```typescript
export const useDashboardSync = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setUserData(null);
        setStatus('success');
        return;
      }

      setUser(currentUser);
      const userRef = doc(db, 'users', currentUser.uid).withConverter(userDataConverter);
      
      const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserData(docSnap.data());
          setStatus('success');
        }
      });

      return unsubscribeDoc;
    });

    return unsubscribeAuth;
  }, []);

  return { user, userData, status };
};
```

#### 2. Habit Pace Setup Hook (`hooks/use-dashboard-habit-pace.ts`)
Triggers the welcome modal for new users without a set threshold, enabling them to select and submit their target habit pace (3 to 7 days `selectedKickDays`) to `/api/groups/update-kick-threshold`.

---

### Phase 2: Group Subscription & Warning Hooks

- `use-dashboard-groups.ts`: Fetches all groups joined by the user and manages `activeGroupId`.
- `use-dashboard-warnings.ts`: Detects consecutive inactive days and warns of impending autokick threshold.

---

### Phase 3: Dashboard Subcomponents & Modals

#### 1. Streak Calendar Grid (`components/streak-calendar.tsx`)

```tsx
export const StreakCalendar: FC<StreakCalendarProps> = ({ studiedDates = [], kickDate, t }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarData = useMemo(() => {
    // Generate grid items for days of the current month
    // ...
  }, [currentMonth, studiedDates, kickDate]);

  return (
    <div className="streak-calendar-container">
      <div className="calendar-grid">
        {calendarData.map((item) => (
          <div key={item.key} className={`calendar-cell ${item.isStudied ? 'studied' : ''} ${item.isKickDate ? 'kick-deadline' : ''}`}>
            <span className="day-number">{item.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### 2. Onboarding Quest Card (`components/quest-card.tsx`)
Displays progress for new users across **Step 1 (Join/Create Group)** and **Step 2 (Post First Note)**. Once both steps are completed (`allDone`), it triggers confetti (`canvas-confetti`) and updates `hasCompletedOnboarding: true` when the user clicks the completion button.

```tsx
export const QuestCard: FC<QuestCardProps> = ({ userData, t }) => {
  const step1Done = !!userData.questCreatedGroup || (userData.groupIds && userData.groupIds.length > 0) || !!userData.groupId;
  const step2Done = !!userData.questPostedNote || (userData.totalNotes && userData.totalNotes > 0);
  const allDone = step1Done && step2Done;

  if (userData.hasCompletedOnboarding || isLegacyCompleted) return null;

  return (
    <div className="onboarding-quest-card glassmorphic-card">
      {!allDone ? (
        <div className="quest-steps">
          {/* Step 1: Join Group / Step 2: Post Note */}
        </div>
      ) : (
        <button onClick={handleComplete}>{t('onboardingQuest.congratsBtn')}</button>
      )}
    </div>
  );
};
```

---

### Phase 4: MyNotes Search & Filter Engine (`mynotes/hooks/use-my-notes.ts`)

Subscribes to `users/{uid}/notes` and performs search token (`createSearchTokens`) queries via `array-contains-any`, along with cursor pagination (`startAfter`).

```typescript
export const useMyNotes = (userData: UserData, selectedCategory: NoteCategory, searchTerm: string, notesPerPage: number) => {
  const [dataState, setDataState] = useState<NoteFetchStatus>({ status: 'loading', notes: [] });

  useEffect(() => {
    if (!userData?.uid) return;

    const notesRef = collection(db, 'users', userData.uid, 'notes').withConverter(noteConverter);
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

    if (selectedCategory !== 'All') {
      constraints.push(where('scripture', '==', selectedCategory));
    }
    if (searchTerm) {
      const tokens = createSearchTokens(searchTerm).slice(0, 10);
      if (tokens.length > 0) {
        constraints.unshift(where('searchTokens', 'array-contains-any', tokens));
      }
    }

    const q = query(notesRef, ...constraints, limit(notesPerPage));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDataState({ status: 'success', notes: snapshot.docs.map(d => d.data()) });
    });

    return unsubscribe;
  }, [userData?.uid, selectedCategory, searchTerm, notesPerPage]);

  return { ...dataState };
};
```

---

### Phase 5: Note Card & Modal Presentation Layer

#### 1. Note Card Component (`notecard/note-card.tsx`)

```tsx
export const NoteCard: FC<{ note: Note; onClick: () => void }> = ({ note, onClick }) => {
  const gospelUrl = getGospelLibraryUrl(note.scripture, note.chapter);

  return (
    <div className="note-card" onClick={onClick}>
      <div className="note-card-header">
        <span className="scripture-title">{note.scripture} {note.chapter}</span>
        {gospelUrl && (
          <a href={gospelUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            📖 Gospel Library
          </a>
        )}
      </div>
      <p className="note-comment-preview">{note.comment}</p>
      <span className="note-date">{formatDate(note.createdAt)}</span>
    </div>
  );
};
```

#### 2. Full Note Detail Modal (`mynotes/note-detail-modal.tsx`)
Opens on card click, allowing full text reading, social sharing, and edit/delete triggers.

---

### Phase 6: Glassmorphism Design & CSS Layout (`dashboard.css`, `my-notes.css`)

- **Responsive Grid System**: 3-column desktop layout (Sidebar + Main + Overview) transitioning to a single-column mobile view with bottom navigation bar.
- **Glassmorphism Backdrop**: Smooth translucency using `backdrop-filter: blur(12px)`.

---

### Phase 7: Testing & Verification

Vitest suites (`use-dashboard-groups.test.ts` & `use-dashboard-habit-pace.test.ts`):

```typescript
describe('useDashboardHabitPace', () => {
  it('triggers auto kick threshold modal when user has not set preference', () => {
    // ...
  });
});
```

---

## 4. Summary

The `Dashboard` and `MyNotes` modules serve as the central personal hub of Scripture Habit.
By partitioning auth, group state, search token filtering, onboarding quests, and calendar rendering into dedicated custom hooks and modular components, the personal study experience remains highly performant and extensible.
