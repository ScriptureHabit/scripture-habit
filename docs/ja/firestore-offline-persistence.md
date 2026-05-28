# Firestore オフライン永続化

このドキュメントでは、アプリがどのようにオフラインデータを処理し、複数のブラウザタブ間でデータを同期し、制限されたブラウザのためのフォールバックを提供し、自動テストのための認証を設定するかを説明します。

---

## 1. オフラインキャッシュと複数タブ同期

（通勤中などの）オフラインでの利用をサポートするため、アプリはネットワーク接続がない状態でもレスポンスを維持できるよう、データをローカルにキャッシュします。

### アーキテクチャの概要
アプリケーションは、IndexedDB 永続ローカルキャッシュを使用して Firestore を初期化し、複数タブマネージャーを構成します：

```typescript
db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

```
      ┌────────────────────────────────────────────────────────┐
      │                  クライアントアプリ                     │
      │  タブ 1 (アクティブチャット)       タブ 2 (ダッシュボード画面)│
      └──────────┬────────────────────────────────┬────────────┘
                 │                                │
                 ▼                                ▼
      ┌────────────────────────────────────────────────────────┐
      │      persistentMultipleTabManager (共有ロック)          │
      │        アクセスの調整、更新（ミューテーション）の同期       │
      └──────────────────────────┬─────────────────────────────┘
                                 ▼
      ┌────────────────────────────────────────────────────────┐
      │                 IndexedDB ローカルキャッシュ                  │
      │  キャッシュされたドキュメントの保持、オフライン書き込みキュー  │
      └──────────────────────────┬─────────────────────────────┘
                                 ▼
                     [ リモート Firestore 同期 ]
```

### 1.1 複数タブ同期の仕組み
1. **データベースロックの回避**: 標準的な単一タブ用の永続化設定では、2つ目のタブが開かれたときに IndexedDB がロックされ、新しいタブは低速なメモリキャッシュの使用を強制されます。
2. **共有アクセス**: `persistentMultipleTabManager` を使用すると、複数のタブや WebView が同じ IndexedDB ストアを共有できます。1つのタブが IndexedDB への変更の書き込みを調整し、他のタブを更新します。
3. **オフライン同期キュー**: オフラインのとき、すべての変更はオフラインキューに保存されます。ネットワークが復旧すると、アクティブなタブが自動的に変更を Firestore にアップロードします。

---

## 2. プライベートブラウジング時のフォールバック

プライベートブラウジングモード（iOS Safari のプライベートブラウジングなど）や制限された環境では、IndexedDB へのアクセスがブロックされることがあります。この状態で IndexedDB を初期化しようとすると、エラーが発生してアプリがクラッシュする可能性があります。

クラッシュを防ぐため、`src/firebase.ts` では Firestore の初期化を try-catch ブロックでラップしています：

```typescript
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.error("Firestore initialization with persistence failed, falling back to default:", e);
  db = getFirestore(app); // 標準のメモリキャッシュへフォールバック
}
```

### 2.1 フォールバックの動作
* **通常モード**: IndexedDB がサポートされている場合、アプリはオフラインキャッシュを有効にします。
* **フォールバックモード**: IndexedDB の初期化に失敗した場合、アプリは標準のメモリキャッシュ（`getFirestore(app)`）にフォールバックします。アプリは通常通り機能し続けますが、タブを閉じた後はオフライン中の変更は保存されません。

---

## 3. E2E テストの最適化

自動化された E2E テストの実行中、ヘッドレスブラウザはまっさらな状態で起動します。デフォルトでは、Firebase Auth はセッション内メモリ（セッションが切れるとリセットされる）を使用するため、テストごとに繰り返しサインインが必要になります。

テストを高速化し、ログイン状態を維持するために、自動テスト環境を検出してローカルの永続性を強制します：

```typescript
// E2E テストの最適化: Playwright がキャプチャできるよう、強制的に LocalStorage 永続化を有効にします
if (typeof window !== 'undefined' && navigator.webdriver && auth) {
  window.firebaseAuth = auth;
  setPersistence(auth, browserLocalPersistence).catch(err => {
    console.error("Failed to set auth persistence:", err);
  });
}
```

### 3.1 主な設定
1. **自動化環境の検出**: `navigator.webdriver` が true であるかをチェックします。これは、ブラウザが Playwright などのテストツールによって制御されていることを示します。
2. **ローカルストレージの強制**: 自動化環境が検出された場合、アプリは `browserLocalPersistence`（`localStorage`）を使用して認証状態の永続化を強制します。精度を維持し、ページの再読み込みを行ってもユーザーのログイン状態が維持されます。
3. **グローバルデバッグインターフェース**: 認証インスタンスを `window.firebaseAuth` にバインドし、Playwright スクリプトが認証トークンにアクセスしたり、セッション状態を直接確認したりできるようにします。
