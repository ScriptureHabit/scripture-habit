# Scripture Habit Dashboard & My Notes (`Dashboard` / `MyNotes` / `NoteCard`) Comprehensive Step-by-Step Construction Guide

This document is an exhaustive engineering and architecture guide for building the core personal dashboard modules of Scripture Habit: `src/components/dashboard`, `src/components/mynotes`, and `src/components/notecard` from scratch.
It covers real-time user state synchronization, the streak calendar grid, habit pace evaluation algorithms, group invitation handlers, note search token filtering engines, weekly AI recap generation, and responsive note card components with Gospel Library deep links.

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
(Auth & User Sync)  (Group Subscription)(Habit Pace Engine)  (Overview/Streak) (Search & Filter)
                                                                                  │
                                                                                  ▼
                                                                              NoteCard
                                                                        (Card & Deep Link)
```

### Key Capabilities
- **User & Auth Sync**: Real-time synchronization of Firebase Auth and Firestore `users/{uid}` document with local midnight timezone flips (`useToday`).
- **Streak Calendar**: Monthly reading grid (`StreakCalendar`) displaying study completions and consecutive streak counts.
- **Habit Pace Engine (`useDashboardHabitPace`)**: Algorithmic evaluation comparing weekly study goals against historical study logs to compute dynamic achievement status.
- **Note Search & Category Filter Engine (`useMyNotes`)**: Full-text note search via search tokens (`buildNoteSearchTokens`), scripture volume category filtering, and infinite pagination.
- **Weekly AI Recap (`useRecap`)**: Automated generation of personalized study recaps and spiritual insights via Gemini API based on 7-day note logs.
- **Scripture Deep Linking (`NoteCard`)**: Direct deep links to the Gospel Library app / web interface with modal detail views.

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
│   │   ├── streak-calendar.tsx         # Monthly study streak grid component
│   │   ├── streak-calendar.css
│   │   ├── quest-card.tsx              # Daily goal & reading plan quest card
│   │   └── quest-card.css
│   └── hooks/
│       ├── use-dashboard-sync.ts       # Auth state listener and user data sync hook
│       ├── use-dashboard-groups.ts     # User group list & active group state hook
│       ├── use-dashboard-habit-pace.ts # Habit pace evaluation algorithm hook
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
│       ├── use-my-notes.ts             # Firestore note subscription & search filter hook
│       ├── use-note-actions.ts         # Note deletion & edit mutation hook
│       └── use-recap.ts                # Weekly AI recap generator hook
└── notecard/
    ├── note-card.tsx                   # Individual note card component
    └── note-card.css
```

---

## 3. Step-by-Step Construction Phases (Phase 1 to Phase 7)

### Phase 1: User Sync & Habit Pace Calculation Engine

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

#### 2. Habit Pace Engine (`hooks/use-dashboard-habit-pace.ts`)
Analyzes the user's study logs over the last 30 days and calculates progress status.

---

### Phase 2: Group Subscription & Warning Hooks

- `use-dashboard-groups.ts`: Fetches all groups joined by the user and manages `activeGroupId`.
- `use-dashboard-warnings.ts`: Detects consecutive inactive days and warns of impending autokick threshold.

---

### Phase 3: Dashboard Subcomponents & Modals

#### 1. Streak Calendar Grid (`components/streak-calendar.tsx`)

```tsx
export const StreakCalendar: FC<{ completedDates: string[] }> = ({ completedDates }) => {
  const datesInMonth = useMemo(() => getDatesForCurrentMonth(), []);

  return (
    <div className="streak-calendar-grid">
      {datesInMonth.map((dateStr) => {
        const isDone = completedDates.includes(dateStr);
        return (
          <div key={dateStr} className={`calendar-day ${isDone ? 'completed' : ''}`}>
            {getDayNumber(dateStr)}
          </div>
        );
      })}
    </div>
  );
};
```

#### 2. Quest Card (`components/quest-card.tsx`)
Displays today's reading goal and provides a single-tap trigger to open `NewNote`.

---

### Phase 4: MyNotes Search & Filter Engine (`mynotes/hooks/use-my-notes.ts`)

Subscribes to `users/{uid}/notes` and performs client-side keyword and category filtering.

```typescript
export const useMyNotes = (userId: string | undefined) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (!userId) return;
    const notesRef = collection(db, 'users', userId, 'notes');
    const q = query(notesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
      setNotes(fetchedNotes);
    });

    return unsubscribe;
  }, [userId]);

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = !searchQuery || 
        note.scripture?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.comment?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [notes, searchQuery, selectedCategory]);

  return { notes: filteredNotes, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory };
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
  it('returns excellent habit status when reading 3+ days per week', () => {
    const pace = calculateHabitPace(mockNotesCount);
    expect(pace.status).toBe('excellent');
  });
});
```

---

## 4. Summary

The `Dashboard` and `MyNotes` modules serve as the central personal hub of Scripture Habit.
By partitioning auth, group state, search filtering, and calendar rendering into dedicated custom hooks and modular components, the personal study experience remains highly performant and extensible.
