# Firestore オフライン永続化

このドキュメントでは、IndexedDB を活用したオフラインキャッシュ、複数タブ間のデータ同期、プライベートブラウズ時のフォールバック、およびオフライン時の競合解決について解説します。

---

## 1. オフラインキャッシュと複数タブ同期

地下鉄や電波の不安定な場所でも学習を継続できるよう、IndexedDB を用いてデータをローカルに保存します：

```typescript
db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
```

```
┌────────────────────────────────────────────────────────┐
│                   クライアントアプリ                   │
│   タブ 1 (チャット画面)          タブ 2 (ダッシュボード)  │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼                                ▼
┌────────────────────────────────────────────────────────┐
│        persistentMultipleTabManager (共有ロック)       │
│          複数タブ間でのキャッシュ共有・書き込み調整    │
└───────────────────────────┬────────────────────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                 IndexedDB ローカルキャッシュ           │
│   キャッシュされたドキュメント・オフライン書き込みキュー│
└───────────────────────────┬────────────────────────────┘
                            ▼
                [ Firestore クラウド同期 ]
```

- **複数タブ同期 (`persistentMultipleTabManager`)**:
  ブラウザの複数タブや WebView で同じ IndexedDB を共有し、タブ間でのデータの不整合を防ぎます。
- **オフラインキュー**:
  オフライン中の変更は端末内に保持され、電波が復帰した際に自動で Firestore へ同期されます。

---

## 2. プライベートブラウジング時のフォールバック

iOS Safari のプライベートブラウズなど、IndexedDB が制限されている環境でアプリがクラッシュするのを防ぐため、フォールバック処理を実装しています：

```typescript
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.warn("IndexedDB not available, falling back to memory cache:", e);
  db = getFirestore(app); // メモリキャッシュへ自動フォールバック
}
```

---

## 3. オフライン時の競合解決と制限

- **個人ノート・設定**:
  ユーザー個別のサブコレクション（`users/{uid}/notes`）に独立して保存されるため、他ユーザーとの編集競合は発生しません。
- **トランザクション操作の遮断**:
  グループ参加（定員5人チェック）など、サーバー側での整合性検証が必要な処理はオフライン時には実行できず、オンライン復帰を促す案内を表示します。
- **チャットの楽観的UI反映**:
  メッセージ送信時は一時ID（`tempId`）を用いて画面に即時表示し、通信復帰後にサーバーIDへと自動解決されます。

---

## 4. 関連ドキュメント

- [全体アーキテクチャ](./architecture.md)
- [ネットワーク ＆ パフォーマンス最適化](./network-performance-optimization.md)
- [チャットとダッシュボードの同期](./feature-chat-dashboard.md)
