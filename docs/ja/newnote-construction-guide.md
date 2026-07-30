# Scripture Habit ノート作成・編集モーダル (`NewNote`) ゼロから構築する完全ガイド

本ドキュメントは、`src/components/newnote` モジュールをゼロから設計・構築するための包括的な開発ステップバイステップガイドです。
フォームステート管理、自動URLメタデータ取得、AIによる振り返り質問生成、5つのテーマ別および読書計画対応ランダム聖典提案エンジン、共有範囲制御、ノート投稿＆ストリーク更新トランザクション、およびユニットテストの全容をコード付きで解説します。

---

## 1. 全体アーキテクチャ概要

`NewNote` モジュールは、ユーザーが日々の聖書通読記録（ノート）を作成・編集し、個人の記録として保存したり、所属するグループへ共有したりするためのコアコンポーネントです。

```
                               ┌─────────────────────────┐
                               │       NewNote           │
                               │  (モーダルコンテナ)      │
                               └────────────┬────────────┘
                                            │
        ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
        ▼                  ▼                ▼                 ▼                  ▼
useUrlMetaFetcher   useAIGenerator   useRandomNote   useNoteSubmission    サブコンポーネント
(500msデバウンスURL) (Gemini質問生成) (6カテゴリ/URLローカライズ)(API/Confetti/Batch) (ピル/ダイアログ)
```

### 主な機能
- **聖典入力 & インクリメンタル補完**: `suggestion-utils.ts` によるひらがな/Unicode正規化とリアルタイム自動補完。
- **URL メタデータ自動抽出 (`useUrlMetaFetcher`)**: 章フィールドに `http` で始まる URL（General Conference や説教等）が入力された場合、500ms のデバウンスを挟んで `/api/extract-url-metadata` へ送信し、タイトルや説教者（Speaker）を非同期自動抽出。
- **AI 振り返り質問生成 (Gemini) (`useAIGenerator`)**: 選択した聖典・章に応じた深めるための質問を `/api/generate-questions` 経由でオンデマンド生成。
- **ランダム聖句提案エンジン (`useRandomNote`)**: 「今日の読書計画」「マスター聖句」「平和 (`PeaceScriptures`)」「苦難 (`AdversityScriptures`)」「人間関係 (`RelationshipScriptures`)」「喜び (`JoyScriptures`)」の6カテゴリからランダムに抽出。URL参照の場合は `localizeLdsUrl` で言語別に自動変換。
- **柔軟な共有範囲制御 (`NoteSharingOptions`)**: 「全体共有」「個人記録のみ」「特定のグループを選択」のマルチグループ共有ピルUI。
- **新規作成 & 編集モードの統一管理**: 既存ノート・グループメッセージの編集時は Firestore WriteBatch (`writeBatch`) による個人ノートとグループメッセージの双方向同期。新規作成時は `/api/notes` へ POST 送信し、レベルアップ時に紙吹雪 (`canvas-confetti`) を発火。

---

## 2. ディレクトリ構造とファイル役割一覧

```
src/components/newnote/
├── new-note.tsx                        # メインモーダルコンポーネント（エントリーポイント）
├── new-note.css                        # フォームおよびモーダル共通スタイリング
├── new-note.test.tsx                   # Vitest コンポーネント統合テスト
├── hooks/
│   ├── use-note-state.ts              # フォーム入力・公開範囲・初期値設定フック
│   ├── use-url-meta-fetcher.ts        # 500msデバウンスURLメタデータ自動取得フック
│   ├── use-ai-generator.ts            # Gemini API (/api/generate-questions) 質問生成フック
│   ├── use-random-note.ts             # 6カテゴリ/URLローカライズ対応ランダム聖句提案フック
│   ├── use-note-submission.ts         # 新規投稿(/api/notes)・Batch編集同期・紙吹雪フック
│   └── use-note-submission.test.ts    # 投稿フックの単体テスト
└── subcomponents/
    ├── random-scripture-menu.tsx      # シャッフルアイコンボタンとポップアップメニューUI
    ├── scripture-selection-modal.tsx  # ランダム聖句テーマ別カテゴリ選択モーダル
    ├── note-sharing-options.tsx       # 共有範囲選択（全体/個人/グループ選択）ピルUI
    └── close-confirm-modal.tsx        # 未保存変更破棄の確認モーダル
```

---

## 3. 段階別ビルドガイド (Phase 1 〜 Phase 6)

### Phase 1: データモデルとユーティリティ基盤の準備

