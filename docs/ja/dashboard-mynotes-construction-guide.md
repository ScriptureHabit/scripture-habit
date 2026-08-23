# ダッシュボード & マイノート (`Dashboard` / `MyNotes` / `NoteCard`) の設計と実装

本ドキュメントでは、Scripture Habit アプリの個人向けメイン画面群である `src/components/dashboard`、`src/components/mynotes`、`src/components/notecard` の構成と概要について解説します。
ユーザー同期、通読ストリークカレンダー、習慣ペース設定モーダル、新規ユーザー向けオンボーディングクエスト、ノート検索・トークンフィルタリングエンジン、週次AI振り返り生成、およびレスポンシブなノートカード表示の全容を解説します。

---

## 1. 全体アーキテクチャ概要

`Dashboard` はアプリケーションのハブとなるメインコンテナであり、ユーザーの通読実績の可視化、ナビゲーション制御、グループ選択、およびマイノート (`MyNotes`) 表示を一元統合しています。

```
                               ┌─────────────────────────┐
                               │       Dashboard         │
                               │   (メインコンテナ)       │
                               └────────────┬────────────┘
                                            │
        ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
        ▼                  ▼                ▼                 ▼                  ▼
useDashboardSync   useDashboardGroups useHabitPace/Warnings  DashboardLayout      MyNotes
(ユーザー同期)     (所属グループ同期)  (3-7日ペース設定/警告) (Overview/Streak) (検索・ノートカード)
                                                                                  │
                                                                                  ▼
                                                                              NoteCard
                                                                        (カード/ディープリンク)
```

### 主な機能
- **ユーザー状態 & 権限同期 (`useDashboardSync`)**: Firebase Auth および Firestore ドキュメントとのリアルタイム同期、深夜0時のローカルタイムゾーン反転フック（`useToday`）。
- **通読ストリークカレンダー (`StreakCalendar`)**: 当月の日付グリッドにおいて、ノート投稿日（`isStudied`）および次回キック警告日（`isKickDate`）を視覚化。
- **3〜7日間 習慣ペース設定モーダル (`useDashboardHabitPace`)**: 初回ユーザー向けに自動キック猶予日数（3〜7日間の習慣化ペース `selectedKickDays`）を設定させるウェルカムモーダルの表示・管理、および `/api/groups/update-kick-threshold` 通信処理。
- **新規ユーザー向けオンボーディングクエスト (`QuestCard`)**: 新規ユーザーが「① グループ作成・参加」「② 最初のノート投稿」の2つのミッションを達成するまでを表示。全完了で紙吹雪 (`canvas-confetti`) 演出と `hasCompletedOnboarding` 更新。
- **ノート検索 & タグフィルタリングエンジン (`useMyNotes`)**: 検索トークン (`createSearchTokens`) による `array-contains-any` クエリ、聖典巻別フィルタリング、およびカーソルベースのページネーション（`startAfter`）。
- **週次 AI ふり返り (`useRecap` / `useRecapOperations`)**: 6日間のクールダウン判定付きで Gemini API (`/api/ai/generate-personal-weekly-recap`) を呼び出し、生成された振り返りを LetterBox (`users/{uid}/letters`) へ保存。
- **聖書ディープリンク構造 (`NoteCard`)**: LDS Gospel Library アプリ / Web へのダイレクトリンク生成と、モーダル詳細表示 (`NoteDetailModal`)。

---

## 2. ディレクトリ構造とファイル役割一覧

```
src/components/
├── dashboard/
│   ├── dashboard.tsx                   # ダッシュボード統合エントリーポイント
│   ├── dashboard.css                   # グリッドレイアウト & メインCSS
│   ├── components/
│   │   ├── dashboard-layout.tsx        # 画面ビュー切り替えシェル
│   │   ├── dashboard-overview.tsx      # ストリーク・クエストカード統合領域
│   │   ├── dashboard-modals.tsx        # ダッシュボード固有モーダルのスイッチルーター
│   │   ├── streak-calendar.tsx         # 通読実績・キック警告カレンダー
│   │   ├── streak-calendar.css
│   │   ├── quest-card.tsx              # 新規ユーザー用2ステップオンボーディングクエストカード
│   │   └── quest-card.css
│   └── hooks/
│       ├── use-dashboard-sync.ts       # ユーザー認証・データ同期フック
│       ├── use-dashboard-groups.ts     # グループ一覧取得・選択状態フック
│       ├── use-dashboard-habit-pace.ts # 3〜7日間の習慣化ペース（キック閾値）設定フック
│       ├── use-dashboard-invitations.ts # グループ招待承諾ハンドラー
│       ├── use-dashboard-notifications.ts # FCM通知プロンプトフック
│       ├── use-dashboard-warnings.ts   # 非アクティブ警告検知フック
│       └── use-dashboard-actions.ts    # プロフィール更新・ダイアログ操作フック
├── mynotes/
│   ├── my-notes.tsx                    # マイノート一覧 & 検索ヘッダーコンテナ
│   ├── my-notes.css
│   ├── note-detail-modal.tsx           # ノート詳細ダイアログ
│   ├── note-detail-modal.css
│   └── hooks/
│       ├── use-my-notes.ts             # 検索トークン・カテゴリ別ページネーション取得フック
│       ├── use-note-actions.ts         # ノート削除・編集操作フック
│       └── use-recap.ts                # クールダウン付き週次 AI ふり返り生成・LetterBox保存フック
└── notecard/
    ├── note-card.tsx                   # 個別ノートカードコンポーネント
    └── note-card.css
```

