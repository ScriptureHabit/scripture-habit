# Scripture Habit ダッシュボード & マイノート (`Dashboard` / `MyNotes` / `NoteCard`) ゼロから構築する完全ガイド

本ドキュメントは、Scripture Habit アプリの個人向けメイン画面群である `src/components/dashboard`、`src/components/mynotes`、`src/components/notecard` をゼロから設計・構築するための包括的な開発ステップバイステップガイドです。
ユーザー同期、通読ストリークカレンダー、習慣ペース判定アルゴリズム、グループ招待・警告通知、ノート検索・タグフィルタリングエンジン、週次AI振り返り生成、およびレスポンシブなノートカード表示の全容を解説します。

---

## 1. 全体アーキテクチャ概要

`Dashboard` はアプリケーションのハブとなるメインコンテナであり、ユーザーの通読実績の可視化、ナビゲーション制御、グループ選択、およびマイノート (`MyNotes`) 表示を一元統合しています。

```
                               ┌─────────────────────────┐
                               │       Dashboard         │
                               │   (Main Container)      │
                               └────────────┬────────────┘
                                            │
        ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
        ▼                  ▼                ▼                 ▼                  ▼
useDashboardSync   useDashboardGroups useHabitPace/Warnings  DashboardLayout      MyNotes
(ユーザー同期)     (所属グループ同期)  (ペース判定/警告)   (Overview/Streak) (検索・ノートカード)
                                                                                  │
                                                                                  ▼
                                                                              NoteCard
                                                                        (カード/ディープリンク)
```

### 主な機能
- **ユーザー状態 & 権限同期**: Firebase Auth および Firestore ドキュメントとの同期、深夜0時のローカルタイムゾーン反転フック（`useToday`）。
- **通読ストリークカレンダー**: 月ごとの読書記録グリッド（`StreakCalendar`）と連続読書日数（Streak）の可視化。
- **習慣ペース設定フック (`useDashboardHabitPace`)**: 初回ユーザー向けに「3〜7日間」の目標通読ペース（キックしきい値 `kickThreshold`）を設定・保存するためのモーダル状態管理および `/api/groups/update-kick-threshold` 通信処理。
- **ノート検索 & タグフィルタリングエンジン (`useMyNotes`)**: 全文検索トークン (`buildNoteSearchTokens`)、聖典巻別フィルタリング、および無限ロード。
- **週次 AI ふり返り (`useRecap`)**: Gemini API を活用し、1週間分の読書ノートから個人に特化した要約と成長のフィードバックを自動生成。
- **聖書ディープリンク構造 (`NoteCard`)**: LDS Gospel Library アプリ / Web へのダイレクトリンク生成と、モーダル詳細表示。

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
│   │   ├── streak-calendar.tsx         # 通読実績カレンダーコンポーネント
│   │   ├── streak-calendar.css
│   │   ├── quest-card.tsx              # 日次クエスト・読書目標カード
│   │   └── quest-card.css
│   └── hooks/
│       ├── use-dashboard-sync.ts       # ユーザー認証・データ同期フック
│       ├── use-dashboard-groups.ts     # グループ一覧取得・選択状態フック
│       ├── use-dashboard-habit-pace.ts # 通読ペース計算アルゴリズムフック
│       ├── use-dashboard-invitations.ts # グループ招待承諾ハンドラー
│       ├── use-dashboard-notifications.ts # 通知許可プロンプトフック
│       ├── use-dashboard-warnings.ts   # 非アクティブ警告検知フック
│       └── use-dashboard-actions.ts    # プロフィール更新・ダイアログ操作フック
├── mynotes/
│   ├── my-notes.tsx                    # マイノート一覧 & 検索ヘッダーコンテナ
│   ├── my-notes.css
│   ├── note-detail-modal.tsx           # ノート詳細ダイアログ
│   ├── note-detail-modal.css
│   └── hooks/
│       ├── use-my-notes.ts             # ノート一覧取得・検索フィルタリングフック
│       ├── use-note-actions.ts         # ノート削除・編集操作フック
│       └── use-recap.ts                # 週次 AI ふり返り生成フック
└── notecard/
    ├── note-card.tsx                   # 個別ノートカードコンポーネント
    └── note-card.css
```

---

## 3. 段階別ビルドガイド (Phase 1 〜 Phase 7)

### Phase 1: ユーザー同期と習慣ペース判定エンジン

最初に、ユーザーデータと通読ペースを計算するコアフックを定義します。

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

#### 2. 習慣ペース設定フック (`hooks/use-dashboard-habit-pace.ts`)
初回ログインユーザーが未設定の場合に自動的にウェルカムモーダルを開き、3〜7日間の習慣化ペース（キックしきい値 `selectedKickDays`）を選択・更新するフックです。`/api/groups/update-kick-threshold` へ送信し設定を保存します。

---

### Phase 2: ダッシュボードグループ ＆ 警告フック

- `use-dashboard-groups.ts`: ユーザーが所属する全グループを取得し、アクティブなグループID (`activeGroupId`) を管理します。
- `use-dashboard-warnings.ts`: 未投稿の日数が続き、グループからキックされそうな場合の警告アラートを生成します。

---

### Phase 3: ダッシュボード UI サブコンポーネント

#### 1. 通読実績カレンダー (`components/streak-calendar.tsx`)
当月の各日付において、ユーザーがノートを投稿した日をハイライト表示するグリッドコンポーネントです。

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

#### 2. クエストカード (`components/quest-card.tsx`)
今日の読書目標（例: 「今日の読書計画: 1 Nephi 3」）を表示し、ワンタップでノート作成モーダルを開くカードです。

---

### Phase 4: マイノート検索 ＆ フィルタリングエンジン

`mynotes/hooks/use-my-notes.ts` は、Firestore の `users/{uid}/notes` サブコレクションを購読し、ユーザーが入力したキーワードや選択した聖典カテゴリでクライアントサイドフィルタリングを行います。

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
  it('週3回以上の投稿がある場合に良好ステータスを返す', () => {
    const pace = calculateHabitPace(mockNotesCount);
    expect(pace.status).toBe('excellent');
  });
});
```

---

## 4. まとめ

`Dashboard` と `MyNotes` のモジュールは、個人の通読継続を支えるメインハブです。
認証・グループ状態・検索フィルタリング・カレンダー表示を独立したカスタムフックとコンポーネントに分離することで、拡張性の高い個人学習ダッシュボードが実現されています。
