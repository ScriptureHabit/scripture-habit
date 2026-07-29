# Scripture Habit ノート作成・編集モーダル (`NewNote`) ゼロから構築する完全ガイド

本ドキュメントは、`src/components/newnote` モジュールをゼロから設計・構築するための包括的な開発ステップバイステップガイドです。
フォームステート管理、自動URLメタデータ取得、AIによる振り返り質問生成、ランダム聖典提案エンジン、共有範囲制御、ノート投稿＆ストリーク更新トランザクション、およびユニットテストの全容を解説します。

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
(URLタイトル/話者)   (Gemini質問生成)  (6カテゴリ選択) (API/ストリーク/紙吹雪) (メニュー/ピル/ダイアログ)
```

### 主な機能
- **聖典入力 & インクリメンタル補完**: `suggestion-utils.ts` によるひらがな/Unicode正規化とリアルタイム自動補完。
- **URL メタデータ自動検出**: 章フィールドに General Conference 等の Web URL が入力された場合、タイトルや説教者（Speaker）を非同期自動抽出。
- **AI 振り返り質問生成 (Gemini)**: 選択した聖典・章に応じた深めるための質問をオンデマンド生成。
- **ランダム聖典提案エンジン**: 「今日の読書計画」「マスター聖句」「平和」「苦難」「人間関係」「喜び」の6カテゴリからランダムに聖句を抽出。
- **柔軟な共有範囲制御**: 「全体共有」「個人記録のみ」「特定のグループを選択」のマルチグループ共有ピルUI。
- **新規作成 & 編集モード（Edit Mode）の統一管理**: 既存ノート・グループメッセージの編集および個人ノートとの双方向同期。
- **投稿インタラクション & ストリーク計算**: POST API / Firestore Batch 処理、レベルアップ時のクラッカーアニメーション（`canvas-confetti`）、およびオンボーディング導線。

---

## 2. ディレクトリ構造とファイル役割一覧

```
src/components/newnote/
├── new-note.tsx                        # メインモーダルコンポーネント（エントリーポイント）
├── new-note.css                        # フォームおよびモーダル共通スタイリング
├── new-note.test.tsx                   # Vitest コンポーネント統合テスト
├── hooks/
│   ├── use-note-state.ts              # フォーム入力・モーダル開閉ステート管理
│   ├── use-url-meta-fetcher.ts        # URL入力時のタイトル/説教者自動取得フック
│   ├── use-ai-generator.ts            # Gemini API による振り返り質問生成フック
│   ├── use-random-note.ts             # 6カテゴリからのランダム聖句提案フック
│   ├── use-note-submission.ts         # 新規投稿・編集・ストリーク更新・API通信フック
│   └── use-note-submission.test.ts    # 投稿フックの単体テスト
└── subcomponents/
    ├── random-scripture-menu.tsx      # ランダム聖句ピッカーのメニュー/ボタンUI
    ├── scripture-selection-modal.tsx  # ランダム聖句カテゴリ選択モーダル
    ├── note-sharing-options.tsx       # 共有範囲選択（全体/個人/グループ選択）ピルUI
    └── close-confirm-modal.tsx        # 未保存変更破棄の確認モーダル
```

---

## 3. 段階別ビルドガイド (Phase 1 〜 Phase 6)

### Phase 1: データモデルとユーティリティ基盤の準備

まず、ノート作成に必要な型定義とユーティリティ関数を確認・準備します。

```typescript
// 主な依存ユーティリティのインポート
import { getBookSuggestions } from '../../utils/suggestion-utils';
import { getGospelLibraryUrl, getCategoryFromScripture } from '../../utils/gospel-library-mapper';
import { formatNoteText, getNoteValidationError } from '../../utils/note-logic';
import { buildNoteSearchTokens } from '../../utils/search-token-utils';

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

`NewNote` のロジックは Logic-Component Split 原則に従い、用途ごとに5つのカスタムフックへ分離されています。

#### 1. URL メタデータ取得フック (`hooks/use-url-meta-fetcher.ts`)
`chapter` フィールドに URL が入力されたことを検知し、バックエンド API（`/api/extract-url-metadata`）経由でタイトルや話者を非同期取得します。

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