---

## 3. 段階別ビルドガイド (Phase 1 〜 Phase 7)

### Phase 1: ユーザー同期と習慣ペース設定フック

#### 1. ユーザー同期フック (`hooks/use-dashboard-sync.ts`)
Firebase Auth の認証状態を監視し、Firestore から `users/{uid}` ドキュメントをリアルタイム同期します。

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

#### 2. 3〜7日間の習慣ペース設定フック (`hooks/use-dashboard-habit-pace.ts`)
初回ユーザー向けに自動キック猶予日数（3〜7日間の習慣化ペース `selectedKickDays`）を選択させるモーダルを起動し、`/api/groups/update-kick-threshold` へ POST 送信して設定を保存します。

---

### Phase 2: ダッシュボードグループ ＆ 警告フック

- `use-dashboard-groups.ts`: ユーザーが所属する全グループを取得し、アクティブなグループID (`activeGroupId`) を管理します。
- `use-dashboard-warnings.ts`: 未投稿の日数が続き、グループからキックされそうな場合の警告アラートを生成します。

---

### Phase 3: ダッシュボード UI サブコンポーネント

#### 1. 通読実績カレンダー (`components/streak-calendar.tsx`)
当月の各日付において、ユーザーがノートを投稿した日 (`isStudied`) および次回キック警告日 (`isKickDate`) をハイライト表示するグリッドコンポーネントです。

```tsx
export const StreakCalendar: FC<StreakCalendarProps> = ({ studiedDates = [], kickDate, t }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarData = useMemo(() => {
    // 当月の1日〜最終日のグリッドセル配列を生成
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

#### 2. 新規ユーザー用オンボーディングクエストカード (`components/quest-card.tsx`)
新規ユーザー向けに **Step 1（グループ作成・参加）** と **Step 2（最初のノート投稿）** の進捗を表示するカードです。両方完了すると紙吹雪 (`canvas-confetti`) が舞い、「クエストを完了する」ボタンを押すことで `hasCompletedOnboarding: true` を Firestore に更新し、以降は表示されなくなります。

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
          {/* Step 1: グループ参加 / Step 2: ノート投稿 のチェック表示 */}
        </div>
      ) : (
        <button onClick={handleComplete}>{t('onboardingQuest.congratsBtn')}</button>
      )}
    </div>
  );
};
```

---

### Phase 4: マイノート検索 ＆ フィルタリングエンジン (`mynotes/hooks/use-my-notes.ts`)

Firestore の `users/{uid}/notes` サブコレクションを購読し、検索トークン (`createSearchTokens`) による `array-contains-any` 検索と、`startAfter` を用いたページネーションを行います。

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

### Phase 5: ノートカード ＆ モーダル表示層

#### 1. ノートカードコンポーネント (`notecard/note-card.tsx`)
聖典名、章、コメントの抜粋、投稿日時、および Gospel Library へのディープリンクボタンをカード形式でレンダリングします。

```tsx
export const NoteCard: FC<{ note: Note; onClick: () => void }> = ({ note, onClick }) => {
  const gospelUrl = getGospelLibraryUrl(note.scripture, note.chapter);

  return (
    <div className="note-card" onClick={onClick}>
      <div className="note-card-header">
        <span className="scripture-title">{note.scripture} {note.chapter}</span>
        {gospelUrl && (
          <a href={gospelUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            Gospel Library
          </a>
        )}
      </div>
      <p className="note-comment-preview">{note.comment}</p>
      <span className="note-date">{formatDate(note.createdAt)}</span>
    </div>
  );
};
```

#### 2. ノート詳細ダイアログ (`mynotes/note-detail-modal.tsx`)
ノートカードをクリックした際に開き、全文の閲覧、SNSシェア、編集・削除アクションを実行できるモーダルです。

---

### Phase 6: デザインシステムと CSS レイアウト (`dashboard.css`, `my-notes.css`)

- **レスポンシブ Grid レイアウト**: PC画面では「サイドバー + メインコンテンツ + 右側概要」の 3 カラム、スマホ画面では Bottom Navigation に応じた単一カラム表示。
- **グラスモフィズムデザイン**: `background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px);` による高級感のある透かし背景。

---

### Phase 7: 動作検証と単体テスト

`use-dashboard-groups.test.ts` や `use-dashboard-habit-pace.test.ts` などの Vitest テストスイートでロジックを検証します。

```typescript
describe('useDashboardHabitPace', () => {
  it('しきい値送信時に成功トーストを表示する', async () => {
    // ...
  });
});
```

---

## 4. まとめ

`Dashboard` と `MyNotes` のモジュールは、個人の通読継続を支えるメインハブです。
認証・グループ状態・検索トークンクエリ・オンボーディングクエスト・カレンダー表示を独立したカスタムフックとコンポーネントに分離することで、拡張性の高い個人学習ダッシュボードが実現されています。