```typescript
// コンポーネント Props の型定義
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

### Phase 2: モジュール化されたカスタムフック群の実装

#### 1. URL メタデータ取得フック (`hooks/use-url-meta-fetcher.ts`)

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

#### 2. ランダム聖句提案フック (`hooks/use-random-note.ts`)

`getTodayReadingPlan()` の読書計画および5つのテーマ別定義データ（`MasteryScriptures`, `PeaceScriptures`, `AdversityScriptures`, `RelationshipScriptures`, `JoyScriptures`）からランダム抽出します。

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

#### 3. 投稿・編集トランザクションフック (`hooks/use-note-submission.ts`)

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
                // 編集モード: writeBatch によるグループメッセージと個人ノートの双方向更新
                const batch = writeBatch(db);
                // ...
                await batch.commit();
            } else {
                // 新規作成モード: /api/notes へ POST 送信
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

### Phase 4: メインコンポーネント (`new-note.tsx`) の統合

メインモーダルコンテナは、5つのカスタムフックとサブコンポーネントをまとめるエントリーポイントです。

```typescript
const NewNote: FC<NewNoteProps> = ({
    isOpen, onClose, userData,
    userGroups = [], currentGroupId = null, noteToEdit = null
}) => {
    const { t, language, tArray, translateChapterField } = useLanguage();
    
    // フォーム入力状態
    const [scripture, setScripture] = useState<string>('');
    const [chapter, setChapter] = useState<string>('');
    const [comment, setComment] = useState<string>('');
    const [shareOption, setShareOption] = useState<string>('all');
    const [selectedShareGroups, setSelectedShareGroups] = useState<string[]>([]);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    // モジュール化カスタムフックの呼び出し
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
                {/* ヘッダーとランダム聖句提案メニュー */}
                <div className="modal-header">
                    <h1>{noteToEdit ? t('newNote.editTitle') : t('newNote.title')}</h1>
                    <RandomScriptureMenu 
                        onOpenMenu={() => setShowRandomMenu(true)} 
                        onOpenModal={() => setShowSelectionModal(true)} 
                    />
                </div>

                {/* 聖典カテゴリ・自動補完ドロップダウン */}
                <Select
                    options={categoryOptions}
                    value={categoryOptions.find(o => o.value === scripture)}
                    onChange={opt => setScripture(opt?.value || '')}
                    placeholder={t('newNote.selectCategoryPlaceholder')}
                />

                {/* 章 / URL入力 ＆ URLメタデータ非同期自動表示プレビュー */}
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

                {/* Gemini AI 振り返り質問生成ボタン ＆ カード */}
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

                {/* 勉強ノート感想・コメント入力エリア */}
                <textarea 
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={commentPlaceholder}
                    rows={4}
                />

                {/* グループ共有範囲選択ピル UI */}
                <NoteSharingOptions 
                    userGroups={userGroups}
                    shareOption={shareOption}
                    setShareOption={setShareOption}
                    selectedShareGroups={selectedShareGroups}
                    setSelectedShareGroups={setSelectedShareGroups}
                />

                {/* 保存・キャンセルアクション */}
                <div className="ModalActions">
                    <button className="modal-btn cancel" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="modal-btn primary" onClick={onSubmit} disabled={loading}>
                        {loading ? t('common.saving') : t('common.save')}
                    </button>
                </div>
            </div>

            {/* サブモーダル群 */}
            <ScriptureSelectionModal isOpen={showSelectionModal} onClose={() => setShowSelectionModal(false)} />
            <CloseConfirmModal isOpen={showCloseConfirm} onConfirm={onClose} onCancel={() => setShowCloseConfirm(false)} />
        </div>
    );
};
```

---

### Phase 5: デザインシステムと CSS スタイリング (`new-note.css`)

すりガラス（グラスモフィズム）のオーバーレイと、AI質問カードやURLプレビューピルのアニメーション定義です：

```css
/* すりガラス（Glassmorphism）背景オーバーレイとモーダル */
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

/* AI 振り返り質問カード ＆ ホバーマイクロアニメーション */
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

/* URL メタデータ抽出プレビューカード */
.url-meta-card {
  background: #f8fafc;
  border-left: 4px solid var(--pink, #ec4899);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #334155;
}
```

### Phase 6: 動作検証とテスト

Vitest による包括的な単体・統合テスト (`new-note.test.tsx`, `use-note-submission.test.ts`):

```typescript
describe('useNoteSubmission', () => {
    it('聖典または章が空の場合に送信を防止しエラーメッセージを表示する', async () => {
        const { result } = renderHook(() => useNoteSubmission(mockUser, 'en', key => key));
        await act(async () => {
            await result.current.handleSubmit(null, '', '', '', 'all', [], null, null, vi.fn());
        });
        expect(toast.error).toHaveBeenCalled();
    });
});
```

---

## 4. まとめ

`NewNote` コンポーネントは、URLデバウンス抽出、Gemini質問生成、URLローカライズ付きランダム聖句提案、およびWriteBatch編集同期を5つのカスタムフックへ高精度に分離した極めて堅牢なモジュールです。