#### 2. AI 質問生成フック (`hooks/use-ai-generator.ts`)
Gemini API (`/api/generate-questions`) を呼び出し、ユーザーが読んでいる聖句に応じた振り返り用の問いかけテキストを生成します。

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

#### 3. ランダム聖句提案フック (`hooks/use-random-note.ts`)
ユーザーの読書計画や、マスター聖句、テーマ別（平和、苦難、人間関係など）のデータストアからランダムに 1 つを選び出し、フォームの聖典・章フィールドへ自動挿入します。

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

    // 各カテゴリのハンドラー: handlePickRandomPeace, handlePickRandomAdversity 等

    return {
        showRandomMenu, setShowRandomMenu,
        showSelectionModal, setShowSelectionModal,
        handlePickRandomMastery,
        // ...
    };
};
```

#### 4. 投稿・編集トランザクションフック (`hooks/use-note-submission.ts`)
入力バリデーション（`getNoteValidationError`）、新規作成時の `/api/notes` POST 送信、ストリーク再計算、レベルアップ紙吹雪演出（`canvas-confetti`）、および編集時の Firestore Batch（`writeBatch`）同期処理を担当します。

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
                // 編集モード: Firestore WriteBatch によるグループメッセージと個人ノートの一括更新
                const batch = writeBatch(db);
                // ... メッセージと個人ノートの更新参照を設定
                await batch.commit();
            } else {
                // 新規作成モード: /api/notes へ POST 送信
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

### Phase 3: サブコンポーネント群の構築

1. **`random-scripture-menu.tsx`**: シャッフルアイコンボタンと、ランダム聖句ピッカーのポップアップメニュー。
2. **`scripture-selection-modal.tsx`**: 「平和」「苦難」「人間関係」「喜び」等のテーマ別カテゴリ選択ダイアログ。
3. **`note-sharing-options.tsx`**: 「すべてのグループ」「個人のみ」「選択したグループ」の共有範囲選択ピル（Pill）UI。
4. **`close-confirm-modal.tsx`**: 入力中にモーダルを閉じようとした際の「変更を破棄しますか？」確認ダイアログ。

---

### Phase 4: メインコンポーネント (`new-note.tsx`) の統合

フォームステート、オートコンプリート（`react-select`）、各カスタムフック、およびオンボーディング指示ツールチップを組み合わせます。

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

    // 編集モード初期値の設定
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
                
                {/* 聖典・章入力フォーム */}
                <ScriptureInput value={scripture} onChange={setScripture} />
                <ChapterInput value={chapter} onChange={setChapter} />
                
                {/* AI 質問生成ボタン */}
                <button onClick={() => handleGenerateQuestions(scripture, chapter)}>
                    <UilRobot /> {t('newNote.generateAiQuestion')}
                </button>

                {/* コメント入力エリア */}
                <textarea value={comment} onChange={e => setComment(e.target.value)} />

                {/* 共有オプションピル */}
                <NoteSharingOptions ... />

                {/* アクションボタン */}
                <button onClick={onSubmit} disabled={loading}>{t('common.save')}</button>
            </div>
        </div>
    );
};
```

---

### Phase 5: デザインシステムとスタイリング (`new-note.css`)

- **モーダルオーバーレイ**: `backdrop-filter: blur(8px)` による背景ぼかしと暗転効果。
- **レスポンシブ配置**: モバイル端末（`@media (max-width: 768px)`）では画面下部からのスライドイン（Sheet スタイル）、デスクトップでは中央配置ダイアログ。
- **入力サジェストピル**: インタラクティブなホバーアニメーションとフォーカス状態インジケーター。

---

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

`NewNote` コンポーネントは、副作用（URL解析、AI質問生成、ランダム聖句抽出、投稿トランザクション）を5つのモジュール化されたカスタムフックと4つのサブコンポーネントへ美しく分離しています。
このアーキテクチャにより、非常に高い保守性、再利用性、およびシンプルなテスト可能性が保証されています。
